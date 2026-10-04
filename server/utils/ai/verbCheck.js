// KI-Prüfung der Verbformen: jedes Verb (Basis-Vokabeln und Nutzerlisten, Italienisch und Englisch) wird einmal geprüft,
// das Ergebnis gilt für alle. Bereits geprüfte (und ungültige oder verworfene) Verben werden übersprungen.
const { Op } = require('sequelize');
const { User, Vocabulary, BaseVocabulary, VerbForm } = require('../../models');
const { loadConfig, getProvider, getApiKey } = require('./index');
const { costUsd } = require('./pricing');
const { addUsage } = require('./usage');

const LANGUAGES = ['it', 'en'];
const BATCH_SIZE = 15;
const BULK_THRESHOLD = 50; // ab so vielen offenen Verben fragt der Admin-Bereich erst nach Freigabe
const MAX_FAILURES = 3;
const THINKING_MODELS = /^claude-(opus|sonnet|fable|mythos)-5/;

const confirmed = new Set(); // Sprachen mit Freigabe des Admins (bis nichts mehr offen ist; verfällt beim Neustart)
let running = false;

// Grundform wie im Frontend: italienisch -rsi → Grundverb, englisch ohne "to"; null, wenn kein einzelnes Verbwort
function normalizeInfinitive(raw, language) {
    let inf = String(raw || '').toLowerCase().trim();
    if (language === 'en') {
        inf = inf.replace(/^to\s+/, '');
        return /^[a-z]+(-[a-z]+)?$/.test(inf) && inf.length >= 2 ? inf : null;
    }
    if (!/^[a-zàèéìòù]+$/.test(inf)) return null;
    if (/rsi$/.test(inf)) {
        inf = inf.slice(0, -3) + 're';
        if (/(po|tra|du)re$/.test(inf)) inf = inf.slice(0, -2) + 'rre';
    }
    return /(are|ere|ire|rre)$/.test(inf) && inf.length >= 4 ? inf : null;
}

async function candidateVerbs(language) {
    const where = { language, typ: { [Op.iLike]: '%verb%' } };
    const [own, base] = await Promise.all([
        Vocabulary.findAll({ where, attributes: ['it'], raw: true }),
        BaseVocabulary.findAll({ where, attributes: ['it'], raw: true })
    ]);
    const set = new Set();
    [...own, ...base].forEach(w => { const inf = normalizeInfinitive(w.it, language); if (inf) set.add(inf); });
    return [...set].sort();
}

async function pendingVerbs(language) {
    const [candidates, done] = await Promise.all([
        candidateVerbs(language),
        VerbForm.findAll({ where: { language }, attributes: ['infinitive'], raw: true })
    ]);
    const known = new Set(done.map(r => r.infinitive));
    return candidates.filter(v => !known.has(v));
}

// --- KI-Aufruf ---
const arr6 = { type: 'array', items: { type: 'string' } };
const SCHEMAS = {
    it: {
        type: 'object',
        properties: { verbs: { type: 'array', items: { type: 'object', properties: {
            infinitive: { type: 'string' }, valid: { type: 'boolean' },
            presente: arr6, imperfetto: arr6, futuro: arr6, condizionale: arr6, congiuntivo: arr6,
            imperativo: { type: 'object', properties: { tu: { type: 'string' }, Lei: { type: 'string' }, noi: { type: 'string' }, voi: { type: 'string' } }, required: ['tu', 'Lei', 'noi', 'voi'], additionalProperties: false },
            participio: { type: 'string' }, aux: { type: 'string', enum: ['avere', 'essere'] }, gerundio: { type: 'string' }
        }, required: ['infinitive', 'valid', 'presente', 'imperfetto', 'futuro', 'condizionale', 'congiuntivo', 'imperativo', 'participio', 'aux', 'gerundio'], additionalProperties: false } } },
        required: ['verbs'], additionalProperties: false
    },
    en: {
        type: 'object',
        properties: { verbs: { type: 'array', items: { type: 'object', properties: {
            infinitive: { type: 'string' }, valid: { type: 'boolean' },
            thirdPerson: { type: 'string' }, past: { type: 'string' }, participio: { type: 'string' }, gerundio: { type: 'string' }
        }, required: ['infinitive', 'valid', 'thirdPerson', 'past', 'participio', 'gerundio'], additionalProperties: false } } },
        required: ['verbs'], additionalProperties: false
    }
};

const SYSTEM = 'Du bist Sprachwissenschaftler und liefern für eine Lern-App die korrekten Standardformen von Verben. Sei genau: Kontrolliere unregelmäßige Verben, Verben mit -isc- (Italienisch) und Rechtschreibregeln.';

function promptFor(language, verbs) {
    if (language === 'it') {
        return `Gib für jedes der folgenden italienischen Verben die korrekten Formen an. Reihenfolge der sechs Personen: io, tu, lui/lei, noi, voi, loro.
- presente, imperfetto, futuro (semplice), condizionale (presente): je sechs Formen ohne Pronomen.
- congiuntivo: Congiuntivo presente, sechs Formen ohne "che" und ohne Pronomen.
- imperativo: Formen für tu, Lei, noi und voi (bei tu die bejahte Form, z. B. "va'" oder "pulisci").
- participio: Partizip Perfekt (männlich Singular), aux: Hilfsverb im Passato prossimo (avere oder essere), gerundio: z. B. "pulendo".
Reflexive Verben (-rsi) wurden auf die Grundform zurückgeführt: gib die Formen ohne Reflexivpronomen an. Wenn ein Wort kein echtes italienisches Verb ist (Tippfehler, anderes Wort), setze valid auf false und fülle die Felder mit leeren Werten.
Bei mehreren korrekten Varianten nimm die gebräuchlichste.

Verben: ${verbs.join(', ')}`;
    }
    return `Give for each of the following English verbs the correct forms: thirdPerson (he/she/it present, e.g. "goes"), past (Simple Past; for "be" use "was/were"), participio (past participle), gerundio (-ing form with correct spelling). If a word is not a real English verb, set valid to false and use empty strings. If several variants are correct, use the most common one (e.g. "learnt/learned" -> "learned" for American usage is fine, but write both separated by " / " if both are common).

Verbs: ${verbs.join(', ')}`;
}

