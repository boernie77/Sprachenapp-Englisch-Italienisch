// Lokaler "Server" für den Betrieb ohne Server (Standalone-Modus).
// Beantwortet dieselben Routen wie routes/vocab.js, auth.js, grammar.js, baseVocab.js, aber aus dem Gerätespeicher
// (local-store.js). apiFetch() im Frontend ruft LocalApi.handle(method, endpoint, body) statt fetch() auf; die Antworten haben
// dieselbe Form wie die des Servers, damit der übrige Code unverändert bleibt.
// Gelöschtes bleibt als Markierung (deleted + updatedAt) erhalten – Grundlage für den späteren Abgleich mit einem Server.
(function (root) {
    'use strict';

    const DATA_VERSION = 1; // erhöhen, wenn die mitgelieferten Basisdaten (data/*.json) sich ändern
    const SENTENCE_ID_BASE = { it: 100000, en: 200000, es: 300000 }; // feste Nummern der mitgelieferten Sätze
    const USER_SENTENCE_START = 1000000;
    const LOCAL_USER_ID = 1;
    const LOCAL_TOKEN = 'local';

    const httpError = (status, message) => Object.assign(new Error(message || `HTTP error! status: ${status}`), { status });
    const newSid = () => (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID()
        : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    const zeroStat = (vocabId) => ({ vocabId, presented: 0, correct: 0, incorrect: 0, streak: 0, lastReviewedDate: null, nextReviewDate: null });
    const STAT_FIELDS = ['presented', 'correct', 'incorrect', 'streak', 'lastReviewedDate', 'nextReviewDate'];

    // Wie routes/grammar.js: im manuellen Modus sind Excel-Sätze aktiv, KI-Sätze (forWord) erst nach Auswahl
    const defaultActive = (sentence) => !sentence.forWord;

    // createAi (optional): Fabrik für die KI-Funktionen (local-ai.js); ohne sie melden die KI-Routen „nicht eingerichtet“
    function create({ store, loadJson, now = () => new Date(), createAi = null }) {
        const iso = () => now().toISOString();
        const baseCache = {};
        let chain = Promise.resolve();

        // Schreibzugriffe nacheinander ausführen (kein Durcheinander bei schnell aufeinanderfolgenden Antworten)
        function serial(fn) {
            const run = chain.then(fn);
            chain = run.catch(() => { });
            return run;
        }

        async function nextIds(key, start, count) {
            const next = await store.getMeta(key, start);
            await store.setMeta(key, next + count);
            return next;
        }

        function outVocab(v, stat) {
            const { deleted, sid, ...rest } = v;
            const s = stat || zeroStat(v.id);
            const Stat = { id: s.vocabId, VocabularyId: v.id };
            STAT_FIELDS.forEach(f => { Stat[f] = s[f]; });
            return { ...rest, Stat };
        }

        function newVocab(id, w, language) {
            const t = iso();
            return {
                id, sid: newSid(),
                de: w.de, it: w.it, typ: w.typ || null, emoji: w.emoji || null, grammatica: w.grammatica || null,
                level: w.level || null, forWord: w.forWord || null,
                isActive: w.isActive !== false, isMarked: w.isMarked === true, isOwn: w.isOwn !== false,
                language: language || w.language || 'it',
                createdAt: t, updatedAt: t, deleted: false
            };
        }

        async function createVocab(words, language) {
            if (!Array.isArray(words)) throw httpError(400, 'words must be an array');
            const first = await nextIds('seq-vocab', 1, words.length);
            const vocab = words.map((w, i) => newVocab(first + i, w, language || w.language));
            await store.putMany('vocab', vocab);
            const stats = vocab.map(v => zeroStat(v.id));
            await store.putMany('stats', stats);
            return vocab.map((v, i) => outVocab(v, stats[i]));
        }

        async function liveVocab(language) {
            const all = await store.getAll('vocab');
            return all.filter(v => !v.deleted && (!language || v.language === language));
        }

        async function touchVocab(list, patch) {
            const t = iso();
            const changed = list.map(v => ({ ...v, ...patch, updatedAt: t }));
            await store.putMany('vocab', changed);
            return changed;
        }

        // ---- Basisdaten (mitgeliefert) ----
        async function baseVocab(language) {
            if (!baseCache[language]) {
                try { baseCache[language] = await loadJson(`data/base-vocab-${language}.json`); } catch (e) { baseCache[language] = []; }
            }
            return baseCache[language].map((v, i) => ({ id: (SENTENCE_ID_BASE[language] || 0) + i, language, ...v }));
        }

        // Mitgelieferte Sätze beim ersten Zugriff (und nach einer neuen Datenversion) in den Speicher übernehmen.
        async function ensureSentences(language) {
            const base = SENTENCE_ID_BASE[language];
            if (!base) return;
            const key = `seed-sentences-${language}`;
            if ((await store.getMeta(key, 0)) === DATA_VERSION) return;
            let list = [];
            try { list = await loadJson(`data/sentences-${language}.json`); } catch (e) { return; }
            const existing = await store.getAll('sentences');
            const range = (id) => id >= base && id < base + 100000;
            await store.removeMany('sentences', existing.filter(s => range(s.id)).map(s => s.id));
            await store.putMany('sentences', list.map((s, i) => ({ id: base + i, it: s.it, de: s.de, category: s.category || null, level: s.level || null, language, forWord: null })));
            await store.setMeta(key, DATA_VERSION);
        }

        async function sentenceList(language) {
            await ensureSentences(language);
            const [sentences, choices] = await Promise.all([store.getAll('sentences'), store.getAll('choices')]);
            const chosen = new Map(choices.map(c => [c.sentenceId, c.isActive]));
            return sentences
                .filter(s => !s.deleted && (!language || s.language === language))
                .map(s => ({ ...s, manualActive: chosen.has(s.id) ? chosen.get(s.id) : defaultActive(s) }));
        }

        // Sätze einer Sprache (mitgelieferte, selbst erzeugte KI-Sätze) für die KI-Funktionen
        async function sentencesFor(language) {
            await ensureSentences(language);
            return (await store.getAll('sentences')).filter(s => !s.deleted && s.language === language);
        }
        async function addSentences(language, list) {
            if (!list.length) return;
            const first = await nextIds('seq-sentence', USER_SENTENCE_START, list.length);
            await store.putMany('sentences', list.map((s, i) => ({
                id: first + i, it: s.it, de: s.de, category: s.category || null, level: s.level || null, language, forWord: s.forWord || null
            })));
        }
        const ai = createAi ? createAi({ store, now, sentencesFor, addSentences: (l, list) => serial(() => addSentences(l, list)), liveVocab, baseVocab }) : null;

        // ---- Routen ----
        const routes = [];
        const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern}$`), fn });

        // vocab
        route('GET', '/vocab', async ({ q }) => {
            const [vocab, stats] = await Promise.all([liveVocab(q.get('language')), store.getAll('stats')]);
            const byId = new Map(stats.map(s => [s.vocabId, s]));
            return vocab.map(v => outVocab(v, byId.get(v.id)));
        });
        route('POST', '/vocab', ({ body, q }) => serial(async () => {
            const [created] = await createVocab([body], body.language || q.get('language') || 'it');
            return created;
        }));
        route('POST', '/vocab/bulk', ({ body, q }) => serial(() =>
            createVocab(body.words, body.language || q.get('language') || 'it')));

        route('PUT', '/vocab/stats/reset', () => serial(async () => {
            const stats = (await store.getAll('stats')).map(s => zeroStat(s.vocabId));
            await store.putMany('stats', stats);
            await store.setMeta('dailyActivity', {});
            await store.setMeta('lastResetAt', iso());
            return { message: 'All statistics reset successfully' };
        }));
        route('PUT', '/vocab/bulk-active', ({ body }) => serial(async () => {
            if (typeof body.isActive !== 'boolean') throw httpError(400, 'isActive must be boolean');
            let list = await liveVocab(body.language);
            if (body.typ === 'Satz') list = list.filter(v => v.typ === 'Satz');
            else if (body.typ === 'vocab') list = list.filter(v => v.typ !== 'Satz');
            await touchVocab(list, { isActive: body.isActive });
            return { message: 'Updated' };
        }));
        route('PUT', '/vocab/(\\d+)/stats', ({ params, body }) => serial(async () => {
            const id = Number(params[0]);
            const v = await store.get('vocab', id);
            if (!v || v.deleted) throw httpError(404);
            const patch = {};
            if (body.isActive !== undefined) patch.isActive = body.isActive;
            if (body.isMarked !== undefined) patch.isMarked = body.isMarked;
            if (Object.keys(patch).length) await touchVocab([v], patch);
            const stat = (await store.get('stats', id)) || zeroStat(id);
            STAT_FIELDS.forEach(f => { if (body[f] !== undefined) stat[f] = body[f]; });
            stat.updatedAt = iso();
            await store.put('stats', stat);
            return { message: 'Stats and status updated' };
        }));
        route('PUT', '/vocab/(\\d+)', ({ params, body }) => serial(async () => {
            const v = await store.get('vocab', Number(params[0]));
            if (!v || v.deleted) throw httpError(404);
            const patch = {};
            ['de', 'it', 'typ', 'emoji', 'grammatica'].forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
            if (body.level !== undefined) patch.level = body.level || null;
            const [changed] = await touchVocab([v], patch);
            return outVocab(changed, await store.get('stats', changed.id));
        }));
        route('DELETE', '/vocab/clear/all', ({ q }) => serial(async () => {
            const isOwn = q.get('isOwn');
            if (isOwn !== 'true' && isOwn !== 'false') throw httpError(400, "Sicherheits-Abbruch: Parameter 'isOwn' (true/false) fehlt zwingend!");
            let list = await liveVocab(q.get('language'));
            const typ = q.get('typ');
            if (typ === 'Satz') list = list.filter(v => v.typ === 'Satz');
            else if (typ === 'Vocab') list = list.filter(v => v.typ !== 'Satz');
            list = list.filter(v => (isOwn === 'true' ? v.isOwn === true : !v.isOwn));
            await touchVocab(list, { deleted: true });
            return { message: 'Vocabulary cleared' };
        }));
        route('DELETE', '/vocab/(\\d+)', ({ params }) => serial(async () => {
            const v = await store.get('vocab', Number(params[0]));
            if (!v || v.deleted) throw httpError(404);
            await touchVocab([v], { deleted: true });
            return { message: 'Deleted' };
        }));

        // Basisliste und Grammatiksätze
        route('GET', '/base-vocab', ({ q }) => baseVocab(q.get('language') || 'it'));
        route('GET', '/grammar-sentences', ({ q }) => sentenceList(q.get('language')));
        route('GET', '/grammar-sentences/settings', async () => ({ mode: (await store.getMeta('sentenceMode', 'auto')) === 'manual' ? 'manual' : 'auto' }));
        route('PUT', '/grammar-sentences/settings', ({ body }) => serial(async () => {
            const { mode, language, activeIds } = body;
            if (!['auto', 'manual'].includes(mode)) throw httpError(400, 'Ungültiger Modus');
            await store.setMeta('sentenceMode', mode);
            if (mode === 'manual' && language && Array.isArray(activeIds)) {
                const ki = (await store.getAll('sentences')).filter(s => s.language === language && s.forWord);
                const choices = await store.getAll('choices');
                const kiIds = new Set(ki.map(s => s.id));
                if (!choices.some(c => kiIds.has(c.sentenceId))) {
                    await store.putMany('choices', activeIds.map(Number).filter(id => kiIds.has(id)).map(id => ({ sentenceId: id, isActive: true })));
                }
            }
            return { mode };
        }));
        route('PUT', '/grammar-sentences/active', ({ body }) => serial(async () => {
            if (typeof body.isActive !== 'boolean') throw httpError(400, 'isActive must be boolean');
            let sentences = (await store.getAll('sentences')).filter(s => !s.deleted);
            if (body.all === true) {
                if (!body.language) throw httpError(400, 'Language required');
                sentences = sentences.filter(s => s.language === body.language);
            } else {
                const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger));
                if (ids.size === 0 || ids.size > 20000) throw httpError(400, 'Ungültige Satzliste');
                sentences = sentences.filter(s => ids.has(s.id));
            }
            await store.removeMany('choices', sentences.map(s => s.id));
            await store.putMany('choices', sentences.filter(s => defaultActive(s) !== body.isActive).map(s => ({ sentenceId: s.id, isActive: body.isActive })));
            return { changed: sentences.length };
        }));

        // Konto (nur ein lokales Profil)
        route('GET', '/auth/me', async () => ({
            id: LOCAL_USER_ID, email: '', name: await store.getMeta('name', null), isAdmin: false,
            dailyActivity: await store.getMeta('dailyActivity', {}), lastResetAt: await store.getMeta('lastResetAt', null),
            sso: false, local: true
        }));
        route('POST', '/auth/refresh', async () => ({ token: LOCAL_TOKEN, isAdmin: false, name: await store.getMeta('name', null) }));
        route('PUT', '/auth/profile', ({ body }) => serial(async () => {
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            if (!name || name.length > 100) throw httpError(400, 'Ungültiger Name (1-100 Zeichen erforderlich)');
            await store.setMeta('name', name);
            return { message: 'Profile updated', name };
        }));
        route('PUT', '/auth/daily-activity', ({ body }) => serial(async () => {
            const client = body.dailyActivity || body || {};
            const merged = { ...(await store.getMeta('dailyActivity', {})) };
            for (const [date, count] of Object.entries(client)) {
                if (date !== 'dailyActivity') merged[date] = Math.max(merged[date] || 0, count);
            }
            await store.setMeta('dailyActivity', merged);
            return { message: 'Daily activity merged', dailyActivity: merged };
        }));
        route('POST', '/auth/activity-delta', ({ body }) => serial(async () => {
            if (!body.date || typeof body.count !== 'number') throw httpError(400, 'Invalid delta');
            const activity = await store.getMeta('dailyActivity', {});
            activity[body.date] = (activity[body.date] || 0) + body.count;
            await store.setMeta('dailyActivity', activity);
            return { message: 'Activity incremented', dailyActivity: activity };
        }));

        // KI und Cloudstimme: mit eigenem Schlüssel direkt aus der App (local-ai.js); ohne diese Funktionen als nicht eingerichtet melden
        if (ai) {
            route('GET', '/ai/options', ({ q }) => ai.options(q.get('language')));
            route('PUT', '/ai/preferences', ({ body }) => ai.savePrefs(body));
            route('GET', '/ai/auto-status', ({ q }) => ai.autoStatus(q.get('language')));
            route('POST', '/ai/confirm-bulk', ({ body }) => ai.confirmBulk(body.language));
            route('POST', '/ai/backfill', ({ body }) => ai.backfill(body.language));
            route('POST', '/ai/word-info', ({ body }) => ai.wordInfo(body));
            route('POST', '/ai/sentences', ({ body }) => ai.sentences(body));
            route('GET', '/tts/status', () => ai.ttsStatus());
            route('GET', '/local-ai/settings', () => ai.publicConfig());
            route('PUT', '/local-ai/settings', ({ body }) => ai.saveConfig(body));
            route('GET', '/local-ai/usage', () => ai.usageSummary());
            route('GET', '/local-ai/models', ({ q }) => ai.listModels(q.get('provider')));
            route('POST', '/local-ai/test', () => ai.testAi());
            route('POST', '/local-ai/tts-test', () => ai.testTts());
            route('GET', '/local-ai/verb-status', ({ q }) => ai.verbStatus(q.get('language')));
            route('POST', '/local-ai/verb-check', ({ body }) => ai.verbCheckRun(body.language));
        } else {
            route('GET', '/tts/status', async () => ({ available: false, provider: null }));
            route('GET', '/ai/options', async () => ({
                enabled: false, provider: null, levels: ['A1', 'A2', 'B1', 'B2'], categories: [], newCategories: [], maxCount: 10, remaining: 0, dailyLimit: 0,
                prefs: { enabled: false, levels: ['A1'], count: 3, categories: [] }
            }));
        }

        // Geprüfte Verbformen: aus der Prüfung per KI in der App (ohne KI-Einrichtung leer)
        route('GET', '/verb-forms', ({ q }) => (ai ? ai.verbForms(q.get('language'), q.get('since')) : { now: iso(), verbs: [] }));

        async function handle(method, endpoint, body) {
            const [path, query] = String(endpoint).split('?');
            const q = new URLSearchParams(query || '');
            const m = String(method || 'GET').toUpperCase();
            for (const r of routes) {
                if (r.method !== m) continue;
                const match = r.re.exec(path);
                if (match) return JSON.parse(JSON.stringify(await r.fn({ q, body: body || {}, params: match.slice(1) }) ?? null));
            }
            throw httpError(404, `Lokal nicht verfügbar: ${m} ${path}`);
        }

        // Sicherung / Wiederherstellung des gesamten lokalen Bestands (auch Grundlage für den Serverabgleich)
        async function exportData() {
            const out = { format: 'lernapp-local', version: 1, exportedAt: iso() };
            for (const s of ['vocab', 'stats', 'sentences', 'choices', 'meta']) { // ohne audio (nur Zwischenspeicher)
                out[s] = await store.getAll(s);
            }
            return out;
        }
        async function importData(data) {
            if (!data || data.format !== 'lernapp-local') throw httpError(400, 'Keine Lernapp-Sicherung');
            return serial(async () => {
                for (const s of ['vocab', 'stats', 'sentences', 'choices', 'meta']) {
                    await store.clear(s);
                    await store.putMany(s, data[s] || []);
                }
            });
        }
        async function wipe() { return serial(() => store.destroy()); }

        return { handle, exportData, importData, wipe, ai, LOCAL_TOKEN, LOCAL_USER_ID };
    }

    const api = { create, LOCAL_TOKEN, LOCAL_USER_ID, DATA_VERSION };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LocalApi = api;
})(typeof window !== 'undefined' ? window : globalThis);
