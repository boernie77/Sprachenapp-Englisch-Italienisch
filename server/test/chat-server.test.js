// Gesprächsmodus auf dem Server: Schalter, Freigabe je Nutzer, Limit, Gesprächsspeicher.
// Die Datenbank wird durch einen kleinen Speicher im Arbeitsspeicher ersetzt (kein Postgres nötig).
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
const jwt = require('jsonwebtoken');

// ---- Speicher-Ersatz für models.js ----
const rows = { User: [], Chat: [], AiUsage: [], Setting: [] };
let seq = 1;
const matches = (r, where) => Object.entries(where || {}).every(([k, v]) => r[k] === v);
function model(name, extra = {}) {
    const wrap = (r) => r && Object.assign(r, {
        async update(f) { Object.assign(r, f, { updatedAt: new Date(Date.now() + (++seq)) }); return r; },
        async save() { return r; },
        async increment(f) { for (const [k, v] of Object.entries(f)) r[k] = (Number(r[k]) || 0) + v; },
        async destroy() { rows[name].splice(rows[name].indexOf(r), 1); }
    });
    return {
        async findOne({ where }) { return wrap(rows[name].find(r => matches(r, where)) || null); },
        async findByPk(id) { return wrap(rows[name].find(r => r.id === id) || null); },
        async findAll({ where } = {}) { return rows[name].filter(r => matches(r, where)).sort((a, b) => b.updatedAt - a.updatedAt).map(wrap); },
        async create(f) { const r = { createdAt: new Date(), updatedAt: new Date(Date.now() + (++seq)), ...extra, ...f }; if (!r.id) r.id = seq; rows[name].push(r); return wrap(r); },
        async destroy({ where }) { const del = rows[name].filter(r => matches(r, where)); del.forEach(r => rows[name].splice(rows[name].indexOf(r), 1)); return del.length; },
        async findOrCreate({ where, defaults }) { let r = rows[name].find(x => matches(x, where)); if (r) return [wrap(r), false]; r = await this.create({ ...where, ...defaults, calls: 0, chatTurns: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }); return [r, true]; }
    };
}
const models = { User: model('User', { isActive: true, isAdmin: false, chatAllowed: false }), Chat: model('Chat'), AiUsage: model('AiUsage'), Setting: model('Setting') };
const modelsPath = require.resolve('../models');
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: models };

const ai = require('../utils/ai');
const { PROVIDERS } = require('../utils/ai/providers');
const express = require('express');

let calls = 0;
PROVIDERS.anthropic.chat = async () => { calls++; return { data: { reply: 'Ciao! Come stai?', reply_de: 'Hallo!', corrections: [], tip_de: '', new_words: [] }, usage: { input: 1000, output: 200 } }; };

const app = express();
app.use(express.json());
app.use('/api', require('../routes/chat'));
let server, base;
test.before(async () => { await new Promise(r => { server = app.listen(0, '127.0.0.1', r); }); base = `http://127.0.0.1:${server.address().port}/api`; });
test.after(() => server.close());

const token = (u) => jwt.sign({ id: u.id, email: u.email, isAdmin: u.isAdmin }, process.env.JWT_SECRET);
async function call(method, url, user, body) {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: 'Bearer ' + token(user) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch (e) { /* leer */ }
    return { status: res.status, json };
}

const mkUser = async (f) => models.User.create({ email: `u${seq}@x.de`, ...f });
const msgs = [{ role: 'user', content: 'ciao' }];
const chatBody = { language: 'it', level: 'A2', messages: msgs };

test('Server-Gespräch: ohne Schalter nie, auch nicht für Admins', async () => {
    delete process.env.CHAT_ENABLED;
    const admin = await mkUser({ isAdmin: true, chatAllowed: true });
    assert.strictEqual((await call('POST', '/ai/chat', admin, chatBody)).status, 404);
    assert.strictEqual((await call('GET', '/chats', admin)).status, 404);
    const st = await call('GET', '/ai/chat-status', admin);
    assert.strictEqual(st.json.available, false);
    assert.strictEqual(st.json.serverEnabled, false);
    assert.strictEqual(calls, 0);
});

test('Server-Gespräch: Schalter an, aber Nutzer nicht freigegeben', async () => {
    process.env.CHAT_ENABLED = 'true';
    const u = await mkUser({});
    const r = await call('POST', '/ai/chat', u, chatBody);
    assert.strictEqual(r.status, 404);
    assert.strictEqual((await call('GET', '/ai/chat-status', u)).json.available, false);
    assert.strictEqual((await call('POST', '/ai/chat', null, chatBody)).status, 401); // ohne Anmeldung
    assert.strictEqual(calls, 0);
});

