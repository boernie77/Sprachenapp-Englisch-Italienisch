const express = require('express');
const { Op } = require('sequelize');
const { GrammarSentence, DisabledSentence } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { language } = req.query;
    const where = {};
    if (language) where.language = language;
    const sentences = await GrammarSentence.findAll({ where });
    res.json(sentences);
}));

// IDs der globalen Sätze, die dieser Nutzer abgewählt hat
router.get('/disabled', authenticateToken, asyncHandler(async (req, res) => {
    const rows = await DisabledSentence.findAll({ where: { UserId: req.user.id }, attributes: ['GrammarSentenceId'], raw: true });
    res.json(rows.map(r => r.GrammarSentenceId));
}));

// Globale Sätze für diesen Nutzer an- oder abwählen: { ids: [...] } oder { all: true, language }
router.put('/active', authenticateToken, asyncHandler(async (req, res) => {
    const { isActive, all, language } = req.body;
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be boolean' });

    const where = {};
    if (all === true) {
        if (!language) return res.status(400).json({ error: 'Language required' });
        where.language = language;
    } else {
        const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
        if (ids.length === 0 || ids.length > 5000) return res.status(400).json({ error: 'Ungültige Satzliste' });
        where.id = { [Op.in]: ids };
    }
    const ids = (await GrammarSentence.findAll({ where, attributes: ['id'], raw: true })).map(r => r.id);

    if (isActive) {
        await DisabledSentence.destroy({ where: { UserId: req.user.id, GrammarSentenceId: { [Op.in]: ids } } });
    } else {
        await DisabledSentence.bulkCreate(ids.map(id => ({ UserId: req.user.id, GrammarSentenceId: id })), { ignoreDuplicates: true });
    }
    res.json({ changed: ids.length });
}));

module.exports = router;
