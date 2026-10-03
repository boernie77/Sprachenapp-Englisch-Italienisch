// KI-Einstellungen (im Admin-Bereich gepflegt) und Satzerzeugung.
// Die Einstellungen liegen als JSON in der Tabelle Settings, API-Schlüssel nur verschlüsselt.
const { Setting } = require('../../models');
const { encrypt, decrypt } = require('../secretBox');
const { PROVIDERS, AiError } = require('./providers');
const { HINTS } = require('./grammar');

const SETTINGS_KEY = 'ai.config';

const DEFAULTS = {
    provider: 'anthropic',
    enabled: false,
    dailyLimit: 50,
    models: Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, p.defaultModel])),
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
    return { provider: config.provider, enabled: config.enabled, dailyLimit: config.dailyLimit, providers };
}

function getProvider(id) {
    const provider = PROVIDERS[id];
    if (!provider) throw new AiError('Unbekannter KI-Anbieter', 400);
    return provider;
}

const LANGUAGE_NAMES = { it: 'Italienisch', en: 'Englisch' };

function sentenceSchema(categories, levels) {
    return {
        type: 'object',
        properties: {
            sentences: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        foreign: { type: 'string' },
                        german: { type: 'string' },
                        category: { type: 'string', enum: categories },
                        level: { type: 'string', enum: levels }
                    },
                    required: ['foreign', 'german', 'category', 'level'],
                    additionalProperties: false
                }
            }
        },
        required: ['sentences'],
        additionalProperties: false
    };
}

const SYSTEM_PROMPT = `Du bist eine erfahrene Lehrkraft für Fremdsprachen und schreibst Übungssätze für eine Lern-App deutschsprachiger Lernender.

Jeder Satz muss:
- inhaltlich logisch und alltagsnah sein. Prüfe vor der Ausgabe, ob die Handlung in der echten Welt Sinn ergibt (Brot isst man, Wasser trinkt man; Gegenstände handeln nicht wie Menschen; Zeitangaben passen zur Zeitform).
- das vorgegebene Wort in einer passenden, gebeugten oder unveränderten Form enthalten.
- die angegebene Grammatikart eindeutig und korrekt verwenden.
- zum Sprachniveau passen (A1 sehr einfach und kurz, B2 auch Nebensätze).
- höchstens 15 Wörter haben.
- eine natürliche, inhaltlich genaue deutsche Übersetzung mit korrekter Groß- und Kleinschreibung haben.

Verteile die Sätze gleichmäßig auf die angegebenen Grammatikarten und wiederhole keine Satzmuster.`;

function buildPrompt({ word, translation, language, level, categories, count }) {
    const categoryLines = categories.map(c => `- ${c}${HINTS[c] ? ` (${HINTS[c]})` : ''}`).join('\n');
    return `Sprache: ${LANGUAGE_NAMES[language]}
Wort: ${word}${translation ? `\nDeutsche Bedeutung: ${translation}` : ''}
Sprachniveau: ${level}
Anzahl Sätze: ${count}
Grammatikarten:
${categoryLines}

Schreibe ${count} Sätze auf ${LANGUAGE_NAMES[language]} mit deutscher Übersetzung. Setze "category" auf genau eine der Grammatikarten oben und "level" auf ${level}.`;
}

const MAX_SENTENCE_LENGTH = 250; // Spalten it/de sind VARCHAR(255)

async function generateSentences({ word, translation, language, level, categories, count }) {
    const config = await loadConfig();
    if (!config.enabled) throw new AiError('Die KI-Funktion ist nicht aktiviert', 409); // kein 403: das Frontend meldet bei 403 ab
    const provider = getProvider(config.provider);
    const apiKey = getApiKey(config, config.provider);
    if (!apiKey) throw new AiError('Kein gültiger API-Schlüssel hinterlegt', 503);

    const result = await provider.generateJson({
        apiKey,
        model: config.models[config.provider],
        system: SYSTEM_PROMPT,
        prompt: buildPrompt({ word, translation, language, level, categories, count }),
        schema: sentenceSchema(categories, [level])
    });

    const sentences = (Array.isArray(result && result.sentences) ? result.sentences : [])
        .map(s => ({
            foreign: String(s.foreign || '').trim(),
            german: String(s.german || '').trim(),
            category: categories.includes(s.category) ? s.category : categories[0],
            level
        }))
        .filter(s => s.foreign && s.german && s.foreign.length <= MAX_SENTENCE_LENGTH && s.german.length <= MAX_SENTENCE_LENGTH)
        .slice(0, count);
    if (sentences.length === 0) throw new AiError('Die KI hat keine verwertbaren Sätze geliefert', 502);
    return sentences;
}

module.exports = { loadConfig, saveConfig, publicConfig, getApiKey, getProvider, generateSentences, encrypt, AiError, PROVIDERS };
