const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const LocalStore = require('../public/local-store');
const LocalApi = require('../public/local-api');
const LocalAi = require('../public/local-ai');
const core = require('../public/ai-core');

const PUBLIC = path.join(__dirname, '..', 'public');
const loadJson = async (p) => JSON.parse(fs.readFileSync(path.join(PUBLIC, p), 'utf8'));

// Simulierte Anbieter: antwortet je nach Adresse; merkt sich alle Aufrufe
function setup({ handlers = {} } = {}) {
    const calls = [];
    const secretsMap = new Map();
    const secrets = { get: async (k) => secretsMap.get(k) || null, set: async (k, v) => { secretsMap.set(k, v); }, remove: async (k) => { secretsMap.delete(k); } };
    const reply = (status, obj) => ({ status, json: async () => obj, arrayBuffer: async () => obj });
    const http = async (url, init) => {
        calls.push({ url, ...init, parsed: init.body ? JSON.parse(init.body) : null });
        for (const [prefix, fn] of Object.entries(handlers)) if (url.startsWith(prefix)) return fn({ url, init, reply, body: init.body ? JSON.parse(init.body) : null });
        return reply(404, {});
    };
    let clock = new Date('2026-10-08T10:00:00Z');
    const api = LocalApi.create({
        store: LocalStore.createMemoryBackend(), loadJson, now: () => clock,
        createAi: (ctx) => LocalAi.create({ ...ctx, secrets, http })
    });
    return { api, calls, secrets, setDay: (d) => { clock = new Date(d); } };
}

// Antwort wie die Anthropic-Messages-API
const anthropicReply = (sentences) => ({ reply }) => reply(200, {
    stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ sentences }) }], usage: { input_tokens: 500, output_tokens: 200 }
});
const goodSentence = { foreign: 'Mangio una mela.', german: 'Ich esse einen Apfel.', category: 'x', level: 'y' };

async function configure(api, extra = {}) {
    return api.handle('PUT', '/local-ai/settings', { provider: 'anthropic', enabled: true, keys: { anthropic: 'sk-ant-test-1234' }, ...extra });
}

test('Einstellungen: Schlüssel wird nie zurückgegeben, nur die letzten 4 Zeichen', async () => {
    const { api } = setup();
    let cfg = await api.handle('GET', '/local-ai/settings');
    assert.strictEqual(cfg.providers.anthropic.keySet, false);
    cfg = await configure(api);
    assert.strictEqual(cfg.providers.anthropic.keySet, true);
    assert.strictEqual(cfg.providers.anthropic.keyHint, '••••1234');
    assert.ok(!JSON.stringify(cfg).includes('sk-ant'));
    cfg = await api.handle('PUT', '/local-ai/settings', { keys: { anthropic: '' } });
    assert.strictEqual(cfg.providers.anthropic.keySet, false);
    await assert.rejects(api.handle('PUT', '/local-ai/settings', { provider: 'nope' }), (e) => e.status === 400);
});

test('Optionen: ohne Schlüssel nicht verfügbar, mit Schlüssel mit Grammatikarten und Rest', async () => {
    const { api } = setup();
    let o = await api.handle('GET', '/ai/options?language=it');
    assert.strictEqual(o.enabled, false);
    assert.deepStrictEqual(o.categories, []);
    await configure(api);
    o = await api.handle('GET', '/ai/options?language=it');
    assert.strictEqual(o.enabled, true);
    assert.strictEqual(o.remaining, 50);
    assert.ok(o.categories.includes('Presente') && o.categories.includes('Congiuntivo'));
    assert.deepStrictEqual(o.prefs.levels, ['A1']);
    await assert.rejects(api.handle('GET', '/ai/options?language=xx'), (e) => e.status === 400);
});

