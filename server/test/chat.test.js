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

// Simulierter Anbieter (Anthropic-Messages-API); `answer` bestimmt die JSON-Antwort des Modells
function setup(answer) {
    const calls = [];
    const secretsMap = new Map();
    const secrets = { get: async (k) => secretsMap.get(k) || null, set: async (k, v) => { secretsMap.set(k, v); }, remove: async (k) => { secretsMap.delete(k); } };
    const reply = (status, obj) => ({ status, json: async () => obj, arrayBuffer: async () => obj });
    const http = async (url, init) => {
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ url, body });
        if (url.startsWith('https://api.anthropic.com/v1/messages')) {
            return reply(200, { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(typeof answer === 'function' ? answer(body) : answer) }], usage: { input_tokens: 1000, output_tokens: 300 } });
        }
        return reply(404, {});
    };
    const api = LocalApi.create({
        store: LocalStore.createMemoryBackend(), loadJson, now: () => new Date('2026-11-08T10:00:00Z'),
        createAi: (ctx) => LocalAi.create({ ...ctx, secrets, http })
    });
    return { api, calls };
}
const configure = (api, extra = {}) => api.handle('PUT', '/local-ai/settings', { provider: 'anthropic', enabled: true, keys: { anthropic: 'sk-ant-test-1234' }, ...extra });

const answer = {
    reply: 'Brescia è una bella città! Hai visitato il centro storico?', reply_de: 'Brescia ist eine schöne Stadt!',
    corrections: [
        { original: 'sul il mio vacance', corrected: 'sulle mie vacanze', explanation_de: 'alter Fehler aus früherer Nachricht' },
        { original: 'ero a Brescia', corrected: 'ero a Brescia', explanation_de: 'Schein-Korrektur' },
        { original: 'da una settimana', corrected: 'per una settimana', corrected_de: '  für  eine Woche ', explanation_de: 'da = seit' }
    ],
    tip_de: '', new_words: [
        { word: 'visitare', translation: 'besuchen', typ: 'Verb', gender: 'none', example: 'Hai visitato il museo?', example_de: 'Hast du das Museum besucht?' },
        { word: 'città', translation: 'Stadt', typ: 'Substantiv', gender: 'f-sg', example: 'Una bella città.', example_de: '' }
    ]
};
const messages = [
    { role: 'user', content: 'ciao' }, { role: 'assistant', content: 'Ciao! Dove sei stato?' },
    { role: 'user', content: 'ero a Brescia da una settimana' }
];

test('Gespräch: Antwort gefiltert, Korrektur nur zur letzten Nachricht, Verbrauch gezählt', async () => {
    const { api, calls } = setup(answer);
    await configure(api);
    const r = await api.handle('POST', '/ai/chat', { language: 'it', level: 'A2', topic: 'Reisen', messages });
    assert.strictEqual(r.reply, answer.reply);
    assert.deepStrictEqual(r.corrections.map(c => c.corrected), ['per una settimana']);
    assert.strictEqual(r.corrections[0].corrected_de, 'für eine Woche'); // Übersetzung der Wendung wird bereinigt mitgegeben
    assert.ok(core.chatSchema.properties.corrections.items.required.includes('corrected_de'));
    assert.strictEqual(r.new_words[0].word, 'visitare');
    assert.strictEqual(r.new_words[0].example_de, 'Hast du das Museum besucht?');
    assert.strictEqual(r.new_words[1].grammatica, 'f-sg');
    assert.strictEqual(r.new_words[1].example, ''); // Beispiel ohne Übersetzung wird verworfen
    assert.strictEqual(r.model, 'claude-haiku-5-5'); // Standardmodell fürs Gespräch
    assert.strictEqual(r.remaining, 199);
    const sent = calls[0].body;
    assert.strictEqual(sent.messages.length, 3);
    assert.ok(sent.system.includes('level A2') && sent.system.includes('Reisen'));
    const usage = await api.handle('GET', '/local-ai/usage');
    assert.strictEqual(usage.chatTurns, 1);
    assert.ok(usage.costUsd > 0);
});

test('Gespräch: Wörter aus der eigenen Liste landen im Prompt, Spanisch wird unterstützt', async () => {
    const { api, calls } = setup(answer);
    await configure(api);
    await api.handle('POST', '/ai/chat', { language: 'es', level: 'B1', practiceWords: ['el libro', '', 'la casa'], messages: [{ role: 'user', content: 'hola' }] });
    assert.ok(calls[0].body.system.includes('el libro, la casa'));
    assert.ok(calls[0].body.system.includes('Spanish (Spain)'));
});

test('Gespräch: Eingaben werden geprüft', async () => {
    const { api } = setup(answer);
    await assert.rejects(api.handle('POST', '/ai/chat', { language: 'it', messages }), (e) => e.status === 409); // KI nicht eingerichtet
    await configure(api);
    await assert.rejects(api.handle('POST', '/ai/chat', { language: 'xx', messages }), (e) => e.status === 400);
    await assert.rejects(api.handle('POST', '/ai/chat', { language: 'it', messages: [] }), (e) => e.status === 400);
    await assert.rejects(api.handle('POST', '/ai/chat', { language: 'it', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }), (e) => e.status === 400);
});

