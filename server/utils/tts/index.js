// Cloudstimme: Einstellungen (Admin), Zwischenspeicher auf Platte und Tageslimit.
// Einstellungen liegen wie die KI-Einstellungen in der Tabelle Settings (Schlüssel `tts.config`),
// der API-Schlüssel nur verschlüsselt (secretBox) und wird nie wieder angezeigt.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PROVIDERS, TtsError } = require('./providers');

const SETTINGS_KEY = 'tts.config';
const LANGS = ['it', 'en', 'es', 'de'];
const MAX_TEXT = 300;
const CACHE_DIR = () => process.env.TTS_CACHE_DIR || path.join(__dirname, '..', '..', 'tts-cache');
const CACHE_MAX_BYTES = () => (parseInt(process.env.TTS_CACHE_MAX_MB, 10) || 500) * 1024 * 1024;

const DEFAULTS = {
    provider: 'google',
    enabled: false,
    dailyLimit: 300, // neue (nicht zwischengespeicherte) Aufrufe pro Nutzer und Tag, Admins unbegrenzt
    voices: Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, { ...p.defaultVoices }])),
    keys: {} // Anbieter -> verschlüsselter Schlüssel
};

// --- Einstellungen (Datenbank) ---
function mergeConfig(stored) {
    const voices = {};
    for (const id of Object.keys(PROVIDERS)) voices[id] = { ...DEFAULTS.voices[id], ...((stored.voices || {})[id] || {}) };
    return { ...DEFAULTS, ...stored, voices, keys: { ...(stored.keys || {}) } };
}

async function loadConfig() {
    const { Setting } = require('../../models');
    const row = await Setting.findOne({ where: { key: SETTINGS_KEY } });
    let stored = {};
    if (row && row.value) { try { stored = JSON.parse(row.value); } catch (err) { stored = {}; } }
    return mergeConfig(stored);
}

async function saveConfig(config) {
    const { Setting } = require('../../models');
    const value = JSON.stringify(config);
    const [row, created] = await Setting.findOrCreate({ where: { key: SETTINGS_KEY }, defaults: { value } });
    if (!created) await row.update({ value });
}

const getApiKey = (config, provider) => require('../secretBox').decrypt(config.keys[provider]);

// Ansicht für den Admin-Bereich: nie den Schlüssel selbst, nur ob er hinterlegt ist + letzte 4 Zeichen
function publicConfig(config) {
    const { decrypt } = require('../secretBox');
    const providers = {};
    for (const [id, p] of Object.entries(PROVIDERS)) {
        const stored = config.keys[id];
        const plain = decrypt(stored);
        providers[id] = { label: p.label, voices: config.voices[id], keySet: !!stored, keyReadable: !!plain, keyHint: plain ? `••••${plain.slice(-4)}` : null };
    }
    return { provider: config.provider, enabled: config.enabled, dailyLimit: config.dailyLimit, providers, maxText: MAX_TEXT };
}

// Cloudstimme nutzbar: eingeschaltet und lesbarer Schlüssel für den gewählten Anbieter
const isAvailable = (config) => !!(config.enabled && PROVIDERS[config.provider] && getApiKey(config, config.provider));

// --- Text und Zwischenspeicher ---
function cleanText(text) {
    const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!t) throw new TtsError('Kein Text angegeben', 400);
    if (t.length > MAX_TEXT) throw new TtsError('Text zu lang', 400);
    return t;
}

const cacheKey = ({ provider, voice, lang, text }) =>
    crypto.createHash('sha256').update([provider, voice, lang, text].join('\u0001')).digest('hex');

function readCache(dir, key) {
    try { return fs.readFileSync(path.join(dir, key.slice(0, 2), `${key}.mp3`)); } catch (err) { return null; }
}

function writeCache(dir, key, buffer) {
    const sub = path.join(dir, key.slice(0, 2));
    fs.mkdirSync(sub, { recursive: true });
    const file = path.join(sub, `${key}.mp3`);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, file); // atomar: nie halb geschriebene Dateien lesen
}

