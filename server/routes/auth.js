const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, InviteCode } = require('../models');
const { authenticateToken, asyncHandler, JWT_SECRET } = require('../middleware/auth');
const transporter = require('../utils/mailer');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, inviteCode } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' });

    const userCount = await User.count();
    const isAdmin = userCount === 0;

    // Check invite code
    const normalizedCode = (inviteCode || '').trim().toUpperCase();
    const staticBypassCodes = ['START-ITA-24', 'APP-MOBIL-2026'];
    if (!isAdmin && !staticBypassCodes.includes(normalizedCode)) {
      if (!inviteCode) return res.status(400).json({ error: 'Einladungscode erforderlich' });
      const codeObj = await InviteCode.findOne({ where: { code: normalizedCode, isUsed: false } });
      if (!codeObj) return res.status(400).json({ error: 'Ungültiger oder bereits verwendeter Einladungscode' });
      
      // Link invite code if valid
      codeObj.isUsed = true;
      codeObj.save().catch(e => console.error("Error saving codeObj:", e));
    }

    // MANUAL HASHING
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
        email, 
        password: hashedPassword, 
        isAdmin,
        lastResetAt: new Date() // Initialize reset timestamp to prevent "zombie sync"
    });
    
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error("Register error:", error);
    res.status(400).json({ error: 'Email already exists or invalid' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });

  if (user && (await bcrypt.compare(password, user.password))) {
    if (user.isActive === false) {
      return res.status(403).json({ error: 'Dein Konto wurde deaktiviert.' });
    }
    
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '24h' });
    if (user.isAdmin) console.log(`[AUTH] Admin login: ${user.email}`);
    res.json({ token, isAdmin: user.isAdmin, name: user.name, dailyActivity: user.dailyActivity || {} });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ where: { email } });
  
  if (!user) {
    return res.json({ message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.resetToken = token;
  user.resetTokenExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  const resetUrl = `http://${req.headers.host}?reset=${token}`;
  
  const mailOptions = {
    from: process.env.SMTP_USER || 'noreply@lernapp.local',
    to: user.email,
    subject: 'Passwort zurücksetzen - LernApp Italienisch',
    text: `Klicke auf den folgenden Link, um dein Passwort zurückzusetzen: \n\n${resetUrl}\n\nDer Link ist 1 Stunde lang gültig.`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'E-Mail konnte nicht versendet werden. SMTP nicht konfiguriert?' });
  }
});

router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(404);
    res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        dailyActivity: user.dailyActivity || {},
        lastResetAt: user.lastResetAt
    });
}));

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Ungültige Eingabe oder Passwort zu kurz (min. 6 Zeichen)' });
    }

    const user = await User.findOne({
      where: { resetToken: token }
    });

    if (!user || user.resetTokenExpires < Date.now()) {
      return res.status(400).json({ error: 'Der Link ist ungültig oder abgelaufen.' });
    }

    // MANUAL HASHING
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    res.json({ message: 'Passwort erfolgreich geändert. Du kannst dich nun einloggen.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error during password reset' });
  }
});

router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
    const { name } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(404);
    user.name = name;
    await user.save();
    res.json({ message: 'Profile updated', name: user.name });
}));

router.put('/daily-activity', authenticateToken, asyncHandler(async (req, res) => {
    // Robustly handle both { dailyActivity: { ... } } and direct { ... } payloads
    const clientActivity = req.body.dailyActivity || (req.body && typeof req.body === 'object' && !req.body.email ? req.body : {});
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(404);
    
    const serverActivity = user.dailyActivity || {};
    const mergedActivity = { ...serverActivity };
    
    for (const [date, count] of Object.entries(clientActivity)) {
        if (date !== 'dailyActivity') { // Safety check
            mergedActivity[date] = Math.max(mergedActivity[date] || 0, count);
        }
    }
    
    user.dailyActivity = mergedActivity;
    user.changed('dailyActivity', true);
    await user.save();
    res.json({ message: 'Daily activity merged', dailyActivity: mergedActivity || {} });
}));

router.post('/activity-delta', authenticateToken, asyncHandler(async (req, res) => {
    const { date, count } = req.body;
    if (!date || typeof count !== 'number') return res.status(400).json({ error: 'Invalid delta' });
    
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(404);
    
    const activity = user.dailyActivity || {};
    activity[date] = (activity[date] || 0) + count;
    
    user.dailyActivity = activity;
    user.changed('dailyActivity', true);
    await user.save();
    
    res.json({ message: 'Activity incremented', dailyActivity: user.dailyActivity });
}));

module.exports = router;