test('Sätze erzeugen: Anfrage an Anthropic, Plan bestimmt Art und Niveau, Verbrauch wird gezählt', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': anthropicReply([goodSentence, goodSentence, { ...goodSentence, foreign: '' }]) } });
    await configure(api, { models: { anthropic: 'claude-haiku-4-5' } });
    const r = await api.handle('POST', '/ai/sentences', { word: 'mangiare', translation: 'essen', language: 'it', levels: ['A1', 'B1'], categories: ['Presente', 'Imperativo', 'Unbekannt'], count: 3 });
    assert.strictEqual(r.sentences.length, 2); // leerer Satz fällt weg
    assert.ok(r.sentences.every(s => ['Presente', 'Imperativo'].includes(s.category) && ['A1', 'B1'].includes(s.level)));
    assert.strictEqual(r.remaining, 50 - 2);
    const req = calls[0];
    assert.strictEqual(req.headers['x-api-key'], 'sk-ant-test-1234');
    assert.strictEqual(req.headers['anthropic-version'], '2023-06-01');
    assert.strictEqual(req.parsed.model, 'claude-haiku-4-5');
    assert.strictEqual(req.parsed.system, core.SYSTEM_PROMPT);
    assert.ok(req.parsed.messages[0].content.includes('Wort: mangiare'));
    assert.ok(!req.parsed.messages[0].content.includes('Unbekannt')); // nicht erlaubte Art kommt nie in den Prompt
    assert.strictEqual(req.parsed.output_config.format.type, 'json_schema');
    const usage = await api.handle('GET', '/local-ai/usage');
    assert.strictEqual(usage.count, 2);
    assert.strictEqual(usage.inputTokens, 500);
    assert.ok(usage.costUsd > 0);
});

test('Claude 5: niedrige Denktiefe und Fallback-Kopfzeile', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': anthropicReply([goodSentence]) } });
    await configure(api, { models: { anthropic: 'claude-opus-5-5' } });
    await api.handle('POST', '/ai/sentences', { word: 'casa', language: 'it', levels: ['A1'], categories: ['Presente'], count: 1 });
    assert.strictEqual(calls[0].parsed.output_config.effort, 'low');
    assert.strictEqual(calls[0].parsed.fallbacks, 'default');
    assert.strictEqual(calls[0].headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
});

test('Tageslimit: zu viele Sätze auf einmal werden abgelehnt, neuer Tag setzt zurück, 0 = unbegrenzt', async () => {
    const { api, setDay } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': anthropicReply([goodSentence, goodSentence, goodSentence]) } });
    await configure(api, { dailyLimit: 4 });
    const body = { word: 'casa', language: 'it', levels: ['A1'], categories: ['Presente'], count: 3 };
    await api.handle('POST', '/ai/sentences', body);
    await assert.rejects(api.handle('POST', '/ai/sentences', body), (e) => e.status === 429 && /nur noch 1 Satz/.test(e.message));
    setDay('2026-10-09T08:00:00Z');
    assert.strictEqual((await api.handle('GET', '/ai/options?language=it')).remaining, 4);
    await api.handle('PUT', '/local-ai/settings', { dailyLimit: 0 });
    assert.strictEqual((await api.handle('GET', '/ai/options?language=it')).remaining, null);
});

test('Anbieterfehler werden verständlich gemeldet', async () => {
    let status = 401;
    const { api } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': ({ reply }) => reply(status, { error: { message: 'kaputt' } }) } });
    await configure(api);
    const body = { word: 'casa', language: 'it', levels: ['A1'], categories: ['Presente'], count: 1 };
    await assert.rejects(api.handle('POST', '/ai/sentences', body), (e) => e.status === 400 && e.message === 'API-Schlüssel ungültig');
    status = 429;
    await assert.rejects(api.handle('POST', '/ai/sentences', body), (e) => e.status === 429);
    status = 500;
    await assert.rejects(api.handle('POST', '/ai/sentences', body), (e) => e.status === 502 && /500/.test(e.message));
});

test('Ohne Einrichtung: Meldungen, auf die das Frontend reagiert', async () => {
    const { api } = setup();
    await assert.rejects(api.handle('POST', '/ai/word-info', { word: 'casa', language: 'it' }), (e) => /nicht aktiviert/.test(e.message));
    await api.handle('PUT', '/local-ai/settings', { enabled: true });
    await assert.rejects(api.handle('POST', '/ai/word-info', { word: 'casa', language: 'it' }), (e) => /Kein gültiger/.test(e.message));
});

test('Wortinfo über OpenAI', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.openai.com/v1/chat/completions': ({ reply }) => reply(200, {
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ typ: 'Substantiv', gender: 'f-sg' }) } }], usage: { prompt_tokens: 100, completion_tokens: 10 } }) } });
    await configure(api, { provider: 'openai', keys: { openai: 'sk-openai-9999' } });
    assert.deepStrictEqual(await api.handle('POST', '/ai/word-info', { word: 'casa', translation: 'Haus', language: 'it' }), { typ: 'Substantiv', grammatica: 'f-sg' });
    assert.strictEqual(calls[0].headers.authorization, 'Bearer sk-openai-9999');
    assert.strictEqual(calls[0].parsed.response_format.type, 'json_schema');
    assert.deepStrictEqual(await api.handle('POST', '/ai/word-info', { word: 'run', language: 'en' }), { typ: 'Substantiv', grammatica: '' }); // Geschlecht nur it/es
});