// Löscht die ältesten Dateien, bis der Zwischenspeicher unter dem Größenlimit liegt
function pruneCache(dir, maxBytes) {
    let files = [];
    try {
        for (const sub of fs.readdirSync(dir)) {
            const subDir = path.join(dir, sub);
            if (!fs.statSync(subDir).isDirectory()) continue;
            for (const name of fs.readdirSync(subDir)) {
                if (!name.endsWith('.mp3')) continue;
                const file = path.join(subDir, name);
                const st = fs.statSync(file);
                files.push({ file, size: st.size, time: st.mtimeMs });
            }
        }
    } catch (err) { return 0; }
    let total = files.reduce((s, f) => s + f.size, 0);
    let removed = 0;
    files.sort((a, b) => a.time - b.time);
    for (const f of files) {
        if (total <= maxBytes) break;
        try { fs.unlinkSync(f.file); total -= f.size; removed++; } catch (err) { /* ignorieren */ }
    }
    return removed;
}

// --- Dienst (Anbieter, Zwischenspeicher und Zählung austauschbar für Tests) ---
function createService({ providers = PROVIDERS, cacheDir = CACHE_DIR(), maxBytes = CACHE_MAX_BYTES(), store, getKey = getApiKey } = {}) {
    const inflight = new Map();
    let writes = 0;

    // user: { id, isAdmin }; config: Ergebnis von loadConfig(); liefert { audio: Buffer, cached: bool }
    async function synthesize({ text, lang, user, config }) {
        if (!LANGS.includes(lang)) throw new TtsError('Sprache nicht unterstützt', 400);
        const clean = cleanText(text);
        const provider = providers[config.provider];
        const apiKey = provider && getKey(config, config.provider);
        if (!config.enabled || !provider || !apiKey) throw new TtsError('Die Cloudstimme ist nicht eingerichtet', 503);

        const voice = (config.voices[config.provider] || {})[lang] || provider.defaultVoices[lang];
        const key = cacheKey({ provider: config.provider + (provider.cacheVersion ? ':' + provider.cacheVersion : ''), voice, lang, text: clean });
        const hit = readCache(cacheDir, key);
        if (hit) return { audio: hit, cached: true };

        if (inflight.has(key)) return { audio: await inflight.get(key), cached: true }; // gleicher Text parallel: nur einmal bezahlen
        if (!user.isAdmin && (await store.remaining(user, config.dailyLimit)) <= 0) throw new TtsError('Tageslimit für Cloudstimme erreicht', 429);

        const job = (async () => {
            const audio = await provider.synthesize({ apiKey, text: clean, lang, voice });
            await store.add(user.id);
            writeCache(cacheDir, key, audio);
            if (++writes % 50 === 0) pruneCache(cacheDir, maxBytes);
            return audio;
        })();
        inflight.set(key, job);
        try { return { audio: await job, cached: false }; } finally { inflight.delete(key); }
    }

    return { synthesize, pruneCache: () => pruneCache(cacheDir, maxBytes) };
}

// Zählung in AiUsage (Spalte ttsCalls), wie das Tageslimit der KI-Sätze
const dbStore = {
    async remaining(user, limit) {
        const { AiUsage } = require('../../models');
        const row = await AiUsage.findOne({ where: { UserId: user.id, day: new Date().toISOString().slice(0, 10) } });
        return Math.max(0, limit - (row ? row.ttsCalls : 0));
    },
    async add(userId) {
        const { AiUsage } = require('../../models');
        const [row] = await AiUsage.findOrCreate({ where: { UserId: userId, day: new Date().toISOString().slice(0, 10) }, defaults: { count: 0 } });
        await row.increment({ ttsCalls: 1 });
    }
};

// Einfache Begrenzung der Anfragen je Nutzer (im Speicher, pro Prozess)
function createRateLimiter(max = 40, windowMs = 60000) {
    const hits = new Map();
    return (id) => {
        const now = Date.now();
        const list = (hits.get(id) || []).filter(t => now - t < windowMs);
        if (list.length >= max) { hits.set(id, list); return false; }
        list.push(now);
        hits.set(id, list);
        return true;
    };
}

module.exports = { PROVIDERS, TtsError, LANGS, MAX_TEXT, loadConfig, saveConfig, getApiKey, publicConfig, isAvailable, cleanText, cacheKey, pruneCache, createService, dbStore, createRateLimiter };
