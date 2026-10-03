const express = require('express');
const { Op } = require('sequelize');
const { User, GrammarSentence, SentenceChoice } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');

const router = express.Router();

// Voreinstellung im manuellen Modus: Excel-Sätze aktiv, KI-Sätze (mit forWord) erst, wenn der Nutzer sie auswählt
const defaultActive = (sentence) => !sentence.forWord;

// Globale Sätze mit der manuellen Auswahl des Nutzers (manualActive); im Automatik-Modus entscheidet das Frontend nach den aktiven Wörtern
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { language } = req.query;
    const where = {};
    if (language) where.language = language;
    const [sentences, choices] = await Promise.all([
        GrammarSentence.findAll({ where, raw: true }),
        SentenceChoice.findAll({ where: { UserId: req.user.id }, attributes: ['GrammarSentenceId', 'isActive'], raw: true })
    ]);
    const chosen = new Map(choices.map(c => [c.GrammarSentenceId, c.isActive]));
    res.json(sentences.map(s => ({ ...s, manualActive: chosen.has(s.id) ? chosen.get(s.id) : defaultActive(s) })));
}));

router.get('/settings', authenticateToken, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id, { attributes: ['sentenceMode'] });
    res.json({ mode: user && user.sentenceMode === 'manual' ? 'manual' : 'auto' });
}));

// Modus umschalten. Wechselt ein Nutzer zum ersten Mal auf manuell (noch keine gespeicherte Auswahl für KI-Sätze),
// übernimmt activeIds den aktuellen Automatik-Zustand, damit sich für ihn nichts plötzlich ändert.
router.put('/settings', authenticateToken, asyncHandler(async (req, res) => {
    const { mode, language, activeIds } = req.body;
    if (!['auto', 'manual'].includes(mode)) return res.status(400).json({ error: 'Ungültiger Modus' });
    await User.update({ sentenceMode: mode }, { where: { id: req.user.id } });

    if (mode === 'manual' && language && Array.isArray(activeIds)) {
        const kiIds = (await GrammarSentence.findAll({ where: { language, forWord: { [Op.ne]: null } }, attributes: ['id'], raw: true })).map(r => r.id);
        const stored = await SentenceChoice.count({ where: { UserId: req.user.id, GrammarSentenceId: { [Op.in]: kiIds } } });
        if (stored === 0) {
            const valid = new Set(kiIds);
            const rows = activeIds.map(Number).filter(id => valid.has(id)).map(id => ({ UserId: req.user.id, GrammarSentenceId: id, isActive: true }));
            await SentenceChoice.bulkCreate(rows, { ignoreDuplicates: true });
        }
    }
    res.json({ mode });
}));

// Globale Sätze für diesen Nutzer an- oder abwählen (manueller Modus): { ids: [...] } oder { all: true, language }
router.put('/active', authenticateToken, asyncHandler(async (req, res) => {
    const { isActive, all, language } = req.body;
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be boolean' });

    const where = {};
    if (all === true) {
        if (!language) return res.status(400).json({ error: 'Language required' });
        where.language = language;
    } else {
        const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
        if (ids.length === 0 || ids.length > 20000) return res.status(400).json({ error: 'Ungültige Satzliste' });
        where.id = { [Op.in]: ids };
    }
    const sentences = await GrammarSentence.findAll({ where, attributes: ['id', 'forWord'], raw: true });
    const ids = sentences.map(s => s.id);

    // Nur Abweichungen von der Voreinstellung speichern
    await SentenceChoice.destroy({ where: { UserId: req.user.id, GrammarSentenceId: { [Op.in]: ids } } });
    await SentenceChoice.bulkCreate(sentences
        .filter(s => defaultActive(s) !== isActive)
        .map(s => ({ UserId: req.user.id, GrammarSentenceId: s.id, isActive })));
    res.json({ changed: ids.length });
}));

module.exports = router;
