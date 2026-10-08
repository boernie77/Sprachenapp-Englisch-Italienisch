// Einstellungen der Nutzer (aiPrefs) und Tagesverbrauch der KI-Sätze; gemeinsam genutzt von Routen und Hintergrunddienst
const { AiUsage } = require('../../models');

const { MAX_COUNT, DEFAULT_PREFS, prefsForLanguage } = require('../../public/ai-core');
const today = () => new Date().toISOString().slice(0, 10);

function parsePrefs(user) {
    let stored = {};
    try { stored = user.aiPrefs ? JSON.parse(user.aiPrefs) : {}; } catch (err) { stored = {}; }
    return { ...DEFAULT_PREFS, ...stored };
}

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
