// KI-Prüfung der Verbformen: jedes Verb (Basis-Vokabeln und Nutzerlisten, Italienisch, Englisch und Spanisch) wird einmal geprüft,
// das Ergebnis gilt für alle. Bereits geprüfte (und ungültige oder verworfene) Verben werden übersprungen.
const { Op } = require('sequelize');
const { User, Vocabulary, BaseVocabulary, VerbForm } = require('../../models');
const { loadConfig, getProvider, getApiKey } = require('./index');
const { costUsd } = require('./pricing');
const { addUsage } = require('./usage');

const { LANGUAGES } = require('../languages');
const core = require('../../public/ai-core');
const { THINKING_MODELS, normalizeInfinitive, VERB_SCHEMAS: SCHEMAS, VERB_SYSTEM: SYSTEM, verbPrompt: promptFor, parseVerbBatch } = core;
const BATCH_SIZE = core.VERB_BATCH_SIZE;
const BULK_THRESHOLD = core.VERB_BULK_THRESHOLD; // ab so vielen offenen Verben fragt der Admin-Bereich erst nach Freigabe
const MAX_FAILURES = 3;

const confirmed = new Set(); // Sprachen mit Freigabe des Admins (bis nichts mehr offen ist; verfällt beim Neustart)
let running = false;

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

async function checkBatch(language, verbs, config) {
    const provider = getProvider(config.provider);
    const apiKey = getApiKey(config, config.provider);
    if (!apiKey) throw new Error('Kein gültiger API-Schlüssel hinterlegt');
    const model = config.models[config.provider];
    const { data, usage } = await provider.generateJson({ apiKey, model, system: SYSTEM, prompt: promptFor(language, verbs), schema: SCHEMAS[language] });

    const rows = parseVerbBatch(language, verbs, data, model);
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

const estimateUsdPerVerb = core.estimateVerbUsd;

module.exports = { start, trigger, confirmLanguage, pendingVerbs, normalizeInfinitive, estimateUsdPerVerb, BULK_THRESHOLD, LANGUAGES };
