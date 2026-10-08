// KI-Funktionen und Cloudstimme im lokalen Betrieb (ohne Server), mit dem eigenen API-Schlüssel des Nutzers.
// Entspricht routes/ai.js, routes/tts.js und utils/ai/autoGenerate.js, aber alles läuft in der App:
//   - Einstellungen und Tagesverbrauch liegen in `meta` (local-store.js), die API-Schlüssel nur im sicheren Speicher des Geräts
//   - Prompts, Planung und Regeln kommen aus ai-core.js (dieselbe Datei nutzt der Server)
//   - Anbieter werden direkt angesprochen (ai-providers.js)
(function (root) {
    'use strict';

    const isNode = typeof module !== 'undefined' && module.exports;
    const core = isNode ? require('./ai-core') : root.AiCore;
    const Providers = isNode ? require('./ai-providers') : root.AiProviders;
    const { AiError } = Providers;

    const CONFIG_KEY = 'ai.config';
    const PREFS_KEY = 'ai.prefs';
    const USAGE_KEY = 'ai.usage';
    const TOTALS_KEY = 'ai.totals';
    const TTS_LANGS = ['it', 'en', 'es', 'de'];
    const TTS_MAX_TEXT = 300;
    const TTS_CACHE_MAX_BYTES = 200 * 1024 * 1024;
    const MAX_FAILURES = 3;
    const USD_TO_EUR = 0.86;
    const DEFAULT_INPUT = 500, TOKENS_PER_SENTENCE = 70, THINKING_TOKENS = 400;

    const keyName = (kind, provider) => `${kind}:${provider}`;
    const keyHint = (key) => (key ? `••••${key.slice(-4)}` : null);
    const err = (status, message) => Object.assign(new Error(message), { status });

    // ------------------------------------------------------------------------------------
    // Gerät: sicherer Speicher für Schlüssel und HTTP ohne CORS
    // ------------------------------------------------------------------------------------
    // Schlüssel liegen in der Keychain (iOS) bzw. dem Keystore (Android), wenn das Plugin da ist; sonst im lokalen Speicher des Browsers.
    function createSecrets(env = root) {
        const native = () => {
            try {
                const c = env.Capacitor;
                return (c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.SecureStoragePlugin) || null;
            } catch (e) { return null; }
        };
        const PREFIX = 'lernapp-secret-';
        return {
            async get(name) {
                const n = native();
                if (n) { try { return (await n.get({ key: name })).value || null; } catch (e) { return null; } }
                try { return env.localStorage.getItem(PREFIX + name); } catch (e) { return null; }
            },
            async set(name, value) {
                const n = native();
                if (n) return n.set({ key: name, value });
                env.localStorage.setItem(PREFIX + name, value);
            },
            async remove(name) {
                const n = native();
                if (n) { try { await n.remove({ key: name }); } catch (e) { /* war nicht gesetzt */ } return; }
                try { env.localStorage.removeItem(PREFIX + name); } catch (e) { /* ignorieren */ }
            }
        };
    }

    const b64ToBuffer = (b64) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
    };

    // HTTP: In der App über das native HTTP von Capacitor (kein CORS), im Browser fetch.
    // -> { status, json(), arrayBuffer() }
    function createHttp(env = root) {
        const nativeHttp = () => {
            try {
                const c = env.Capacitor;
                return (c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.CapacitorHttp) || null;
            } catch (e) { return null; }
        };
        return async function http(url, { method = 'GET', headers = {}, body, timeoutMs = 20000, binary = false } = {}) {
            const native = nativeHttp();
            if (native) {
                const r = await native.request({
                    url, method, headers, data: body ? JSON.parse(body) : undefined,
                    responseType: binary ? 'blob' : 'text', connectTimeout: timeoutMs, readTimeout: timeoutMs
                });
                return {
                    status: r.status,
                    json: async () => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
                    arrayBuffer: async () => b64ToBuffer(r.data) // blob kommt als Base64
                };
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await env.fetch(url, { method, headers, body, signal: controller.signal });
                return { status: res.status, json: () => res.json(), arrayBuffer: () => res.arrayBuffer() };
            } finally {
                clearTimeout(timer);
            }
        };
    }

    // ------------------------------------------------------------------------------------
    // Dienst
    // ------------------------------------------------------------------------------------
    // ctx: { store, secrets, http, now, sentencesFor(language), addSentences(language, list), liveVocab(language), uuid }
    function create(ctx) {
        const { store, secrets, http } = ctx;
        const now = ctx.now || (() => new Date());
        const today = () => now().toISOString().slice(0, 10);
        const P = Providers.create(http);

        // Zustand der Automatik (nur im Speicher, wie auf dem Server)
        const bulkConfirmed = new Set();
        const backfillRequests = new Set();
        const doneWords = new Set();
        const failedWords = new Set();
        let running = false;

        // ---- Einstellungen ----
        const defaultConfig = () => ({
            provider: 'anthropic', enabled: false, dailyLimit: 50, lookupLimit: 200,
            models: Object.fromEntries(Object.entries(P.AI).map(([id, p]) => [id, p.defaultModel])),
            tts: {
                provider: 'google', enabled: false, dailyLimit: 300,
                voices: Object.fromEntries(Object.entries(P.TTS).map(([id, p]) => [id, { ...p.defaultVoices }]))
            }
        });
        async function loadConfig() {
            const d = defaultConfig();
            const s = await store.getMeta(CONFIG_KEY, {});
            const voices = {};
            for (const id of Object.keys(P.TTS)) voices[id] = { ...d.tts.voices[id], ...(((s.tts || {}).voices || {})[id] || {}) };
            return { ...d, ...s, models: { ...d.models, ...(s.models || {}) }, tts: { ...d.tts, ...(s.tts || {}), voices } };
        }
        const aiKey = (provider) => secrets.get(keyName('ai', provider));
        const ttsKey = async (config) => (await secrets.get(keyName('tts', config.tts.provider)))
            // gleicher Anbieter, kein eigener Stimmen-Schlüssel: den KI-Schlüssel mitnutzen
            || (config.tts.provider === 'openai' ? aiKey('openai') : null);

        async function publicConfig() {
            const c = await loadConfig();
            const ai = {}, tts = {};
            for (const [id, p] of Object.entries(P.AI)) {
                const k = await aiKey(id);
                ai[id] = { label: p.label, model: c.models[id], suggestedModels: p.suggestedModels, keySet: !!k, keyHint: keyHint(k) };
            }
            for (const [id, p] of Object.entries(P.TTS)) {
                const k = await secrets.get(keyName('tts', id));
                tts[id] = { label: p.label, voices: c.tts.voices[id], keySet: !!k, keyHint: keyHint(k), sharesAiKey: id === 'openai' && !k && !!(await aiKey('openai')) };
            }
            return {
                provider: c.provider, enabled: c.enabled, dailyLimit: c.dailyLimit, lookupLimit: c.lookupLimit, providers: ai,
                tts: { provider: c.tts.provider, enabled: c.tts.enabled, dailyLimit: c.tts.dailyLimit, providers: tts, maxText: TTS_MAX_TEXT }
            };
        }

        // body: { provider, enabled, dailyLimit, lookupLimit, models, keys: { <anbieter>: 'neu' | '' (entfernen) }, tts: { provider, enabled, dailyLimit, voices, keys } }
        async function saveConfig(body) {
            const c = await loadConfig();
            const num = (v, fallback) => (Number.isInteger(v) && v >= 0 ? v : fallback);
            if (body.provider !== undefined) {
                if (!P.AI[body.provider]) throw err(400, 'Unbekannter KI-Anbieter');
                c.provider = body.provider;
            }
            if (typeof body.enabled === 'boolean') c.enabled = body.enabled;
            c.dailyLimit = num(body.dailyLimit, c.dailyLimit);
            c.lookupLimit = num(body.lookupLimit, c.lookupLimit);
            for (const [id, model] of Object.entries(body.models || {})) {
                if (P.AI[id] && typeof model === 'string' && model.trim()) c.models[id] = model.trim();
            }
            for (const [id, key] of Object.entries(body.keys || {})) {
                if (!P.AI[id] || typeof key !== 'string') continue;
                if (key.trim()) await secrets.set(keyName('ai', id), key.trim()); else await secrets.remove(keyName('ai', id));
            }
            const t = body.tts || {};
            if (t.provider !== undefined) {
                if (!P.TTS[t.provider]) throw err(400, 'Unbekannter Stimmen-Anbieter');
                c.tts.provider = t.provider;
            }
            if (typeof t.enabled === 'boolean') c.tts.enabled = t.enabled;
            c.tts.dailyLimit = num(t.dailyLimit, c.tts.dailyLimit);
            for (const [id, voices] of Object.entries(t.voices || {})) {
                if (!P.TTS[id]) continue;
                for (const [lang, v] of Object.entries(voices || {})) if (TTS_LANGS.includes(lang) && typeof v === 'string' && v.trim()) c.tts.voices[id][lang] = v.trim();
            }
            for (const [id, key] of Object.entries(t.keys || {})) {
                if (!P.TTS[id] || typeof key !== 'string') continue;
                if (key.trim()) await secrets.set(keyName('tts', id), key.trim()); else await secrets.remove(keyName('tts', id));
            }
            await store.setMeta(CONFIG_KEY, c);
            return publicConfig();
        }

        // ---- Verbrauch ----
        async function usage() {
            const u = await store.getMeta(USAGE_KEY, null);
            if (u && u.day === today()) return u;
            return { day: today(), count: 0, lookups: 0, ttsCalls: 0, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
        }
        async function addUsage({ sentences = 0, lookups = 0, ttsCalls = 0, tokens, model }) {
            const u = await usage();
            u.count += sentences; u.lookups += lookups; u.ttsCalls += ttsCalls;
            if (tokens) {
                u.calls += 1; u.inputTokens += tokens.input; u.outputTokens += tokens.output; u.costUsd += tokens.costUsd || 0;
                const totals = await store.getMeta(TOTALS_KEY, {});
                const t = totals[model] || { calls: 0, input: 0, output: 0 };
                t.calls += 1; t.input += tokens.input; t.output += tokens.output;
                totals[model] = t;
                await store.setMeta(TOTALS_KEY, totals);
            }
            await store.setMeta(USAGE_KEY, u);
        }
        // 0 = unbegrenzt (der Nutzer zahlt selbst) -> null wie bei Admins auf dem Server
        const remainingOf = (limit, used) => (limit > 0 ? Math.max(0, limit - used) : null);

        async function readyAi() {
            const c = await loadConfig();
            const key = c.enabled ? await aiKey(c.provider) : null;
            return { config: c, key, ready: c.enabled && !!key };
        }

        // ---- Nutzer-Einstellungen (aiPrefs) ----
        const loadPrefs = async () => ({ ...core.DEFAULT_PREFS, ...(await store.getMeta(PREFS_KEY, {})) });
        async function allowedCategories(language) {
            const list = await ctx.sentencesFor(language);
            return core.categoriesFor(language, list.map(s => s.category));
        }

        async function options(language) {
            if (!core.isSupportedLanguage(language)) throw err(400, 'Sprache nicht unterstützt');
            const { config, ready } = await readyAi();
            const u = await usage();
            return {
                enabled: ready,
                provider: P.AI[config.provider] ? P.AI[config.provider].label : null,
                levels: core.LEVELS,
                categories: ready ? await allowedCategories(language) : [],
                newCategories: core.NEW_CATEGORIES[language],
                maxCount: core.MAX_COUNT,
                remaining: ready ? remainingOf(config.dailyLimit, u.count) : 0,
                dailyLimit: config.dailyLimit,
                prefs: core.prefsForLanguage(await loadPrefs(), language)
            };
        }

        async function savePrefs(body) {
            const { language, enabled, categories } = body;
            const levels = core.LEVELS.filter(l => Array.isArray(body.levels) && body.levels.includes(l));
            const count = parseInt(body.count, 10);
            if (!core.isSupportedLanguage(language)) throw err(400, 'Sprache nicht unterstützt');
            if (typeof enabled !== 'boolean') throw err(400, 'Ungültige Einstellung');
            if (levels.length === 0) throw err(400, 'Bitte mindestens ein Niveau wählen');
            if (!Number.isInteger(count) || count < 1 || count > core.MAX_COUNT) throw err(400, `Anzahl muss zwischen 1 und ${core.MAX_COUNT} liegen`);
            const allowed = await allowedCategories(language);
            const chosen = [...new Set(Array.isArray(categories) ? categories : [])].filter(c => allowed.includes(c));
            if (enabled && chosen.length === 0) throw err(400, 'Bitte mindestens eine Grammatikart wählen');
            const stored = await loadPrefs();
            const next = { enabled, levels, count, categoriesByLang: { ...(stored.categoriesByLang || {}), [language]: chosen } };
            await store.setMeta(PREFS_KEY, next);
            if (enabled) setTimeout(() => runAuto().catch(() => { }), 0);
            return core.prefsForLanguage(next, language);
        }

        // ---- KI-Aufrufe ----
        async function generateSentences({ word, translation, language, levels, categories, count }) {
            const { config, key, ready } = await readyAi();
            if (!config.enabled) throw new AiError('Die KI-Funktion ist nicht aktiviert', 409);
            if (!ready) throw new AiError('Kein gültiger API-Schlüssel hinterlegt', 503);
            const plan = core.buildPlan(categories, levels, count);
            const model = config.models[config.provider];
            const { data, usage: tok } = await P.AI[config.provider].generateJson({
                apiKey: key, model, system: core.SYSTEM_PROMPT,
                prompt: core.buildPrompt({ word, translation, language, plan }),
                schema: core.sentenceSchema(categories, levels)
            });
            const sentences = core.parseSentences(data, plan, count);
            if (sentences.length === 0) throw new AiError('Die KI hat keine verwertbaren Sätze geliefert', 502);
            return { sentences, tokens: { input: tok.input, output: tok.output, costUsd: core.costUsd(model, tok.input, tok.output) }, model };
        }

        async function sentences(body) {
            const { word, translation, language, categories } = body;
            const levels = core.LEVELS.filter(l => Array.isArray(body.levels) && body.levels.includes(l));
            const count = parseInt(body.count, 10);
            if (!core.isSupportedLanguage(language)) throw err(400, 'Sprache nicht unterstützt');
            if (typeof word !== 'string' || !word.trim() || word.length > 100) throw err(400, 'Bitte ein Wort angeben (max. 100 Zeichen)');
            if (translation != null && (typeof translation !== 'string' || translation.length > 100)) throw err(400, 'Übersetzung zu lang');
            if (levels.length === 0) throw err(400, 'Bitte mindestens ein Niveau wählen');
            if (!Number.isInteger(count) || count < 1 || count > core.MAX_COUNT) throw err(400, `Anzahl muss zwischen 1 und ${core.MAX_COUNT} liegen`);
            const allowed = await allowedCategories(language);
            const chosen = [...new Set(Array.isArray(categories) ? categories : [])].filter(c => allowed.includes(c));
            if (chosen.length === 0) throw err(400, 'Bitte mindestens eine Grammatikart wählen');

            const config = await loadConfig();
            const remaining = remainingOf(config.dailyLimit, (await usage()).count);
            if (remaining !== null && remaining < count) {
                throw Object.assign(err(429, remaining === 0 ? 'Tageslimit für KI-Sätze erreicht' : `Heute ${remaining === 1 ? 'ist nur noch 1 Satz' : `sind nur noch ${remaining} Sätze`} möglich`), { remaining });
            }
            const r = await generateSentences({ word: word.trim(), translation: translation ? translation.trim() : null, language, levels, categories: chosen, count });
            await addUsage({ sentences: r.sentences.length, tokens: r.tokens, model: r.model });
            return { sentences: r.sentences, remaining: remaining === null ? null : remaining - r.sentences.length };
        }

        async function wordInfo(body) {
            const { word, translation, language } = body;
            if (!core.isSupportedLanguage(language)) throw err(400, 'Sprache nicht unterstützt');
            if (typeof word !== 'string' || !word.trim() || word.length > 100) throw err(400, 'Ungültiges Wort');
            if (translation != null && (typeof translation !== 'string' || translation.length > 100)) throw err(400, 'Übersetzung zu lang');
            const { config, key, ready } = await readyAi();
            if (!config.enabled) throw new AiError('Die KI-Funktion ist nicht aktiviert', 409);
            if (!ready) throw new AiError('Kein gültiger API-Schlüssel hinterlegt', 503);
            const remaining = remainingOf(config.lookupLimit, (await usage()).lookups);
            if (remaining !== null && remaining < 1) throw err(429, 'Tageslimit für KI-Wortinfo erreicht');
            const model = config.models[config.provider];
            const w = word.trim(), tr = translation ? translation.trim() : null;
            const { data, usage: tok } = await P.AI[config.provider].generateJson({
                apiKey: key, model, system: core.LOOKUP_SYSTEM, prompt: core.lookupPrompt({ word: w, translation: tr, language }), schema: core.lookupSchema
            });
            await addUsage({ lookups: 1, tokens: { input: tok.input, output: tok.output, costUsd: core.costUsd(model, tok.input, tok.output) }, model });
            return core.parseLookup(data, language);
        }

        // Verbindung prüfen / Modelle laden
        async function testAi() {
            const c = await loadConfig();
            const key = await aiKey(c.provider);
            if (!key) throw err(400, 'Kein API-Schlüssel hinterlegt');
            await P.AI[c.provider].checkModel({ apiKey: key, model: c.models[c.provider] });
            return { ok: true };
        }
        async function listModels(provider) {
            const c = await loadConfig();
            const id = provider || c.provider;
            if (!P.AI[id]) throw err(400, 'Unbekannter KI-Anbieter');
            const key = await aiKey(id);
            if (!key) throw err(400, 'Kein API-Schlüssel hinterlegt');
            return { models: await P.AI[id].listModels({ apiKey: key }) };
        }

        // ---- Automatik (wie utils/ai/autoGenerate.js) ----
        const usableWords = async (language) => (await ctx.liveVocab(language))
            .filter(w => w.isActive && (!w.typ || w.typ !== 'Satz') && w.it)
            .sort((a, b) => a.id - b.id);

        async function pendingWords(language) {
            const [own, base, words] = await Promise.all([
                ctx.liveVocab(language).then(l => l.filter(v => v.typ === 'Satz')),
                ctx.sentencesFor(language),
                usableWords(language)
            ]);
            const index = core.buildIndex([...own, ...base].map(s => s.it));
            const generatedFor = new Set(base.filter(s => s.forWord).map(s => core.wordKey(s.forWord, language)));
            return words.filter(w => w.it.length <= 100
                && !generatedFor.has(core.wordKey(w.it, language))
                && !core.isCovered(w, language, index)
                && !failedWords.has(w.id) && !doneWords.has(w.id));
        }

        async function backfillCandidates(language, levels) {
            const [base, words] = await Promise.all([ctx.sentencesFor(language), usableWords(language)]);
            const levelsByWord = new Map();
            base.filter(s => s.forWord).forEach(s => {
                const k = core.wordKey(s.forWord, language);
                if (!levelsByWord.has(k)) levelsByWord.set(k, new Set());
                levelsByWord.get(k).add(s.level);
            });
            const result = [];
            words.forEach(w => {
                const have = levelsByWord.get(core.wordKey(w.it, language));
                if (!have || w.it.length > 100 || failedWords.has(w.id)) return; // doneWords gilt nur für die Automatik: neue Niveaus dürfen nachgerüstet werden
                const missing = levels.filter(l => !have.has(l));
                if (missing.length > 0) result.push({ ...w, missing });
            });
            return result;
        }

        async function kiCounts(language) {
            const counts = new Map();
            (await ctx.sentencesFor(language)).filter(s => s.forWord).forEach(s => {
                const k = core.wordKey(s.forWord, language);
                counts.set(k, (counts.get(k) || 0) + 1);
            });
            return counts;
        }

        // Kosten eines Aufrufs mit `count` Sätzen: gemessener Durchschnitt (ab 5 Aufrufen mit dem Modell), sonst Schätzung
        async function estimateCall(model, count) {
            let input = DEFAULT_INPUT;
            let output = TOKENS_PER_SENTENCE * count + (core.THINKING_MODELS.test(model) ? THINKING_TOKENS : 0);
            let basis = 'estimated';
            const t = (await store.getMeta(TOTALS_KEY, {}))[model];
            if (t && t.calls >= 5) { input = t.input / t.calls; output = t.output / t.calls; basis = 'measured'; }
            return { costUsd: core.costUsd(model, input, output), basis };
        }

        async function autoStatus(language) {
            if (!core.isSupportedLanguage(language)) throw err(400, 'Sprache nicht unterstützt');
            const prefs = core.prefsForLanguage(await loadPrefs(), language);
            const [pending, backfill, config] = await Promise.all([pendingWords(language), backfillCandidates(language, prefs.levels), loadConfig()]);
            const status = {
                pending: pending.length, backfillWords: backfill.length, levels: prefs.levels, count: prefs.count, estimate: null,
                needsConfirm: prefs.enabled && pending.length > core.BULK_THRESHOLD && !bulkConfirmed.has(language), threshold: core.BULK_THRESHOLD
            };
            // Der Nutzer zahlt selbst: die Kostenvorschau gibt es immer (Preise nur für Claude-Modelle bekannt)
            const model = config.models[config.provider];
            const call = await estimateCall(model, prefs.count);
            if (call.costUsd !== null) {
                status.estimate = {
                    perCallEur: call.costUsd * USD_TO_EUR, pendingEur: pending.length * call.costUsd * USD_TO_EUR,
                    backfillEur: backfill.length * call.costUsd * USD_TO_EUR, basis: call.basis
                };
            }
            return status;
        }

        async function processWords(language, words, { levelsFor, label }) {
            const config = await loadConfig();
            const allowed = await allowedCategories(language);
            const existing = await kiCounts(language);
            let failures = 0;
            let limitReached = false;
            for (const word of words) {
                const prefs = core.prefsForLanguage(await loadPrefs(), language);
                const categories = prefs.categories.filter(c => allowed.includes(c));
                if (categories.length === 0 || (label === 'auto' && !prefs.enabled)) return true;
                const levels = levelsFor(word, prefs);
                if (levels.length === 0) continue;
                const remaining = remainingOf(config.dailyLimit, (await usage()).count);
                if (remaining !== null && remaining < prefs.count) { limitReached = true; break; } // Tageslimit: morgen weiter
                const k = core.wordKey(word.it, language);
                if ((existing.get(k) || 0) >= core.MAX_KI_FACTOR * prefs.count * prefs.levels.length) { doneWords.add(word.id); continue; }
                doneWords.add(word.id); // vor dem Aufruf merken: auch bei Fehlern kein zweiter Versuch
                try {
                    const r = await generateSentences({ word: word.it, translation: word.de || null, language, levels, categories, count: prefs.count });
                    existing.set(k, (existing.get(k) || 0) + r.sentences.length);
                    await ctx.addSentences(language, r.sentences.map(s => ({ it: s.foreign, de: s.german, category: s.category, level: s.level, forWord: word.it })));
                    await addUsage({ sentences: r.sentences.length, tokens: r.tokens, model: r.model });
                    failures = 0;
                } catch (e) {
                    failedWords.add(word.id);
                    if (++failures >= MAX_FAILURES) return true;
                }
            }
            return !limitReached;
        }

        async function runAuto() {
            if (running) return;
            running = true;
            try {
                const { ready } = await readyAi();
                if (!ready) return;
                const prefsAll = await loadPrefs();
                for (const language of core.LANGUAGES) {
                    if (prefsAll.enabled === true) {
                        const words = await pendingWords(language);
                        if (words.length === 0) bulkConfirmed.delete(language);
                        else if (words.length <= core.BULK_THRESHOLD || bulkConfirmed.has(language)) {
                            await processWords(language, words, { label: 'auto', levelsFor: (w, p) => p.levels });
                        }
                    }
                    if (backfillRequests.has(language)) {
                        const prefs = core.prefsForLanguage(await loadPrefs(), language);
                        const words = await backfillCandidates(language, prefs.levels);
                        if (await processWords(language, words, { label: 'backfill', levelsFor: (w, p) => w.missing.filter(l => p.levels.includes(l)) })) backfillRequests.delete(language);
                    }
                }
            } finally {
                running = false;
            }
        }

        const confirmBulk = (language) => {
            if (!core.isSupportedLanguage(language)) throw err(400, 'Sprache nicht unterstützt');
            bulkConfirmed.add(language);
            setTimeout(() => runAuto().catch(() => { }), 0);
            return { confirmed: true };
        };
        async function backfill(language) {
            if (!core.isSupportedLanguage(language)) throw err(400, 'Sprache nicht unterstützt');
            const prefs = core.prefsForLanguage(await loadPrefs(), language);
            if (prefs.categories.length === 0) throw err(400, 'Bitte zuerst Grammatikarten wählen und speichern');
            const status = await autoStatus(language);
            backfillRequests.add(language);
            setTimeout(() => runAuto().catch(() => { }), 0);
            return { words: status.backfillWords };
        }

        // ---- Cloudstimme ----
        async function ttsStatus() {
            const c = await loadConfig();
            const available = !!(c.tts.enabled && P.TTS[c.tts.provider] && await ttsKey(c));
            return { available, provider: available ? c.tts.provider : null };
        }

        const inflight = new Map();
        async function pruneAudio() {
            const rows = await store.scan('audio', r => ({ key: r.key, size: r.size, time: r.time }));
            let total = rows.reduce((s, r) => s + r.size, 0);
            rows.sort((a, b) => a.time - b.time);
            const drop = [];
            for (const r of rows) { if (total <= TTS_CACHE_MAX_BYTES) break; drop.push(r.key); total -= r.size; }
            await store.removeMany('audio', drop);
        }
        let ttsWrites = 0;

        // Text -> MP3 als ArrayBuffer ({ audio, cached })
        async function ttsAudio(text, lang) {
            if (!TTS_LANGS.includes(lang)) throw err(400, 'Sprache nicht unterstützt');
            const clean = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
            if (!clean) throw err(400, 'Kein Text angegeben');
            if (clean.length > TTS_MAX_TEXT) throw err(400, 'Text zu lang');
            const c = await loadConfig();
            const provider = P.TTS[c.tts.provider];
            const apiKey = provider && await ttsKey(c);
            if (!c.tts.enabled || !provider || !apiKey) throw err(503, 'Die Cloudstimme ist nicht eingerichtet');

            const voice = (c.tts.voices[c.tts.provider] || {})[lang] || provider.defaultVoices[lang];
            const key = [c.tts.provider + (provider.cacheVersion ? ':' + provider.cacheVersion : ''), voice, lang, clean].join('\u0001');
            const hit = await store.get('audio', key);
            if (hit) return { audio: hit.data, cached: true };
            if (inflight.has(key)) return { audio: await inflight.get(key), cached: true }; // gleicher Text parallel: nur einmal bezahlen

            const remaining = remainingOf(c.tts.dailyLimit, (await usage()).ttsCalls);
            if (remaining !== null && remaining <= 0) throw err(429, 'Tageslimit für Cloudstimme erreicht');
            const job = (async () => {
                const audio = await provider.synthesize({ apiKey, text: clean, lang, voice });
                await addUsage({ ttsCalls: 1 });
                await store.put('audio', { key, data: audio, size: audio.byteLength, time: now().getTime() });
                if (++ttsWrites % 50 === 0) await pruneAudio();
                return audio;
            })();
            inflight.set(key, job);
            try { return { audio: await job, cached: false }; } finally { inflight.delete(key); }
        }

        async function testTts() {
            const c = await loadConfig();
            const sample = { it: 'Ciao, come stai?', en: 'Hello, how are you?', es: 'Hola, ¿cómo estás?', de: 'Hallo, wie geht es dir?' };
            const lang = 'it';
            const provider = P.TTS[c.tts.provider];
            const apiKey = await ttsKey(c);
            if (!apiKey) throw err(400, 'Kein API-Schlüssel hinterlegt');
            const audio = await provider.synthesize({ apiKey, text: sample[lang], lang, voice: c.tts.voices[c.tts.provider][lang] || provider.defaultVoices[lang] });
            return { ok: true, bytes: audio.byteLength };
        }

        async function usageSummary() {
            const u = await usage();
            const c = await loadConfig();
            return { ...u, costEur: u.costUsd * USD_TO_EUR, dailyLimit: c.dailyLimit, ttsDailyLimit: c.tts.dailyLimit };
        }

        return {
            publicConfig, saveConfig, usageSummary, testAi, listModels, testTts,
            options, savePrefs, sentences, wordInfo, autoStatus, confirmBulk, backfill, runAuto,
            ttsStatus, ttsAudio
        };
    }

    const api = { create, createSecrets, createHttp };
    if (isNode) module.exports = api;
    else root.LocalAi = api;
})(typeof window !== 'undefined' ? window : globalThis);
