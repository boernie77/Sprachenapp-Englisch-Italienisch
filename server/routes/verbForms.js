const express = require('express');
const { Op } = require('sequelize');
const { VerbForm } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');

const router = express.Router();

// Geprüfte Verbformen für die App. Mit ?since=<ISO-Zeit> nur Änderungen seitdem (inkl. verworfener/ungültiger Verben,
// damit die App lokale Einträge entfernen kann).
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const language = ['it', 'en'].includes(req.query.language) ? req.query.language : 'it';
    const now = new Date().toISOString(); // vor der Abfrage: spätere Änderungen kommen beim nächsten Mal
    const where = { language };
    const since = req.query.since ? new Date(req.query.since) : null;
    if (since && !isNaN(since)) where.updatedAt = { [Op.gt]: since };
    else where.status = 'verified';
    const rows = await VerbForm.findAll({ where, attributes: ['infinitive', 'forms', 'status', 'updatedAt'], raw: true });
    res.json({
        now,
        verbs: rows.map(r => ({ infinitive: r.infinitive, status: r.status, forms: r.status === 'verified' && r.forms ? JSON.parse(r.forms) : null }))
    });
}));

module.exports = router;