test('Modelle laden und Verbindung prüfen', async () => {
    const { api } = setup({ handlers: {
        'https://api.anthropic.com/v1/models?': ({ reply }) => reply(200, { data: [{ id: 'claude-haiku-4-5', display_name: 'Haiku 4.5' }] }),
        'https://api.anthropic.com/v1/models/': ({ reply }) => reply(200, {})
    } });
    await configure(api);
    assert.deepStrictEqual((await api.handle('GET', '/local-ai/models?provider=anthropic')).models, [{ id: 'claude-haiku-4-5', name: 'Haiku 4.5' }]);
    assert.deepStrictEqual(await api.handle('POST', '/local-ai/test'), { ok: true });
});

test('Automatik: erzeugt Sätze für Wörter ohne Satz, speichert sie mit forWord, nie doppelt', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': anthropicReply([goodSentence, goodSentence]) } });
    await configure(api);
    await api.handle('POST', '/vocab/bulk', { language: 'it', words: [{ de: 'Zebra', it: 'zebrina', typ: 'Substantiv' }, { de: 'Tisch', it: 'tavolo', typ: 'Substantiv', isActive: false }] });
    let st = await api.handle('GET', '/ai/auto-status?language=it');
    assert.strictEqual(st.pending, 1); // inaktives Wort zählt nicht
    await api.handle('PUT', '/ai/preferences', { language: 'it', enabled: true, levels: ['A1'], categories: ['Presente'], count: 2 });
    await api.ai.runAuto();
    const list = await api.handle('GET', '/grammar-sentences?language=it');
    const ki = list.filter(s => s.forWord);
    assert.strictEqual(ki.length, 2);
    assert.ok(ki.every(s => s.forWord === 'zebrina' && s.id >= 1000000 && s.manualActive === false));
    st = await api.handle('GET', '/ai/auto-status?language=it');
    assert.strictEqual(st.pending, 0);
    const before = calls.length;
    await api.ai.runAuto();
    assert.strictEqual(calls.length, before); // zweiter Lauf: nichts mehr zu tun
    assert.strictEqual((await api.handle('GET', '/local-ai/usage')).count, 2);
});

test('Automatik: große Mengen warten auf Freigabe', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': anthropicReply([goodSentence]) } });
    await configure(api, { dailyLimit: 0 });
    await api.handle('POST', '/vocab/bulk', { language: 'it', words: Array.from({ length: 52 }, (_, i) => ({ de: `w${i}`, it: `parolaxyz${i}qq`, typ: 'Substantiv' })) });
    await api.handle('PUT', '/ai/preferences', { language: 'it', enabled: true, levels: ['A1'], categories: ['Presente'], count: 1 });
    await api.ai.runAuto();
    assert.strictEqual(calls.length, 0);
    const st = await api.handle('GET', '/ai/auto-status?language=it');
    assert.strictEqual(st.needsConfirm, true);
    assert.strictEqual(st.pending, 52);
    await api.handle('POST', '/ai/confirm-bulk', { language: 'it' });
    await new Promise(r => setTimeout(r, 50));
    await api.ai.runAuto();
    assert.ok(calls.length > 0);
});

test('Automatik bricht nach drei Fehlern in Folge ab', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': ({ reply }) => reply(500, {}) } });
    await configure(api);
    await api.handle('POST', '/vocab/bulk', { language: 'it', words: Array.from({ length: 6 }, (_, i) => ({ de: `w${i}`, it: `parolaxyz${i}qq`, typ: 'Substantiv' })) });
    await api.handle('PUT', '/ai/preferences', { language: 'it', enabled: true, levels: ['A1'], categories: ['Presente'], count: 1 });
    await api.ai.runAuto();
    assert.strictEqual(calls.length, 3);
});

test('Nachrüsten: fehlende Niveaus für Wörter mit KI-Sätzen', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': anthropicReply([goodSentence]) } });
    await configure(api);
    await api.handle('POST', '/vocab', { de: 'Zebra', it: 'zebrina', typ: 'Substantiv', language: 'it' });
    await api.handle('PUT', '/ai/preferences', { language: 'it', enabled: false, levels: ['A1'], categories: ['Presente'], count: 1 });
    await api.ai.runAuto(); // Automatik aus: nichts
    assert.strictEqual(calls.length, 0);
    // Ein Satz auf Niveau A1 existiert, B1 fehlt
    await api.ai.runAuto();
    await api.handle('PUT', '/ai/preferences', { language: 'it', enabled: true, levels: ['A1'], categories: ['Presente'], count: 1 });
    await api.ai.runAuto();
    await api.handle('PUT', '/ai/preferences', { language: 'it', enabled: false, levels: ['A1', 'B1'], categories: ['Presente'], count: 1 });
    const st = await api.handle('GET', '/ai/auto-status?language=it');
    assert.strictEqual(st.backfillWords, 1);
    assert.deepStrictEqual(st.levels, ['A1', 'B1']);
    const before = calls.length;
    assert.deepStrictEqual(await api.handle('POST', '/ai/backfill', { language: 'it' }), { words: 1 });
    await new Promise(r => setTimeout(r, 50));
    await api.ai.runAuto();
    assert.strictEqual(calls.length, before + 1);
    assert.strictEqual(calls[calls.length - 1].parsed.messages[0].content.includes('Niveau: B1'), true);
});

