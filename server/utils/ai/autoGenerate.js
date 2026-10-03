// Hintergrunddienst: erzeugt für Nutzer mit eingeschalteter Automatik zu jedem aktiven Wort Beispielsätze.
// Ein Wort gilt als versorgt, wenn es schon in irgendeinem Satz vorkommt (eigene Sätze und die globale Liste, egal wer
// sie erzeugt hat) – so wird für dasselbe Wort nie doppelt erzeugt. Das Erkennen der Wortformen ist eine Näherung (Artikel weg, Verbstamm, grobe Endungen).
const { Op } = require('sequelize');
const { User, Vocabulary, GrammarSentence } = require('../../models');
const { loadConfig, generateSentences } = require('./index');
const { getCategories } = require('./grammar');
const { parsePrefs, prefsForLanguage, remainingToday, addUsage } = require('./usage');

const LANGUAGES = ['it', 'en'];
const TICK_MS = 60 * 1000;
const MAX_FAILURES = 3;
const BULK_THRESHOLD = 50; // ab so vielen offenen Wörtern startet die Automatik erst nach Freigabe durch den Nutzer
const ARTICLES = { it: ['il', 'lo', 'la', 'l', 'i', 'gli', 'le', 'un', 'uno', 'una'], en: ['to', 'the', 'a', 'an'] };

let running = false;
const bulkConfirmed = new Set(); // `${userId}:${language}` – freigegebene große Mengen; endet, wenn keine Wörter mehr offen sind
const backfillRequests = new Set(); // `${userId}:${language}` – vom Nutzer angestoßenes Nachrüsten fehlender Niveaus
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

// Fremdwort ohne Artikel, klein geschrieben (gleicher Schlüssel für "la casa" und "casa")
function wordKey(text, language) {
    const tokens = tokenize(text);
    if (tokens.length > 1 && ARTICLES[language].includes(tokens[0])) tokens.shift();
    return tokens.join(' ');
}

// Aktive Wörter, zu denen es schon KI-Sätze gibt, aber nicht in allen gewählten Niveaus: [{ ...Wort, missing: [Niveaus] }]
async function backfillCandidates(userId, language, levels) {
    const [kiSentences, words] = await Promise.all([
        GrammarSentence.findAll({ where: { language, forWord: { [Op.ne]: null } }, attributes: ['forWord', 'level'], raw: true }),
        Vocabulary.findAll({
            where: { UserId: userId, language, isActive: true, typ: { [Op.or]: [{ [Op.ne]: 'Satz' }, { [Op.is]: null }] } },
            attributes: ['id', 'it', 'de', 'typ'], order: [['id', 'ASC']], raw: true
        })
    ]);
    const levelsByWord = new Map();
    kiSentences.forEach(s => {
        const key = wordKey(s.forWord, language);
        if (!levelsByWord.has(key)) levelsByWord.set(key, new Set());
        levelsByWord.get(key).add(s.level);
    });
    const result = [];
    words.forEach(w => {
        const have = levelsByWord.get(wordKey(w.it, language));
        if (!have || !w.it || w.it.length > 100 || failedWords.has(`${userId}:${w.id}`)) return;
        const missing = levels.filter(l => !have.has(l));
        if (missing.length > 0) result.push({ ...w, missing });
    });
    return result;
}

async function processUser(userId, language, config) {
    const allowed = await getCategories(language);
    let failures = 0;
    const words = await pendingWords(userId, language);
    const bulkKey = `${userId}:${language}`;
    if (words.length === 0) bulkConfirmed.delete(bulkKey);
    if (words.length > BULK_THRESHOLD && !bulkConfirmed.has(bulkKey)) return; // große Menge: erst nach Freigabe im KI-Dialog

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
            // KI-Sätze erweitern immer die globale Liste; ob sie für einen Nutzer aktiv sind, hängt von dessen Satz-Modus ab
            await GrammarSentence.bulkCreate(sentences.map(s => ({
                it: s.foreign, de: s.german, category: s.category, level: s.level, forWord: word.it, language
            })));
            await addUsage(userId, sentences.length, usage);
            failures = 0;
        } catch (err) {
            console.warn(`KI-Automatik: Wort "${word.it}" (Nutzer ${userId}) fehlgeschlagen: ${err.message}`);
            failedWords.add(`${userId}:${word.id}`);
            if (++failures >= MAX_FAILURES) return;
        }
    }
}

// Erzeugt für Wörter mit KI-Sätzen die fehlenden Niveaus nach (mit den gespeicherten Einstellungen)
async function processBackfill(userId, language, config) {
    const allowed = await getCategories(language);
    let failures = 0;
    let limitReached = false;
    const first = await User.findByPk(userId);
    if (!first) return true;
    const startPrefs = prefsForLanguage(parsePrefs(first), language);
    const words = await backfillCandidates(userId, language, startPrefs.levels);

    for (const word of words) {
        const user = await User.findByPk(userId);
        if (!user || user.isActive === false) return true;
        const prefs = prefsForLanguage(parsePrefs(user), language);
        const categories = prefs.categories.filter(c => allowed.includes(c));
        if (categories.length === 0) return true;
        const levels = word.missing.filter(l => prefs.levels.includes(l));
        if (levels.length === 0) continue;

        const remaining = await remainingToday(user, config.dailyLimit);
        if (remaining !== null && remaining < prefs.count) { limitReached = true; break; } // morgen weiter

        try {
            const { sentences, usage } = await generateSentences({
                word: word.it, translation: word.de || null, language, levels, categories, count: prefs.count
            });
            await GrammarSentence.bulkCreate(sentences.map(s => ({
                it: s.foreign, de: s.german, category: s.category, level: s.level, forWord: word.it, language
            })));
            await addUsage(userId, sentences.length, usage);
            failures = 0;
        } catch (err) {
            console.warn(`KI-Nachrüsten: Wort "${word.it}" (Nutzer ${userId}) fehlgeschlagen: ${err.message}`);
            failedWords.add(`${userId}:${word.id}`);
            if (++failures >= MAX_FAILURES) return true;
        }
    }
    return !limitReached; // bei Tageslimit bleibt die Anfrage bestehen und läuft am nächsten Tag weiter
}

async function runOnce() {
    if (running) return;
    running = true;
    try {
        const config = await loadConfig();
        if (!config.enabled || !config.keys[config.provider]) return;
        const users = await User.findAll({ where: { aiPrefs: { [Op.ne]: null }, isActive: { [Op.ne]: false } }, attributes: ['id', 'aiPrefs'] });
        for (const user of users) {
            const autoOn = parsePrefs(user).enabled === true;
            for (const language of LANGUAGES) {
                if (autoOn) await processUser(user.id, language, config);
                const requestKey = `${user.id}:${language}`;
                if (backfillRequests.has(requestKey) && await processBackfill(user.id, language, config)) backfillRequests.delete(requestKey);
            }
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

const needsBulkConfirmation = (userId, language, pendingCount) => pendingCount > BULK_THRESHOLD && !bulkConfirmed.has(`${userId}:${language}`);
const confirmBulk = (userId, language) => { bulkConfirmed.add(`${userId}:${language}`); trigger(); };
const requestBackfill = (userId, language) => { backfillRequests.add(`${userId}:${language}`); trigger(); };

module.exports = { start, trigger, pendingWords, backfillCandidates, requestBackfill, needsBulkConfirmation, confirmBulk, BULK_THRESHOLD };
