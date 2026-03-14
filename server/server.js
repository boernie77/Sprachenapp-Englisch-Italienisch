const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, User, Vocabulary, Stats, BaseVocabulary, GrammarSentence, InviteCode } = require('./models');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');

// Multer Config
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Middleware to verify Admin
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
      next();
    } catch (error) {
      next(error);
    }
};

// Async Handler Wrapper for better DRY error handling
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Helper for Bulk Uploads
const handleBulkUpload = async (Model, data, res, transaction) => {
    await Model.destroy({ where: {}, transaction });
    const created = await Model.bulkCreate(data, { transaction });
    await transaction.commit();
    res.json(created);
};

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.1', timestamp: new Date() }));

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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

app.post('/api/auth/forgot-password', async (req, res) => {
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

app.get('/api/auth/me', authenticateToken, asyncHandler(async (req, res) => {
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

app.post('/api/auth/reset-password', async (req, res) => {
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

app.put('/api/auth/profile', authenticateToken, asyncHandler(async (req, res) => {
    const { name } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(404);
    user.name = name;
    await user.save();
    res.json({ message: 'Profile updated', name: user.name });
}));

app.put('/api/auth/daily-activity', authenticateToken, asyncHandler(async (req, res) => {
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

app.post('/api/auth/activity-delta', authenticateToken, asyncHandler(async (req, res) => {
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

app.post('/api/contact', authenticateToken, upload.single('attachment'), asyncHandler(async (req, res) => {
    const { message } = req.body;
    const file = req.file;
    const user = await User.findByPk(req.user.id);
    
    if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    if (!message || message.trim().length === 0) {
        if (file) fs.unlink(file.path, () => {});
        return res.status(400).json({ error: 'Nachricht darf nicht leer sein' });
    }

    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@lernapp.local',
      to: 'christian@bernauer24.com',
      subject: `LernApp Kontakt: ${user.name || 'User'} (${user.email})`,
      text: `Nachricht von ${user.name || 'Unbekannt'} (${user.email}):\n\n${message}`
    };

    if (file) {
      mailOptions.attachments = [{ filename: file.originalname, path: file.path }];
    }

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: 'E-Mail erfolgreich gesendet' });
    } finally {
        if (file) {
            fs.unlink(file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }
    }
}));

// Vocabulary Routes
app.get('/api/vocab', authenticateToken, asyncHandler(async (req, res) => {
  const { language } = req.query;
  const where = { UserId: req.user.id };
  if (language) where.language = language;
  
  const vocab = await Vocabulary.findAll({
    where,
    include: [{ model: Stats }]
  });
  res.json(vocab);
}));

app.post('/api/vocab', authenticateToken, asyncHandler(async (req, res) => {
    const { de, it, typ, emoji, grammatica, isActive, isMarked, language } = req.body;
    const finalLang = language || req.query.language || 'it';
    const vocab = await Vocabulary.create({ de, it, typ, emoji, grammatica, isActive: isActive !== false, isMarked: isMarked === true, language: finalLang, UserId: req.user.id });
    const stats = await Stats.create({ VocabularyId: vocab.id });
    res.status(201).json({ ...vocab.toJSON(), Stat: stats });
}));

app.post('/api/vocab/bulk', authenticateToken, asyncHandler(async (req, res) => {
    const { words, language } = req.body;
    const createdWords = [];
    for (const word of words) {
      const { de, it, typ, emoji, grammatica, isActive, isMarked } = word;
      const vocab = await Vocabulary.create({ 
        de, it, typ, emoji, grammatica, 
        isActive: isActive !== false, 
        isMarked: isMarked === true, 
        language: language || word.language || req.query.language || 'it',
        UserId: req.user.id 
      });
      const stats = await Stats.create({ VocabularyId: vocab.id });
      createdWords.push({ ...vocab.toJSON(), Stat: stats });
    }
    res.status(201).json(createdWords);
}));

app.put('/api/vocab/:id/stats', authenticateToken, asyncHandler(async (req, res) => {
    const { presented, correct, incorrect, streak, lastReviewedDate, nextReviewDate, isActive, isMarked } = req.body;
    const vocab = await Vocabulary.findOne({ where: { id: req.params.id, UserId: req.user.id } });
    if (!vocab) return res.sendStatus(404);
    
    if (isActive !== undefined) {
        vocab.isActive = isActive;
        await vocab.save();
    }
    if (isMarked !== undefined) {
        vocab.isMarked = isMarked;
        await vocab.save();
    }

    await Stats.update(
        { presented, correct, incorrect, streak, lastReviewedDate, nextReviewDate },
        { where: { VocabularyId: vocab.id } }
    );
    res.json({ message: 'Stats and status updated' });
}));

app.delete('/api/vocab/:id', authenticateToken, asyncHandler(async (req, res) => {
    const deleted = await Vocabulary.destroy({ where: { id: req.params.id, UserId: req.user.id } });
    if (deleted) res.json({ message: 'Deleted' });
    else res.sendStatus(404);
}));

app.delete('/api/vocab/clear/all', authenticateToken, asyncHandler(async (req, res) => {
    const { language } = req.query;
    const where = { UserId: req.user.id };
    if (language) where.language = language;
    await Vocabulary.destroy({ where });
    res.json({ message: `Vocabulary cleared${language ? ' for ' + language : ''}` });
}));

app.put('/api/vocab/stats/reset', authenticateToken, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(404);

    // 1. Reset User dailyActivity and set reset timestamp
    user.dailyActivity = {};
    user.lastResetAt = new Date();
    user.changed('dailyActivity', true);
    await user.save();

    // 2. Reset all Stats for this user's vocabulary
    const vocabIds = (await Vocabulary.findAll({
        where: { UserId: req.user.id },
        attributes: ['id']
    })).map(v => v.id);

    if (vocabIds.length > 0) {
        await Stats.update(
            {
                presented: 0,
                correct: 0,
                incorrect: 0,
                streak: 0,
                lastReviewedDate: null,
                nextReviewDate: null
            },
            { where: { VocabularyId: vocabIds } }
        );
    }

    res.json({ message: 'All statistics reset successfully' });
}));

// Invite Code Routes
app.get('/api/admin/invite-codes', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const codes = await InviteCode.findAll({
        include: [{ model: User, as: 'usedByUser', attributes: ['email'] }],
        order: [['createdAt', 'DESC']]
    });
    res.json(codes);
}));

app.post('/api/admin/invite-codes', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { count = 1 } = req.body;
    const created = [];
    for (let i = 0; i < count; i++) {
        const code = `ITA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const newCode = await InviteCode.create({ code });
        created.push(newCode);
    }
    res.status(201).json(created);
}));

app.post('/api/admin/invite-codes/send', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { code, email } = req.body;
    const codeObj = await InviteCode.findOne({ where: { code, isUsed: false } });
    if (!codeObj) return res.status(404).json({ error: 'Code nicht gefunden oder bereits verwendet' });

    const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@lernapp.local',
        to: email,
        subject: 'Deine Einladung zur LernApp Italienisch',
        text: `Ciao!\n\nDu wurdest eingeladen, die LernApp Italienisch zu nutzen.\n\nDein persönlicher Einladungscode lautet: ${code}\n\nRegistriere dich hier: ${req.headers.origin || 'https://lernapp.local'}\n\nViel Spaß beim Lernen!`
    };

    await transporter.sendMail(mailOptions);
    codeObj.email = email;
    await codeObj.save();
    res.json({ message: 'Einladung erfolgreich gesendet' });
}));

app.delete('/api/admin/invite-codes/:code', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const result = await InviteCode.destroy({ where: { code: req.params.code, isUsed: false } });
    if (!result) return res.status(400).json({ error: 'Code kann nicht gelöscht werden (existiert nicht oder bereits verwendet)' });
    res.json({ message: 'Code gelöscht' });
}));


// Admin Routes
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({ 
      attributes: ['id', 'email', 'name', 'isAdmin', 'isActive', 'lastLogin', 'loginCount', 'createdAt'],
      order: [['id', 'ASC']],
      include: [{
        model: Vocabulary,
        attributes: ['id', 'language'],
        include: [{
          model: Stats,
          attributes: ['presented', 'correct', 'lastReviewedDate']
        }]
      }]
    });
    
    const usersData = users.map(user => {
      const u = user.toJSON();
      let lastActivity = user.lastLogin;
      const vocabWithStats = u.Vocabularies || [];
      
      const stats = {
          it: { total: 0, learned: 0 },
          en: { total: 0, learned: 0 }
      };
      
      vocabWithStats.forEach(v => {
          const lang = v.language || 'it';
          if (!stats[lang]) stats[lang] = { total: 0, learned: 0 };
          
          stats[lang].total++;
          
          const stat = v.Stat || v.Statistic || v.Stats || v.Statistics;
          if (stat) {
              if (stat.correct > 0) stats[lang].learned++;
              if (stat.lastReviewedDate) {
                  const reviewDate = new Date(stat.lastReviewedDate);
                  if (!lastActivity || reviewDate > new Date(lastActivity)) {
                      lastActivity = reviewDate;
                  }
              }
          }
      });

      delete u.Vocabularies;
      return { ...u, stats, lastActivity };
    });

    res.json(usersData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/users/:id/toggle-active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user.id == req.params.id) return res.status(400).json({ error: 'Kann eigenen Account nicht sperren' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: 'User updated', isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user.id == req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await User.destroy({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.sendStatus(404);
    
    // MANUAL HASHING
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/base-vocab/bulk', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { words, language } = req.body;
    if (!language) return res.status(400).json({ error: 'Language required' });
    
    const transaction = await sequelize.transaction();
    try {
        // Only clear vocab for the specific language
        await BaseVocabulary.destroy({ where: { language }, transaction });
        const data = words.map(w => ({ ...w, language }));
        const created = await BaseVocabulary.bulkCreate(data, { transaction });
        await transaction.commit();
        res.json(created);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}));

app.post('/api/admin/grammar-sentences/bulk', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { sentences, language } = req.body;
    if (!language) return res.status(400).json({ error: 'Language required' });

    const transaction = await sequelize.transaction();
    try {
        await GrammarSentence.destroy({ where: { language }, transaction });
        const data = sentences.map(s => ({ ...s, language }));
        const created = await GrammarSentence.bulkCreate(data, { transaction });
        await transaction.commit();
        res.json(created);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}));

app.delete('/api/admin/grammar-sentences', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { language } = req.query;
    if (!language) return res.status(400).json({ error: 'Language required' });
    await GrammarSentence.destroy({ where: { language } });
    res.json({ message: 'Grammar sentences deleted' });
}));

app.get('/api/grammar-sentences', authenticateToken, asyncHandler(async (req, res) => {
    const { language } = req.query;
    const where = {};
    if (language) where.language = language;
    const sentences = await GrammarSentence.findAll({ where });
    res.json(sentences);
}));

app.get('/api/base-vocab', authenticateToken, asyncHandler(async (req, res) => {
    const { language } = req.query;
    const where = {};
    if (language) where.language = language;
    const baseVocab = await BaseVocabulary.findAll({ where });
    res.json(baseVocab);
}));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Central Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    const status = err.status || 500;
    res.status(status).json({ 
        error: err.message || 'Interner Serverfehler'
    });
});

// Database Sync and Listen
sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database Sync Error:', err);
});