test('Cloudstimme: eingerichtet erst mit Schlüssel, Zwischenspeicher spart Aufrufe, Tageslimit', async () => {
    const audio = new Uint8Array([1, 2, 3, 4]).buffer;
    const { api, calls } = setup({ handlers: { 'https://api.openai.com/v1/audio/speech': ({ reply }) => reply(200, audio) } });
    assert.deepStrictEqual(await api.handle('GET', '/tts/status'), { available: false, provider: null });
    await api.handle('PUT', '/local-ai/settings', { tts: { provider: 'openai', enabled: true, dailyLimit: 2, keys: { openai: 'sk-tts-5555' } } });
    assert.deepStrictEqual(await api.handle('GET', '/tts/status'), { available: true, provider: 'openai' });
    const a = await api.ai.ttsAudio('ciao', 'it');
    assert.strictEqual(a.cached, false);
    assert.strictEqual(a.audio.byteLength, 4);
    assert.strictEqual(calls[0].binary, true);
    assert.strictEqual(calls[0].parsed.model, 'gpt-4o-mini-tts');
    assert.ok(calls[0].parsed.instructions.includes('Italian'));
    assert.strictEqual((await api.ai.ttsAudio('ciao', 'it')).cached, true);
    assert.strictEqual(calls.length, 1);
    await api.ai.ttsAudio('buongiorno', 'it');
    await assert.rejects(api.ai.ttsAudio('arrivederci', 'it'), (e) => e.status === 429);
    assert.strictEqual((await api.ai.ttsAudio('ciao', 'it')).cached, true); // aus dem Zwischenspeicher trotz Limit
    await assert.rejects(api.ai.ttsAudio('', 'it'), (e) => e.status === 400);
    await assert.rejects(api.ai.ttsAudio('x'.repeat(301), 'it'), (e) => e.status === 400);
    await assert.rejects(api.ai.ttsAudio('hi', 'xx'), (e) => e.status === 400);
});

test('Cloudstimme über OpenAI nutzt den KI-Schlüssel mit, wenn kein eigener hinterlegt ist', async () => {
    const { api } = setup({ handlers: { 'https://api.openai.com/v1/audio/speech': ({ reply }) => reply(200, new ArrayBuffer(8)) } });
    await api.handle('PUT', '/local-ai/settings', { keys: { openai: 'sk-shared-7777' }, tts: { provider: 'openai', enabled: true } });
    assert.strictEqual((await api.handle('GET', '/tts/status')).available, true);
    assert.strictEqual((await api.handle('GET', '/local-ai/settings')).tts.providers.openai.sharesAiKey, true);
});

test('Google-Stimme: Antwort in Base64 wird zu Audio', async () => {
    const { api, calls } = setup({ handlers: { 'https://texttospeech.googleapis.com/v1/text:synthesize': ({ reply }) => reply(200, { audioContent: Buffer.from([9, 8, 7]).toString('base64') }) } });
    await api.handle('PUT', '/local-ai/settings', { tts: { provider: 'google', enabled: true, keys: { google: 'g-key-1111' } } });
    const a = await api.ai.ttsAudio('ciao', 'it');
    assert.deepStrictEqual([...new Uint8Array(a.audio)], [9, 8, 7]);
    assert.strictEqual(calls[0].headers['x-goog-api-key'], 'g-key-1111');
    assert.strictEqual(calls[0].parsed.voice.languageCode, 'it-IT');
});

