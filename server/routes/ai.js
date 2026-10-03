const express = require('express');
const { User, AiUsage } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');
const { loadConfig, generateSentences, PROVIDERS } = require('../utils/ai');
const { LEVELS, NEW_CATEGORIES, getCategories, isSupportedLanguage } = require('../utils/ai/grammar');

const router = express.Router();

const MAX_COUNT = 10;
const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_PREFS = { enabled: false, level: 'A1', categories: [], count: 3 };

function parsePrefs(user) {
    let stored = {};
    try { stored = user.aiPrefs ? JSON.parse(user.aiPrefs) : {}; } catch (err) { stored = {}; }
    return { ...DEFAULT_PREFS, ...stored };
}

// Einstellungen pro Sprache: Grammatikarten unterscheiden sich zwischen Italienisch und Englisch
const prefsForLanguage = (prefs, language) => ({
    enabled: prefs.enabled === true,
    level: LEVELS.includes(prefs.level) ? prefs.level : DEFAULT_PREFS.level,
    count: Number.isInteger(prefs.count) ? Math.min(MAX_COUNT, Math.max(1, prefs.count)) : DEFAULT_PREFS.count,
    categories: Array.isArray(prefs.categoriesByLang && prefs.categoriesByLang[language]) ? prefs.categoriesByLang[language] : []
});

// Verbleibende Sätze heute; Admins haben kein Limit (null)
async function remainingToday(user, dailyLimit) {
    if (user.isAdmin) return null;
    const usage = await AiUsage.findOne({ where: { UserId: user.id, day: today() } });
    return Math.max(0, dailyLimit - (usage ? usage.count : 0));
}

async function addUsage(userId, amount) {
    const [usage] = await AiUsage.findOrCreate({ where: { UserId: userId, day: today() }, defaults: { count: 0 } });
    await usage.increment('count', { by: amount });
}

// Auswahl für den Dialog: ob die Funktion aktiv ist, Niveaus, Grammatikarten, Restkontingent
router.get('/options', authenticateToken, asyncHandler(async (req, res) => {
    const language = req.query.language;
    if (!isSupportedLanguage(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });

    const [config, user] = await Promise.all([loadConfig(), User.findByPk(req.user.id)]);
    if (!user) return res.sendStatus(401);
    const ready = config.enabled && !!config.keys[config.provider];
    res.json({
        enabled: ready,
        provider: PROVIDERS[config.provider] ? PROVIDERS[config.provider].label : null,
        levels: LEVELS,
        categories: ready ? await getCategories(language) : [],
        newCategories: NEW_CATEGORIES[language],
        maxCount: MAX_COUNT,
        remaining: ready ? await remainingToday(user, config.dailyLimit) : 0,
        dailyLimit: config.dailyLimit,
        prefs: prefsForLanguage(parsePrefs(user), language)
    });
}));

// Allgemeine KI-Einstellungen des Nutzers (gelten für alle Wörter): Automatik, Niveau, Grammatikarten, Sätze pro Wort
router.put('/preferences', authenticateToken, asyncHandler(async (req, res) => {
    const { language, enabled, level, categories } = req.body;
    const count = parseInt(req.body.count, 10);
    if (!isSupportedLanguage(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Ungültige Einstellung' });
    if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Ungültiges Niveau' });
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) return res.status(400).json({ error: `Anzahl muss zwischen 1 und ${MAX_COUNT} liegen` });

    const allowed = await getCategories(language);
    const chosen = [...new Set(Array.isArray(categories) ? categories : [])].filter(c => allowed.includes(c));
    if (enabled && chosen.length === 0) return res.status(400).json({ error: 'Bitte mindestens eine Grammatikart wählen' });

    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(401);
    const stored = parsePrefs(user);
    const next = {
        enabled, level, count,
        categoriesByLang: { ...(stored.categoriesByLang || {}), [language]: chosen }
    };
    await user.update({ aiPrefs: JSON.stringify(next) });
    res.json(prefsForLanguage(next, language));
}));

router.post('/sentences', authenticateToken, asyncHandler(async (req, res) => {
    const { word, translation, language, level, categories } = req.body;
    const count = parseInt(req.body.count, 10);

    if (!isSupportedLanguage(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    if (typeof word !== 'string' || !word.trim() || word.length > 100) return res.status(400).json({ error: 'Bitte ein Wort angeben (max. 100 Zeichen)' });
    if (translation != null && (typeof translation !== 'string' || translation.length > 100)) return res.status(400).json({ error: 'Übersetzung zu lang' });
    if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Ungültiges Niveau' });
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) return res.status(400).json({ error: `Anzahl muss zwischen 1 und ${MAX_COUNT} liegen` });

    // Nur bekannte Grammatikarten zulassen, damit nichts Beliebiges in den Prompt gelangt
    const allowed = await getCategories(language);
    const chosen = [...new Set(Array.isArray(categories) ? categories : [])].filter(c => allowed.includes(c));
    if (chosen.length === 0) return res.status(400).json({ error: 'Bitte mindestens eine Grammatikart wählen' });

    const [config, user] = await Promise.all([loadConfig(), User.findByPk(req.user.id)]);
    if (!user) return res.sendStatus(401);
    const remaining = await remainingToday(user, config.dailyLimit);
    if (remaining !== null && remaining < count) {
        return res.status(429).json({ error: remaining === 0 ? 'Tageslimit für KI-Sätze erreicht' : `Heute ${remaining === 1 ? 'ist nur noch 1 Satz' : `sind nur noch ${remaining} Sätze`} möglich`, remaining });
    }

    const sentences = await generateSentences({
        word: word.trim(),
        translation: translation ? translation.trim() : null,
        language, level, categories: chosen, count
    });
    if (!user.isAdmin) await addUsage(user.id, sentences.length);

    res.json({ sentences, remaining: remaining === null ? null : remaining - sentences.length });
}));

module.exports = router;