test('Gespräch: Tageslimit', async () => {
    const { api } = setup(answer);
    await configure(api, { chatLimit: 2 });
    const body = { language: 'it', messages: [{ role: 'user', content: 'ciao' }] };
    await api.handle('POST', '/ai/chat', body);
    const r2 = await api.handle('POST', '/ai/chat', body);
    assert.strictEqual(r2.remaining, 0);
    await assert.rejects(api.handle('POST', '/ai/chat', body), (e) => e.status === 429);
    await configure(api, { chatLimit: 0 }); // 0 = unbegrenzt
    assert.strictEqual((await api.handle('POST', '/ai/chat', body)).remaining, null);
});

test('Gespräch: Modell je Anbieter einstellbar', async () => {
    const { api, calls } = setup(answer);
    await configure(api, { chatModels: { anthropic: 'claude-sonnet-5-5' } });
    await api.handle('POST', '/ai/chat', { language: 'it', messages: [{ role: 'user', content: 'ciao' }] });
    assert.strictEqual(calls[0].body.model, 'claude-sonnet-5-5');
});

test('Gespräche speichern: anlegen, laden, filtern, löschen, in der Sicherung', async () => {
    const { api } = setup(answer);
    const id = 'chat-0001-abcd';
    const msgs = [{ role: 'user', content: 'ciao' }, { role: 'assistant', content: 'Ciao!', corrections: [] }];
    const s = await api.handle('PUT', `/chats/${id}`, { language: 'it', level: 'B1', topic: 'Reisen', title: 'Urlaub', messages: msgs });
    assert.strictEqual(s.messageCount, 2);
    await api.handle('PUT', '/chats/chat-0002-abcd', { language: 'en', messages: msgs });
    assert.strictEqual((await api.handle('GET', '/chats')).length, 2);
    assert.deepStrictEqual((await api.handle('GET', '/chats?language=it')).map(c => c.id), [id]);
    const full = await api.handle('GET', `/chats/${id}`);
    assert.strictEqual(full.messages[1].content, 'Ciao!');
    assert.strictEqual(full.level, 'B1');
    const backup = await api.exportData();
    assert.strictEqual(backup.chats.length, 2);
    await api.handle('DELETE', `/chats/${id}`);
    await assert.rejects(api.handle('GET', `/chats/${id}`), (e) => e.status === 404);
    await api.handle('DELETE', '/chats/clear/all');
    assert.strictEqual((await api.handle('GET', '/chats')).length, 0);
    await api.importData(backup);
    assert.strictEqual((await api.handle('GET', '/chats')).length, 2);
});

test('Gespräche speichern: ungültige Eingaben', async () => {
    const { api } = setup(answer);
    await assert.rejects(api.handle('PUT', '/chats/x', { language: 'it', messages: [] }), (e) => e.status === 400); // ID zu kurz
    await assert.rejects(api.handle('PUT', '/chats/chat-0001-abcd', { language: 'xx', messages: [] }), (e) => e.status === 400);
    await assert.rejects(api.handle('PUT', '/chats/chat-0001-abcd', { language: 'it', messages: 'nein' }), (e) => e.status === 400);
});

test('Kern: Nachrichtenliste wird bereinigt', () => {
    assert.deepStrictEqual(core.normalizeChatMessages([{ role: 'assistant', content: 'a' }, { role: 'user', content: 'b' }, { role: 'user', content: 'c' }, { role: 'system', content: 'x' }]),
        [{ role: 'user', content: 'b\nc' }]);
    assert.strictEqual(core.normalizeChatMessages([{ role: 'user', content: 'x'.repeat(5000) }])[0].content.length, core.CHAT_MAX_TEXT);
});

test('Einstellungen: Chat-Modell und Chat-Limit sind einstellbar und werden zurückgegeben', async () => {
    const { api } = setup(answer);
    let cfg = await configure(api);
    assert.strictEqual(cfg.chatLimit, 200);
    assert.strictEqual(cfg.providers.anthropic.chatModel, 'claude-haiku-5-5');
    cfg = await api.handle('PUT', '/local-ai/settings', { chatLimit: 50, chatModels: { anthropic: 'claude-sonnet-5-5' } });
    assert.strictEqual(cfg.chatLimit, 50);
    assert.strictEqual(cfg.providers.anthropic.chatModel, 'claude-sonnet-5-5');
    cfg = await api.handle('PUT', '/local-ai/settings', { chatLimit: 'x', chatModels: { anthropic: '  ' } }); // ungültig: bleibt
    assert.strictEqual(cfg.chatLimit, 50);
    assert.strictEqual(cfg.providers.anthropic.chatModel, 'claude-sonnet-5-5');
});

test('Wörter aus dem Gespräch: Herkunft bleibt am Wort erhalten', async () => {
    const { api } = setup(answer);
    const w = await api.handle('POST', '/vocab', { de: 'besuchen', it: 'visitare', typ: 'Verb', language: 'it', source: 'chat', isOwn: true });
    const s = await api.handle('POST', '/vocab', { de: 'Hast du das Museum besucht?', it: 'Hai visitato il museo?', typ: 'Satz', forWord: 'visitare', language: 'it', source: 'chat' });
    const list = await api.handle('GET', '/vocab?language=it');
    assert.strictEqual(list.find(v => v.id === w.id).source, 'chat');
    assert.strictEqual(list.find(v => v.id === s.id).forWord, 'visitare');
    const plain = await api.handle('POST', '/vocab', { de: 'Haus', it: 'casa', typ: 'Substantiv', language: 'it' });
    assert.strictEqual(plain.source, null);
});
