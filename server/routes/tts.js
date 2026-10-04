const express = require('express');
const { User } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');
const tts = require('../utils/tts');

const router = express.Router();
const service = tts.createService({ store: tts.dbStore });
const allow = tts.createRateLimiter(40, 60000); // 40 Anfragen pro Minute und Nutzer

// Ob eine Cloudstimme angeboten wird (ohne Schlüssel nie)
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
    const config = await tts.loadConfig();
    const available = tts.isAvailable(config);
    res.json({ available, provider: available ? config.provider : null });
}));

// Text -> MP3 (Zwischenspeicher auf Platte, Tageslimit für neue Aufrufe). Kein 403 (das Frontend meldet bei 403 ab).
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    if (!allow(req.user.id)) return res.status(429).json({ error: 'Zu viele Anfragen, bitte kurz warten' });
    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(401);
    const { text, lang } = req.body || {};
    try {
        const { audio, cached } = await service.synthesize({ text, lang, user, config: await tts.loadConfig() });
        res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400', 'X-Tts-Cached': cached ? '1' : '0' });
        res.send(audio);
    } catch (err) {
        if (err instanceof tts.TtsError) return res.status(err.status).json({ error: err.message });
        throw err;
    }
}));

module.exports = router;
