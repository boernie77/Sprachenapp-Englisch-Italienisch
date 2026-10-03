const express = require('express');
const { User } = require('../models');
const { authenticateToken, asyncHandler } = require('../middleware/auth');
const { loadConfig, generateSentences, PROVIDERS } = require('../utils/ai');
const { LEVELS, NEW_CATEGORIES, getCategories, isSupportedLanguage } = require('../utils/ai/grammar');
const { MAX_COUNT, parsePrefs, prefsForLanguage, remainingToday, addUsage } = require('../utils/ai/usage');
const auto = require('../utils/ai/autoGenerate');

const router = express.Router();

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
    const { language, enabled, categories } = req.body;
    const levels = LEVELS.filter(l => Array.isArray(req.body.levels) && req.body.levels.includes(l));
    const count = parseInt(req.body.count, 10);
    if (!isSupportedLanguage(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Ungültige Einstellung' });
    if (levels.length === 0) return res.status(400).json({ error: 'Bitte mindestens ein Niveau wählen' });
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) return res.status(400).json({ error: `Anzahl muss zwischen 1 und ${MAX_COUNT} liegen` });

    const allowed = await getCategories(language);
    const chosen = [...new Set(Array.isArray(categories) ? categories : [])].filter(c => allowed.includes(c));
    if (enabled && chosen.length === 0) return res.status(400).json({ error: 'Bitte mindestens eine Grammatikart wählen' });

    const user = await User.findByPk(req.user.id);
    if (!user) return res.sendStatus(401);
    const stored = parsePrefs(user);
    const next = {
        enabled, levels, count,
        categoriesByLang: { ...(stored.categoriesByLang || {}), [language]: chosen }
    };
    await user.update({ aiPrefs: JSON.stringify(next) });
    if (enabled) auto.trigger(); // Hintergrunddienst sofort starten, nicht erst beim nächsten Durchlauf
    res.json(prefsForLanguage(next, language));
}));

// Wie viele aktive Wörter noch in keinem Satz vorkommen (der Server erzeugt die Sätze selbst im Hintergrund)
router.get('/auto-status', authenticateToken, asyncHandler(async (req, res) => {
    const language = req.query.language;
    if (!isSupportedLanguage(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    res.json({ pending: (await auto.pendingWords(req.user.id, language)).length });
}));

router.post('/sentences', authenticateToken, asyncHandler(async (req, res) => {
    const { word, translation, language, categories } = req.body;
    const levels = LEVELS.filter(l => Array.isArray(req.body.levels) && req.body.levels.includes(l));
    const count = parseInt(req.body.count, 10);

    if (!isSupportedLanguage(language)) return res.status(400).json({ error: 'Sprache nicht unterstützt' });
    if (typeof word !== 'string' || !word.trim() || word.length > 100) return res.status(400).json({ error: 'Bitte ein Wort angeben (max. 100 Zeichen)' });
    if (translation != null && (typeof translation !== 'string' || translation.length > 100)) return res.status(400).json({ error: 'Übersetzung zu lang' });
    if (levels.length === 0) return res.status(400).json({ error: 'Bitte mindestens ein Niveau wählen' });
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

    const { sentences, usage } = await generateSentences({
        word: word.trim(),
        translation: translation ? translation.trim() : null,
        language, levels, categories: chosen, count
    });
    await addUsage(user.id, sentences.length, usage); // auch Admins: Verbrauch und Kosten werden immer gezählt

    res.json({ sentences, remaining: remaining === null ? null : remaining - sentences.length });
}));

module.exports = router;
