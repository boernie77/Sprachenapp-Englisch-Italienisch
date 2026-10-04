const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, Vocabulary, Stats, InviteCode, BaseVocabulary, GrammarSentence, sequelize } = require('../models');
const ai = require('../utils/ai');
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
    const [users] = await Promise.all([
      User.findAll({
        attributes: ['id', 'email', 'name', 'isAdmin', 'isActive', 'lastLogin', 'lastLearnAt', 'loginCount', 'createdAt'],
        order: [['id', 'ASC']],
        include: [{
          model: Vocabulary,
          attributes: ['id', 'language', 'typ'],
          include: [{
            model: Stats,
            attributes: ['presented', 'correct', 'lastReviewedDate']
          }]
        }]
      }),
    ]);

    const usersData = users.map(user => {
      const u = user.toJSON();
      let lastActivity = user.lastLogin;
      const vocabWithStats = u.Vocabularies || [];

      const stats = {
          it: { total: 0, learned: 0 },
          en: { total: 0, learned: 0 }
      };

      vocabWithStats.forEach(v => {
          if (v.typ === 'Satz') return;
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

router.put('/users/:id/toggle-admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isAdmin) {
      const adminCount = await User.count({ where: { isAdmin: true } });
      if (adminCount <= 1) return res.status(400).json({ error: 'Mindestens ein Admin muss vorhanden sein' });
    }
    user.isAdmin = !user.isAdmin;
    await user.save();
    res.json({ message: 'Admin-Status aktualisiert', isAdmin: user.isAdmin });
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

router.put('/users/:id/name', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { name } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName || trimmedName.length > 100) {
        return res.status(400).json({ error: 'Ungültiger Name (1-100 Zeichen erforderlich)' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.name = trimmedName;
    await user.save();
    res.json({ message: 'Name aktualisiert', name: user.name });
}));

router.post('/base-vocab/bulk', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { words, language, mode } = req.body;
    if (!language) return res.status(400).json({ error: 'Language required' });
    
    const transaction = await sequelize.transaction();
    try {
        if (mode !== 'append') {
            await BaseVocabulary.destroy({ where: { language }, transaction });
        }
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
    const { sentences, language, mode } = req.body;
    if (!language) return res.status(400).json({ error: 'Language required' });

    const transaction = await sequelize.transaction();
    try {
        if (mode === 'overwrite-all') {
            // Vollständige Sicherung (Datei enthält KI-Sätze mit Wort): alles ersetzen, keine Doppelten
            await GrammarSentence.destroy({ where: { language }, transaction });
        } else if (mode !== 'append') {
            // Reine Excel-Liste ohne KI-Sätze: vorhandene KI-Sätze (forWord gesetzt) bleiben erhalten
            await GrammarSentence.destroy({ where: { language, forWord: null }, transaction });
        }
        const data = sentences.map(s => ({ it: s.it, de: s.de, category: s.category, level: s.level, forWord: s.forWord || null, language }));
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
    // KI-Sätze (forWord gesetzt) bleiben erhalten, damit sie nicht neu bezahlt werden müssen
    await GrammarSentence.destroy({ where: { language, forWord: null } });
    res.json({ message: 'Grammar sentences deleted' });
}));

// --- KI-Einstellungen ---
// Der API-Schlüssel wird nur geschrieben, nie zurückgegeben (nur "hinterlegt ••••1234").

router.get('/ai-settings', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    res.json(ai.publicConfig(await ai.loadConfig()));
}));

router.put('/ai-settings', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { provider, model, enabled, dailyLimit, lookupLimit, apiKey, clearKey, usdToEur } = req.body;
    const config = await ai.loadConfig();

    if (provider !== undefined) {
        ai.getProvider(provider); // wirft bei unbekanntem Anbieter
        config.provider = provider;
    }
    const target = provider || config.provider;

    if (model !== undefined) {
        if (typeof model !== 'string' || !/^[\w.:\-\/]{1,100}$/.test(model.trim())) return res.status(400).json({ error: 'Ungültiger Modellname' });
        config.models[target] = model.trim();
    }
    if (enabled !== undefined) config.enabled = enabled === true;
    if (dailyLimit !== undefined) {
        const limit = parseInt(dailyLimit, 10);
        if (!Number.isInteger(limit) || limit < 0 || limit > 1000) return res.status(400).json({ error: 'Tageslimit muss zwischen 0 und 1000 liegen' });
        config.dailyLimit = limit;
    }
    if (lookupLimit !== undefined) {
        const limit = parseInt(lookupLimit, 10);
        if (!Number.isInteger(limit) || limit < 0 || limit > 5000) return res.status(400).json({ error: 'Limit für Wortinfo muss zwischen 0 und 5000 liegen' });
        config.lookupLimit = limit;
    }
    if (usdToEur !== undefined) {
        const rate = Number(usdToEur);
        if (!(rate > 0 && rate < 10)) return res.status(400).json({ error: 'Umrechnungskurs muss zwischen 0 und 10 liegen' });
        config.usdToEur = rate;
    }
    if (clearKey === true) delete config.keys[target];
    if (typeof apiKey === 'string' && apiKey.trim()) {
        if (apiKey.trim().length > 500) return res.status(400).json({ error: 'API-Schlüssel zu lang' });
        config.keys[target] = ai.encrypt(apiKey.trim());
    }

    await ai.saveConfig(config);
    res.json(ai.publicConfig(config));
}));