test('Gemeinsamer Kern: Plan verteilt Arten und Niveaus gleichmäßig, Wortschlüssel ohne Artikel', () => {
    const plan = core.buildPlan(['A', 'B'], ['A1', 'B1'], 4, () => 0.5);
    assert.strictEqual(plan.length, 4);
    assert.strictEqual(plan.filter(p => p.category === 'A').length, 2);
    assert.strictEqual(core.wordKey('la casa', 'it'), core.wordKey('casa', 'it'));
    assert.strictEqual(core.wordKey('to run', 'en'), 'run');
    assert.deepStrictEqual(core.categoriesFor('en', ['Present Simple (Comparative)', 'Grammatik', 'Simple Present + Modalverb']).filter(c => /Comparative|Grammatik/.test(c)), []);
    assert.strictEqual(core.costUsd('gpt-5', 1000, 1000), null);
});

// Antwort der KI für die Verben aus dem Prompt ("Verben: a, b, c"); `bad` ist kein echtes Verb
function verbReply(bad = []) {
    const six = (s) => ['io', 'tu', 'lui', 'noi', 'voi', 'loro'].map(p => `${s}${p}`);
    return ({ reply, body }) => {
        const verbs = body.messages[0].content.split('Verben: ')[1].split(', ');
        const out = verbs.map(infinitive => (bad.includes(infinitive)
            ? { infinitive, valid: false, presente: [], imperfetto: [], futuro: [], condizionale: [], congiuntivo: [], imperativo: { tu: '', Lei: '', noi: '', voi: '' }, participio: '', aux: 'avere', gerundio: '' }
            : { infinitive, valid: true, presente: six(infinitive), imperfetto: six(infinitive), futuro: six(infinitive), condizionale: six(infinitive), congiuntivo: six(infinitive),
                imperativo: { tu: 'a', Lei: 'b', noi: 'c', voi: 'd' }, participio: `${infinitive}to`, aux: 'avere', gerundio: `${infinitive}ndo` }));
        return reply(200, { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ verbs: out }) }], usage: { input_tokens: 800, output_tokens: 900 } });
    };
}

test('Verbprüfung: offene Verben zählen, in Paketen prüfen, Ergebnis wie vom Server ausliefern', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': verbReply(['pippare']) } });
    await configure(api);
    await api.handle('POST', '/vocab', { de: 'Quatsch', it: 'pippare', typ: 'Verb', language: 'it' });
    await api.handle('POST', '/vocab', { de: 'waschen', it: 'lavarsi', typ: 'Verb', language: 'it' });
    const st = await api.handle('GET', '/local-ai/verb-status?language=it');
    assert.ok(st.pending > 100, `offen: ${st.pending}`);
    assert.strictEqual(st.verified, 0);
    assert.ok(st.estimateEur > 0);

    const run = await api.handle('POST', '/local-ai/verb-check', { language: 'it' });
    assert.strictEqual(run.left, 0);
    assert.strictEqual(run.saved, st.pending);
    assert.strictEqual(calls.length, Math.ceil(st.pending / core.VERB_BATCH_SIZE));
    assert.ok(calls.every(c => c.parsed.system === core.VERB_SYSTEM));

    const all = await api.handle('GET', '/verb-forms?language=it');
    const lavare = all.verbs.find(v => v.infinitive === 'lavare'); // reflexiv -> Grundform
    assert.ok(lavare && lavare.status === 'verified' && lavare.forms.presente.length === 6 && lavare.forms.aux === 'avere');
    assert.ok(!all.verbs.some(v => v.infinitive === 'pippare')); // ungültige Verben nicht in der Standardliste
    const delta = await api.handle('GET', `/verb-forms?language=it&since=${encodeURIComponent('2000-01-01T00:00:00Z')}`);
    assert.ok(delta.verbs.some(v => v.infinitive === 'pippare' && v.status === 'invalid' && v.forms === null));
    assert.strictEqual((await api.handle('GET', `/verb-forms?language=it&since=${encodeURIComponent('2999-01-01T00:00:00Z')}`)).verbs.length, 0);
    assert.strictEqual((await api.handle('GET', '/local-ai/verb-status?language=it')).pending, 0);

    const before = calls.length;
    await api.handle('POST', '/local-ai/verb-check', { language: 'it' });
    assert.strictEqual(calls.length, before); // nichts mehr offen: kein Aufruf
});

test('Verbprüfung: bei Anbieterfehlern Abbruch mit verständlicher Meldung', async () => {
    const { api, calls } = setup({ handlers: { 'https://api.anthropic.com/v1/messages': ({ reply }) => reply(401, {}) } });
    await configure(api);
    await assert.rejects(api.handle('POST', '/local-ai/verb-check', { language: 'it' }), (e) => e.message === 'API-Schlüssel ungültig');
    assert.strictEqual(calls.length, 3);
    assert.strictEqual((await api.handle('GET', '/verb-forms?language=it')).verbs.length, 0);
});
