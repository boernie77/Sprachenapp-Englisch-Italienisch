// Hintergrunddienst: erzeugt für Nutzer mit eingeschalteter Automatik zu jedem aktiven Wort Beispielsätze.
// Ein Wort gilt als versorgt, wenn es schon in irgendeinem Satz vorkommt (eigene Sätze, KI-Sätze, globale
// Grammatiksätze). Das Erkennen der Wortformen ist eine Näherung (Artikel weg, Verbstamm, grobe Endungen).
const { Op } = require('sequelize');
const { User, Vocabulary, Stats, GrammarSentence } = require('../../models');
const { loadConfig, generateSentences } = require('./index');
const { getCategories } = require('./grammar');
const { parsePrefs, prefsForLanguage, remainingToday, addUsage } = require('./usage');

const LANGUAGES = ['it', 'en'];
const TICK_MS = 60 * 1000;
const MAX_FAILURES = 3;
const ARTICLES = { it: ['il', 'lo', 'la', 'l', 'i', 'gli', 'le', 'un', 'uno', 'una'], en: ['to', 'the', 'a', 'an'] };

let running = false;
const failedWords = new Set(); // `${userId}:${wordId}` – nach einem Fehler bis zum nächsten Serverstart nicht erneut versuchen

const tokenize = (text) => String(text || '').toLowerCase().replace(/[’']/g, ' ').split(/[^\p{L}]+/u).filter(Boolean);

// Index aller Wörter in den vorhandenen Sätzen: erste 3 Buchstaben -> Wortformen
function buildIndex(sentenceTexts) {
    const forms = new Set();
    sentenceTexts.forEach(text => tokenize(text).forEach(t => forms.add(t)));
    const byPrefix = new Map();
    forms.forEach(t => {
        const key = t.slice(0, 3);
        if (!byPrefix.has(key)) byPrefix.set(key, []);
        byPrefix.get(key).push(t);
    });
    return { forms, byPrefix };
}

function stemOf(token, language, typ) {
    if (language === 'it' && /verb/i.test(typ || '') && /(are|ere|ire)$/.test(token) && token.length > 4) return token.slice(0, -3);
    if (token.length >= 5) return token.slice(0, -1); // Mehrzahl und Endungen grob abfangen
    return token;
}

function isCovered(word, language, index) {
    let tokens = tokenize(word.it);
    if (tokens.length > 1 && ARTICLES[language].includes(tokens[0])) tokens = tokens.slice(1);
    if (tokens.length === 0) return true; // nichts Sinnvolles zu suchen
    return tokens.every(token => {
        if (index.forms.has(token)) return true;
        const stem = stemOf(token, language, word.typ);
        if (stem.length < 3 || stem === token) return false;
        return (index.byPrefix.get(stem.slice(0, 3)) || []).some(form => form.startsWith(stem) && form.length <= token.length + 3);
    });
}

// Aktive Wörter des Nutzers in dieser Sprache, die noch in keinem Satz vorkommen
async function pendingWords(userId, language) {
    const [sentences, base, words] = await Promise.all([
        Vocabulary.findAll({ where: { UserId: userId, language, typ: 'Satz' }, attributes: ['it'], raw: true }),
        GrammarSentence.findAll({ where: { language }, attributes: ['it'], raw: true }),
        Vocabulary.findAll({
            where: { UserId: userId, language, isActive: true, typ: { [Op.or]: [{ [Op.ne]: 'Satz' }, { [Op.is]: null }] } },
            attributes: ['id', 'it', 'de', 'typ'],
            order: [['id', 'ASC']],
            raw: true
        })
    ]);
    const index = buildIndex([...sentences, ...base].map(s => s.it));
    return words.filter(w => w.it && w.it.length <= 100 && !isCovered(w, language, index) && !failedWords.has(`${userId}:${w.id}`));
}

async function processUser(userId, language, config) {
    const allowed = await getCategories(language);
    let failures = 0;
    const words = await pendingWords(userId, language);

    for (const word of words) {
        const user = await User.findByPk(userId); // frisch lesen: Abschalten wirkt sofort
        if (!user || user.isActive === false) return;
        const prefs = prefsForLanguage(parsePrefs(user), language);
        const categories = prefs.categories.filter(c => allowed.includes(c));
        if (!prefs.enabled || categories.length === 0) return;

        const remaining = await remainingToday(user, config.dailyLimit);
        if (remaining !== null && remaining < prefs.count) return; // Tageslimit: morgen weiter

        try {
            const { sentences, usage } = await generateSentences({
                word: word.it, translation: word.de || null, language,
                levels: prefs.levels, categories, count: prefs.count
            });
            if (user.isAdmin) {
                // Admin-Sätze gelten für alle Nutzer (globale Liste); jeder Nutzer kann sie in seiner Satzliste abwählen
                await GrammarSentence.bulkCreate(sentences.map(s => ({
                    it: s.foreign, de: s.german, category: s.category, level: s.level, forWord: word.it, language
                })));
            } else {
                const rows = await Vocabulary.bulkCreate(sentences.map(s => ({
                    de: s.german, it: s.foreign, typ: 'Satz', emoji: '', grammatica: s.category, level: s.level,
                    forWord: word.it, isActive: true, isMarked: false, isOwn: true, language, UserId: userId
                })), { returning: true });
                await Stats.bulkCreate(rows.map(r => ({ VocabularyId: r.id })));
            }
            await addUsage(userId, sentences.length, usage);
            failures = 0;
        } catch (err) {
            console.warn(`KI-Automatik: Wort "${word.it}" (Nutzer ${userId}) fehlgeschlagen: ${err.message}`);
            failedWords.add(`${userId}:${word.id}`);
            if (++failures >= MAX_FAILURES) return;
        }
    }
}

async function runOnce() {
    if (running) return;
    running = true;
    try {
        const config = await loadConfig();
        if (!config.enabled || !config.keys[config.provider]) return;
        const users = await User.findAll({ where: { aiPrefs: { [Op.ne]: null }, isActive: { [Op.ne]: false } }, attributes: ['id', 'aiPrefs'] });
        for (const user of users) {
            if (parsePrefs(user).enabled !== true) continue;
            for (const language of LANGUAGES) await processUser(user.id, language, config);
        }
    } catch (err) {
        console.warn('KI-Automatik abgebrochen:', err.message);
    } finally {
        running = false;
    }
}

// Sofort anstoßen (z.B. nach dem Speichern der Einstellungen), ohne den Aufrufer warten zu lassen
const trigger = () => { setImmediate(runOnce); };

function start() {
    setTimeout(runOnce, 20 * 1000);
    setInterval(runOnce, TICK_MS);
}

module.exports = { start, trigger, pendingWords };