test('Server-Gespräch: freigegeben, KI nicht eingerichtet -> nicht verfügbar / 409', async () => {
    process.env.CHAT_ENABLED = 'true';
    const u = await mkUser({ chatAllowed: true });
    assert.strictEqual((await call('GET', '/ai/chat-status', u)).json.available, false);
    assert.strictEqual((await call('POST', '/ai/chat', u, chatBody)).status, 409);
});

test('Server-Gespräch: Antwort, Tageslimit, Verbrauch, Admin unbegrenzt', async () => {
    process.env.CHAT_ENABLED = 'true';
    const cfg = await ai.loadConfig();
    cfg.enabled = true; cfg.keys.anthropic = ai.encrypt('sk-ant-test'); cfg.chatLimit = 2;
    await ai.saveConfig(cfg);
    const u = await mkUser({ chatAllowed: true });
    assert.strictEqual((await call('GET', '/ai/chat-status', u)).json.available, true);
    const r1 = await call('POST', '/ai/chat', u, chatBody);
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.json.reply, 'Ciao! Come stai?');
    assert.strictEqual(r1.json.model, 'claude-haiku-5-5');
    assert.strictEqual(r1.json.remaining, 1);
    assert.strictEqual((await call('POST', '/ai/chat', u, chatBody)).json.remaining, 0);
    const r3 = await call('POST', '/ai/chat', u, chatBody);
    assert.strictEqual(r3.status, 429);
    const usage = rows.AiUsage.find(x => x.UserId === u.id);
    assert.strictEqual(usage.chatTurns, 2);
    assert.ok(usage.costUsd > 0);
    const admin = await mkUser({ isAdmin: true });
    for (let i = 0; i < 3; i++) assert.strictEqual((await call('POST', '/ai/chat', admin, chatBody)).json.remaining, null);
    // Eingaben
    assert.strictEqual((await call('POST', '/ai/chat', admin, { language: 'xx', messages: msgs })).status, 400);
    assert.strictEqual((await call('POST', '/ai/chat', admin, { language: 'it', messages: [] })).status, 400);
});

test('Server-Gespräch: gespeicherte Gespräche gehören dem Nutzer', async () => {
    process.env.CHAT_ENABLED = 'true';
    const a = await mkUser({ chatAllowed: true }), b = await mkUser({ chatAllowed: true });
    const id = 'chat-aaaa-0001';
    const m = [{ role: 'user', content: 'ciao' }, { role: 'assistant', content: 'Ciao!' }];
    const put = await call('PUT', `/chats/${id}`, a, { language: 'it', level: 'B1', topic: 'Reisen', title: 'Urlaub', messages: m });
    assert.strictEqual(put.status, 200);
    assert.strictEqual(put.json.messageCount, 2);
    assert.strictEqual((await call('GET', '/chats', a)).json.length, 1);
    assert.strictEqual((await call('GET', '/chats', b)).json.length, 0);
    assert.strictEqual((await call('GET', `/chats/${id}`, b)).status, 404);
    assert.strictEqual((await call('PUT', `/chats/${id}`, b, { language: 'it', messages: m })).status, 409); // fremde ID
    assert.strictEqual((await call('DELETE', `/chats/${id}`, b)).status, 200); // trifft nichts
    const got = await call('GET', `/chats/${id}`, a);
    assert.strictEqual(got.json.messages[1].content, 'Ciao!');
    assert.strictEqual(got.json.level, 'B1');
    await call('PUT', `/chats/${id}`, a, { language: 'it', messages: [...m, { role: 'user', content: 'x' }] }); // aktualisieren
    assert.strictEqual((await call('GET', `/chats/${id}`, a)).json.messages.length, 3);
    assert.strictEqual((await call('PUT', '/chats/x', a, { language: 'it', messages: [] })).status, 400);
    assert.strictEqual((await call('PUT', `/chats/${id}`, a, { language: 'xx', messages: [] })).status, 400);
    assert.strictEqual((await call('GET', '/chats?language=en', a)).json.length, 0);
    await call('DELETE', '/chats/clear/all', a);
    assert.strictEqual((await call('GET', '/chats', a)).json.length, 0);
});