const isForm = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 60;
const isSix = (a) => Array.isArray(a) && a.length === 6 && a.every(isForm);

function cleanItalian(item) {
    const imp = item.imperativo || {};
    if (!(isSix(item.presente) && isSix(item.imperfetto) && isSix(item.futuro) && isSix(item.condizionale) && isSix(item.congiuntivo)
        && ['tu', 'Lei', 'noi', 'voi'].every(k => isForm(imp[k])) && isForm(item.participio) && isForm(item.gerundio) && ['avere', 'essere'].includes(item.aux))) return null;
    const trim = a => a.map(x => x.trim());
    return {
        presente: trim(item.presente), imperfetto: trim(item.imperfetto), futuro: trim(item.futuro), condizionale: trim(item.condizionale), congiuntivo: trim(item.congiuntivo),
        imperativo: { tu: imp.tu.trim(), Lei: imp.Lei.trim(), noi: imp.noi.trim(), voi: imp.voi.trim() },
        participio: item.participio.trim(), aux: item.aux, gerundio: item.gerundio.trim()
    };
}
function cleanEnglish(item) {
    if (!['thirdPerson', 'past', 'participio', 'gerundio'].every(k => isForm(item[k]))) return null;
    return { thirdPerson: item.thirdPerson.trim(), past: item.past.trim(), participio: item.participio.trim(), gerundio: item.gerundio.trim() };
}

async function checkBatch(language, verbs, config) {
    const provider = getProvider(config.provider);
    const apiKey = getApiKey(config, config.provider);
    if (!apiKey) throw new Error('Kein gültiger API-Schlüssel hinterlegt');
    const model = config.models[config.provider];
    const { data, usage } = await provider.generateJson({ apiKey, model, system: SYSTEM, prompt: promptFor(language, verbs), schema: SCHEMAS[language] });

    const byInf = new Map((Array.isArray(data && data.verbs) ? data.verbs : []).map(v => [String(v.infinitive || '').toLowerCase().trim(), v]));
    const rows = [];
    verbs.forEach(inf => {
        const item = byInf.get(inf);
        if (!item) return; // fehlt in der Antwort: nächster Lauf versucht es erneut
        if (item.valid === false) return rows.push({ language, infinitive: inf, forms: null, status: 'invalid', model });
        const forms = language === 'it' ? cleanItalian(item) : cleanEnglish(item);
        if (forms) rows.push({ language, infinitive: inf, forms: JSON.stringify(forms), status: 'verified', model });
    });
    if (rows.length > 0) await VerbForm.bulkCreate(rows, { ignoreDuplicates: true });
    return { saved: rows.length, usage: { input: usage.input, output: usage.output, costUsd: costUsd(model, usage.input, usage.output) } };
}

async function processLanguage(language, config, adminId) {
    const pending = await pendingVerbs(language);
    if (pending.length === 0) { confirmed.delete(language); return; }
    if (pending.length > BULK_THRESHOLD && !confirmed.has(language)) return; // große Menge: erst nach Freigabe im Admin-Bereich

    let failures = 0;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        try {
            const { saved, usage } = await checkBatch(language, batch, config);
            await addUsage(adminId, 0, usage, 0);
            failures = saved === 0 ? failures + 1 : 0;
        } catch (err) {
            console.warn(`Verbprüfung (${language}) fehlgeschlagen: ${err.message}`);
            failures++;
        }
        if (failures >= MAX_FAILURES) return;
    }
}

async function runOnce() {
    if (running) return;
    running = true;
    try {
        const config = await loadConfig();
        if (!config.enabled || !config.keys[config.provider]) return;
        const admin = await User.findOne({ where: { isAdmin: true }, order: [['id', 'ASC']], attributes: ['id'] });
        if (!admin) return;
        for (const language of LANGUAGES) await processLanguage(language, config, admin.id);
    } catch (err) {
        console.warn('Verbprüfung abgebrochen:', err.message);
    } finally {
        running = false;
    }
}

const trigger = () => { setImmediate(runOnce); };
const confirmLanguage = (language) => { confirmed.add(language); trigger(); };
// Alle 15 Minuten nach neuen Verben schauen (Start kurz nach dem Hochfahren)
function start() {
    setTimeout(runOnce, 45 * 1000);
    setInterval(runOnce, 15 * 60 * 1000);
}

// Kosten pro Verb (grob): ein Aufruf mit BATCH_SIZE Verben
function estimateUsdPerVerb(model, language) {
    const perVerbOut = language === 'it' ? 170 : 40;
    const input = 450 + BATCH_SIZE * 8;
    const output = BATCH_SIZE * perVerbOut + (THINKING_MODELS.test(model) ? 400 : 0);
    const usd = costUsd(model, input, output);
    return usd === null ? null : usd / BATCH_SIZE;
}

module.exports = { start, trigger, confirmLanguage, pendingVerbs, normalizeInfinitive, estimateUsdPerVerb, BULK_THRESHOLD, LANGUAGES };
