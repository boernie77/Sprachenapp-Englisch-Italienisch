const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, Vocabulary, Stats, InviteCode, BaseVocabulary, GrammarSentence, sequelize } = require('../models');
const { authenticateToken, requireAdmin, asyncHandler } = require('../middleware/auth');
const transporter = require('../utils/mailer');

const router = express.Router();

router.get('/invite-codes', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const codes = await InviteCode.findAll({
        include: [{ model: User, as: 'usedByUser', attributes: ['email'] }],
        order: [['createdAt', 'DESC']]
    });
    res.json(codes);
}));

router.post('/invite-codes', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { count = 1 } = req.body;
    const created = [];
    for (let i = 0; i < count; i++) {
        const code = `ITA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const newCode = await InviteCode.create({ code });
        created.push(newCode);
    }
    res.status(201).json(created);
}));

router.post('/invite-codes/send', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
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

router.delete('/invite-codes/:code', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const result = await InviteCode.destroy({ where: { code: req.params.code, isUsed: false } });
    if (!result) return res.status(400).json({ error: 'Code kann nicht gelöscht werden (existiert nicht oder bereits verwendet)' });
    res.json({ message: 'Code gelöscht' });
}));

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
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
          
          const stat = v.Stat || v.Stats || v.Statistic || v.Statistics;
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

router.put('/users/:id/toggle-active', authenticateToken, requireAdmin, async (req, res) => {
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

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user.id == req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await User.destroy({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
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

router.post('/base-vocab/bulk', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { words, language } = req.body;
    if (!language) return res.status(400).json({ error: 'Language required' });
    
    const transaction = await sequelize.transaction();
    try {
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

router.post('/grammar-sentences/bulk', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
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

router.delete('/grammar-sentences', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { language } = req.query;
    if (!language) return res.status(400).json({ error: 'Language required' });
    await GrammarSentence.destroy({ where: { language } });
    res.json({ message: 'Grammar sentences deleted' });
}));

module.exports = router;
