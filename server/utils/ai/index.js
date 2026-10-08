// KI-Einstellungen (im Admin-Bereich gepflegt) und Satzerzeugung.
// Die Einstellungen liegen als JSON in der Tabelle Settings, API-Schlüssel nur verschlüsselt.
const { Setting } = require('../../models');
const { encrypt, decrypt } = require('../secretBox');
const { PROVIDERS, AiError } = require('./providers');
const { costUsd } = require('./pricing');
const core = require('../../public/ai-core');

const SETTINGS_KEY = 'ai.config';

const DEFAULTS = {
    provider: 'anthropic',
    enabled: false,
    dailyLimit: 50,
    models: Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, p.defaultModel])),
    lookupLimit: 200, // KI-Wortinfo-Abfragen (Wortart/Geschlecht) pro Nutzer und Tag, Admins unbegrenzt
    usdToEur: 0.86, // Umrechnung für die Kostenanzeige im Admin-Bereich
    keys: {} // provider -> verschlüsselter Schlüssel
};

async function loadConfig() {
    const row = await Setting.findOne({ where: { key: SETTINGS_KEY } });
    let stored = {};
    if (row && row.value) {
        try { stored = JSON.parse(row.value); } catch (err) { stored = {}; }
    }
    return {
        ...DEFAULTS,
        ...stored,
        models: { ...DEFAULTS.models, ...(stored.models || {}) },
        keys: { ...(stored.keys || {}) }
    };
}

async function saveConfig(config) {
    const value = JSON.stringify(config);
    const [row, created] = await Setting.findOrCreate({ where: { key: SETTINGS_KEY }, defaults: { value } });
    if (!created) await row.update({ value });
}

// Klartext-Schlüssel des Anbieters oder null (fehlt bzw. nicht mehr entschlüsselbar)
const getApiKey = (config, provider) => decrypt(config.keys[provider]);

// Ansicht für den Admin-Bereich: nie den Schlüssel selbst, nur ob er hinterlegt ist + letzte 4 Zeichen
function publicConfig(config) {
    const providers = {};
    for (const [id, p] of Object.entries(PROVIDERS)) {
        const stored = config.keys[id];
        const plain = decrypt(stored);
        providers[id] = {
            label: p.label,
            model: config.models[id],
            suggestedModels: p.suggestedModels,
            keySet: !!stored,
            keyReadable: !!plain,
            keyHint: plain ? `••••${plain.slice(-4)}` : null
        };
    }
    return { provider: config.provider, enabled: config.enabled, dailyLimit: config.dailyLimit, lookupLimit: config.lookupLimit, usdToEur: config.usdToEur, providers };
}

function getProvider(id) {
    const provider = PROVIDERS[id];
    if (!provider) throw new AiError('Unbekannter KI-Anbieter', 400);
    return provider;
}

async function generateSentences({ word, translation, language, levels, categories, count }) {
    const config = await loadConfig();
    if (!config.enabled) throw new AiError('Die KI-Funktion ist nicht aktiviert', 409); // kein 403: das Frontend meldet bei 403 ab
    const plan = core.buildPlan(categories, levels, count);
    const provider = getProvider(config.provider);
    const apiKey = getApiKey(config, config.provider);
    if (!apiKey) throw new AiError('Kein gültiger API-Schlüssel hinterlegt', 503);

    const model = config.models[config.provider];
    const { data: result, usage } = await provider.generateJson({
        apiKey,
        model,
        system: core.SYSTEM_PROMPT,
        prompt: core.buildPrompt({ word, translation, language, plan }),
        schema: core.sentenceSchema(categories, levels)
    });

    const sentences = core.parseSentences(result, plan, count);
    if (sentences.length === 0) throw new AiError('Die KI hat keine verwertbaren Sätze geliefert', 502);
    return { sentences, usage: { input: usage.input, output: usage.output, costUsd: costUsd(model, usage.input, usage.output) } };
}

// Wortart (und bei italienischen und spanischen Substantiven Geschlecht) eines einzelnen Worts
async function lookupWord({ word, translation, language }) {
    const config = await loadConfig();
    if (!config.enabled) throw new AiError('Die KI-Funktion ist nicht aktiviert', 409);
    const provider = getProvider(config.provider);
    const apiKey = getApiKey(config, config.provider);
    if (!apiKey) throw new AiError('Kein gültiger API-Schlüssel hinterlegt', 503);
    const model = config.models[config.provider];
    const { data, usage } = await provider.generateJson({
        apiKey, model, system: core.LOOKUP_SYSTEM,
        prompt: core.lookupPrompt({ word, translation, language }),
        schema: core.lookupSchema
    });
    const info = core.parseLookup(data, language);
    return { info, usage: { input: usage.input, output: usage.output, costUsd: costUsd(model, usage.input, usage.output) } };
}

module.exports = { lookupWord, loadConfig, saveConfig, publicConfig, getApiKey, getProvider, generateSentences, encrypt, AiError, PROVIDERS };
