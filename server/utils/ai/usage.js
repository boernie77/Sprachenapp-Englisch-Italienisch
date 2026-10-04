// Einstellungen der Nutzer (aiPrefs) und Tagesverbrauch der KI-Sätze; gemeinsam genutzt von Routen und Hintergrunddienst
const { AiUsage } = require('../../models');
const { LEVELS } = require('./grammar');

const MAX_COUNT = 10;
const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_PREFS = { enabled: false, levels: ['A1'], categories: [], count: 3 };

// Frühere Einstellungen kannten nur ein Niveau (level)
function storedLevels(prefs) {
    const raw = Array.isArray(prefs.levels) ? prefs.levels : (prefs.level ? [prefs.level] : []);
    const valid = LEVELS.filter(l => raw.includes(l));
    return valid.length ? valid : DEFAULT_PREFS.levels;
}

function parsePrefs(user) {
    let stored = {};
    try { stored = user.aiPrefs ? JSON.parse(user.aiPrefs) : {}; } catch (err) { stored = {}; }
    return { ...DEFAULT_PREFS, ...stored };
}

// Einstellungen pro Sprache: Grammatikarten unterscheiden sich zwischen Italienisch und Englisch
const prefsForLanguage = (prefs, language) => ({
    enabled: prefs.enabled === true,
    levels: storedLevels(prefs),
    count: Number.isInteger(prefs.count) ? Math.min(MAX_COUNT, Math.max(1, prefs.count)) : DEFAULT_PREFS.count,
    categories: Array.isArray(prefs.categoriesByLang && prefs.categoriesByLang[language]) ? prefs.categoriesByLang[language] : []
});

// Verbleibende Sätze heute; Admins haben kein Limit (null)
async function remainingToday(user, dailyLimit) {
    if (user.isAdmin) return null;
    const usage = await AiUsage.findOne({ where: { UserId: user.id, day: today() } });
    return Math.max(0, dailyLimit - (usage ? usage.count : 0));
}

async function addUsage(userId, sentences, usage, lookups = 0) {
    const [row] = await AiUsage.findOrCreate({ where: { UserId: userId, day: today() }, defaults: { count: 0 } });
    await row.increment({
        count: sentences,
        calls: 1,
        lookups,
        inputTokens: usage.input,
        outputTokens: usage.output,
        costUsd: usage.costUsd || 0
    });
}

// Verbleibende KI-Wortinfo-Abfragen heute; Admins unbegrenzt (null)
async function remainingLookups(user, lookupLimit) {
    if (user.isAdmin) return null;
    const row = await AiUsage.findOne({ where: { UserId: user.id, day: today() } });
    return Math.max(0, lookupLimit - (row ? row.lookups : 0));
}

module.exports = { remainingLookups, MAX_COUNT, DEFAULT_PREFS, parsePrefs, prefsForLanguage, remainingToday, addUsage };