// Verbrauch und Kosten der KI-Sätze: heute, letzte 30 Tage, gesamt und je Nutzer (30 Tage)
router.get('/ai-usage', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { AiUsage, User } = require('../models');
    const { fn, col, Op } = require('sequelize');
    const sums = [
        [fn('SUM', col('AiUsage.count')), 'sentences'], [fn('SUM', col('AiUsage.calls')), 'calls'],
        [fn('SUM', col('AiUsage.inputTokens')), 'inputTokens'], [fn('SUM', col('AiUsage.outputTokens')), 'outputTokens'],
        [fn('SUM', col('AiUsage.costUsd')), 'costUsd']
    ];
    const toNumbers = (row) => Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, Number(v) || 0]));
    const dayString = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    const period = async (since) => toNumbers(await AiUsage.findOne({ attributes: sums, where: since ? { day: { [Op.gte]: since } } : {}, raw: true }));

    const perUser = await AiUsage.findAll({
        attributes: ['UserId', ...sums],
        where: { day: { [Op.gte]: dayString(29) } },
        include: [{ model: User, attributes: ['email'] }],
        group: ['AiUsage.UserId', 'User.id'],
        order: [[fn('SUM', col('AiUsage.costUsd')), 'DESC'], [fn('SUM', col('AiUsage.count')), 'DESC']],
        limit: 20,
        raw: true
    });

    res.json({
        today: await period(dayString(0)),
        last30: await period(dayString(29)),
        total: await period(null),
        perUser: perUser.map(r => ({ email: r['User.email'], ...toNumbers({ sentences: r.sentences, calls: r.calls, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd }) }))
    });
}));

// Kostenvorschau für ein (noch nicht gespeichertes) Modell: pro Aufruf, pro Wort und pro Satz, mit den Einstellungen des Admins
router.get('/ai-estimate', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { estimateCall } = require('../utils/ai/estimate');
    const { parsePrefs, prefsForLanguage } = require('../utils/ai/usage');
    const auto = require('../utils/ai/autoGenerate');
    const language = ['it', 'en'].includes(req.query.language) ? req.query.language : 'it';
    const config = await ai.loadConfig();
    const model = String(req.query.model || config.models[config.provider]).slice(0, 100);
    const currentModel = config.models[req.query.provider || config.provider];
    const admin = await User.findByPk(req.user.id);
    const prefs = prefsForLanguage(parsePrefs(admin), language);
    const call = await estimateCall(model, prefs.count, currentModel);
    const [pending, backfill] = await Promise.all([auto.pendingWords(admin.id, language), auto.backfillCandidates(admin.id, language, prefs.levels)]);
    const eur = (usd) => (usd === null ? null : usd * config.usdToEur);
    res.json({
        model, basis: call.basis, count: prefs.count,
        priceKnown: call.costUsd !== null,
        perWordEur: eur(call.costUsd),
        perSentenceEur: call.costUsd === null ? null : eur(call.costUsd) / prefs.count,
        pendingWords: pending.length, backfillWords: backfill.length,
        pendingEur: eur(call.costUsd === null ? null : call.costUsd * pending.length),
        backfillEur: eur(call.costUsd === null ? null : call.costUsd * backfill.length)
    });
}));

// Prüft Schlüssel + Modell des gewählten Anbieters mit einem kostenlosen Modell-Abruf
router.post('/ai-settings/test', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const config = await ai.loadConfig();
    const providerId = req.body.provider || config.provider;
    const provider = ai.getProvider(providerId);
    const apiKey = ai.getApiKey(config, providerId);
    if (!apiKey) return res.status(400).json({ error: config.keys[providerId] ? 'Gespeicherter Schlüssel lässt sich nicht mehr entschlüsseln (JWT_SECRET geändert?). Bitte neu eintragen.' : 'Kein API-Schlüssel hinterlegt' });
    const model = config.models[providerId];
    await provider.checkModel({ apiKey, model });
    res.json({ ok: true, message: `Verbindung zu ${provider.label} funktioniert, Modell ${model} ist verfügbar.` });
}));

router.get('/ai-settings/models', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const config = await ai.loadConfig();
    const providerId = req.query.provider || config.provider;
    const provider = ai.getProvider(providerId);
    const apiKey = ai.getApiKey(config, providerId);
    if (!apiKey) return res.json({ models: provider.suggestedModels.map(id => ({ id, name: id })), fromProvider: false });
    res.json({ models: await provider.listModels({ apiKey }), fromProvider: true });
}));

module.exports = router;
