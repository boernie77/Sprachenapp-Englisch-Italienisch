const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const LocalStore = require('../public/local-store');
const LocalApi = require('../public/local-api');
const LocalSync = require('../public/local-sync');

const PUBLIC = path.join(__dirname, '..', 'public');
const loadJson = async (p) => JSON.parse(fs.readFileSync(path.join(PUBLIC, p), 'utf8'));
const newLocal = () => LocalApi.create({ store: LocalStore.createMemoryBackend(), loadJson });

// Kleiner Ersatz für den Server (gleiche Routen und Antwortformen wie routes/vocab.js und auth.js)
function fakeServer({ name = null } = {}) {
    const vocab = []; let nextId = 500;
    const user = { name, dailyActivity: {} };
    const calls = [];
    const zero = () => ({ presented: 0, correct: 0, incorrect: 0, streak: 0, lastReviewedDate: null, nextReviewDate: null });
    const api = async (endpoint, options = {}) => {
        const [p, query] = endpoint.split('?'); const q = new URLSearchParams(query || '');
        const method = options.method || 'GET'; const body = options.body ? JSON.parse(options.body) : {};
        calls.push(`${method} ${p}`);
        if (method === 'GET' && p === '/vocab') return JSON.parse(JSON.stringify(vocab.filter(v => v.language === q.get('language'))));
        if (method === 'POST' && p === '/vocab/bulk') {
            return body.words.map(w => { const v = { id: nextId++, ...w, isOwn: w.isOwn !== false, language: body.language, Stat: zero() }; vocab.push(v); return JSON.parse(JSON.stringify(v)); });
        }
        let m = /^\/vocab\/(\d+)\/stats$/.exec(p);
        if (method === 'PUT' && m) { const v = vocab.find(x => x.id === Number(m[1])); Object.assign(v.Stat, body); return { message: 'ok' }; }
        if (method === 'PUT' && p === '/auth/daily-activity') { for (const [d, c] of Object.entries(body)) user.dailyActivity[d] = Math.max(user.dailyActivity[d] || 0, c); return {}; }
        if (method === 'GET' && p === '/auth/me') return { id: 7, name: user.name, dailyActivity: user.dailyActivity };
        if (method === 'PUT' && p === '/auth/profile') { user.name = body.name; return { name: body.name }; }
        throw Object.assign(new Error('unbekannt ' + method + ' ' + p), { status: 404 });
    };
    return { api, vocab, user, calls };
}

async function filledLocal() {
    const local = newLocal();
    await local.handle('POST', '/vocab/bulk', { language: 'it', words: [
        { de: 'Haus', it: 'casa', typ: 'Substantiv', grammatica: 'f-sg' }, { de: 'essen', it: 'mangiare', typ: 'Verb', isOwn: false }, { de: 'Hund', it: 'cane', typ: 'Substantiv', isActive: false }] });
    await local.handle('PUT', '/vocab/1/stats', { presented: 5, correct: 4, incorrect: 1, streak: 3, lastReviewedDate: '2026-10-05T10:00:00.000Z', nextReviewDate: '2026-10-09T10:00:00.000Z' });
    await local.handle('PUT', '/auth/daily-activity', { '2026-10-05': 9 });
    await local.handle('PUT', '/auth/profile', { name: 'Christian' });
    return local;
}

test('Übertragen auf leeren Server: alles wird angelegt, Statistik und Aktiv-Schalter bleiben', async () => {
    const local = await filledLocal();
    const srv = fakeServer();
    const r = await LocalSync.pushToServer({ data: await local.exportData(), api: srv.api });
    assert.deepStrictEqual({ created: r.created, merged: r.merged, stats: r.stats }, { created: 3, merged: 0, stats: 1 });
    const casa = srv.vocab.find(v => v.it === 'casa');
    assert.strictEqual(casa.Stat.presented, 5);
    assert.strictEqual(casa.Stat.lastReviewedDate, '2026-10-05T10:00:00.000Z');
    assert.strictEqual(casa.grammatica, 'f-sg');
    assert.strictEqual(srv.vocab.find(v => v.it === 'mangiare').isOwn, false);
    assert.strictEqual(srv.vocab.find(v => v.it === 'cane').isActive, false);
    assert.deepStrictEqual(srv.user.dailyActivity, { '2026-10-05': 9 });
    assert.strictEqual(srv.user.name, 'Christian');
});

test('Zweites Übertragen ändert nichts (keine Dubletten, keine unnötigen Schreibzugriffe)', async () => {
    const local = await filledLocal();
    const srv = fakeServer();
    const data = await local.exportData();
    await LocalSync.pushToServer({ data, api: srv.api });
    srv.calls.length = 0;
    const r = await LocalSync.pushToServer({ data, api: srv.api });
    assert.deepStrictEqual({ created: r.created, merged: r.merged, stats: r.stats }, { created: 0, merged: 3, stats: 0 });
    assert.strictEqual(srv.vocab.length, 3);
    assert.ok(!srv.calls.some(c => c.startsWith('POST /vocab') || c.startsWith('PUT /vocab')));
});

test('Vorhandene Wörter: der neuere Lernstand gewinnt, Name des Servers bleibt', async () => {
    const local = await filledLocal(); // casa: zuletzt 2026-10-05
    const srv = fakeServer({ name: 'Server-Name' });
    srv.vocab.push({ id: 1, de: 'Haus', it: 'Casa', typ: 'Substantiv', language: 'it', isOwn: true, isActive: true, Stat: { presented: 9, correct: 9, incorrect: 0, streak: 9, lastReviewedDate: '2026-10-07T10:00:00.000Z', nextReviewDate: null } });
    srv.vocab.push({ id: 2, de: 'essen', it: 'mangiare', typ: 'Verb', language: 'it', isOwn: false, isActive: true, Stat: { presented: 1, correct: 1, incorrect: 0, streak: 1, lastReviewedDate: '2026-10-01T10:00:00.000Z', nextReviewDate: null } });
    await local.handle('PUT', '/vocab/2/stats', { presented: 2, correct: 2, lastReviewedDate: '2026-10-06T10:00:00.000Z' });
    const r = await LocalSync.pushToServer({ data: await local.exportData(), api: srv.api });
    assert.strictEqual(r.created, 1); // nur "cane"
    assert.strictEqual(srv.vocab.find(v => v.id === 1).Stat.presented, 9);  // Server war neuer
    assert.strictEqual(srv.vocab.find(v => v.id === 2).Stat.presented, 2);  // lokal war neuer
    assert.strictEqual(srv.user.name, 'Server-Name');
});

test('Selbst erzeugte KI-Sätze werden zu eigenen Sätzen mit Wort und Niveau', async () => {
    const local = newLocal();
    await local.handle('GET', '/grammar-sentences?language=it');
    await local.exportData();
    const data = await local.exportData();
    data.sentences.push({ id: 1000000, it: 'La zebra corre.', de: 'Das Zebra läuft.', category: 'Presente', level: 'A1', language: 'it', forWord: 'zebra' });
    const srv = fakeServer();
    const r = await LocalSync.pushToServer({ data, api: srv.api });
    assert.strictEqual(r.created, 1); // mitgelieferte Sätze (id < 1.000.000) gehören nicht dazu
    const s = srv.vocab[0];
    assert.deepStrictEqual([s.typ, s.forWord, s.level, s.grammatica, s.isOwn, s.it], ['Satz', 'zebra', 'A1', 'Presente', true, 'La zebra corre.']);
});

test('Große Bestände werden in Paketen übertragen', async () => {
    const local = newLocal();
    await local.handle('POST', '/vocab/bulk', { language: 'es', words: Array.from({ length: 1200 }, (_, i) => ({ de: `w${i}`, it: `p${i}` })) });
    const srv = fakeServer();
    const r = await LocalSync.pushToServer({ data: await local.exportData(), api: srv.api });
    assert.strictEqual(r.created, 1200);
    assert.strictEqual(srv.calls.filter(c => c === 'POST /vocab/bulk').length, 3);
    assert.ok(srv.vocab.every(v => v.language === 'es'));
});

test('Gelöschte lokale Wörter werden nicht übertragen', async () => {
    const local = await filledLocal();
    await local.handle('DELETE', '/vocab/3');
    const srv = fakeServer();
    const r = await LocalSync.pushToServer({ data: await local.exportData(), api: srv.api });
    assert.strictEqual(r.created, 2);
    assert.ok(!srv.vocab.some(v => v.it === 'cane'));
});

test('Vom Server auf das Gerät kopieren ersetzt den lokalen Lernstand', async () => {
    const local = await filledLocal();
    await local.handle('POST', '/vocab', { de: 'nur lokal', it: 'soloqui', language: 'it' });
    const srv = fakeServer({ name: 'Anna' });
    srv.vocab.push({ id: 11, de: 'Katze', it: 'gatto', typ: 'Substantiv', emoji: '🐱', language: 'it', isOwn: true, isActive: true, isMarked: true, Stat: { presented: 4, correct: 3, incorrect: 1, streak: 2, lastReviewedDate: '2026-10-02T08:00:00.000Z', nextReviewDate: null } });
    srv.vocab.push({ id: 12, de: 'Tisch', it: 'mesa', typ: 'Substantiv', language: 'es', isOwn: false, isActive: false, Stat: null });
    srv.user.dailyActivity = { '2026-10-02': 7 };
    const r = await LocalSync.pullFromServer({ local, api: srv.api });
    assert.strictEqual(r.vocab, 2);
    const it = await local.handle('GET', '/vocab?language=it');
    assert.deepStrictEqual(it.map(v => v.it), ['gatto']);
    assert.deepStrictEqual([it[0].isMarked, it[0].emoji, it[0].Stat.presented, it[0].Stat.lastReviewedDate], [true, '🐱', 4, '2026-10-02T08:00:00.000Z']);
    const es = await local.handle('GET', '/vocab?language=es');
    assert.deepStrictEqual([es[0].it, es[0].isActive, es[0].isOwn, es[0].Stat.presented], ['mesa', false, false, 0]);
    const me = await local.handle('GET', '/auth/me');
    assert.deepStrictEqual([me.name, me.dailyActivity], ['Anna', { '2026-10-02': 7 }]);
    const next = await local.handle('POST', '/vocab', { de: 'neu', it: 'nuovo', language: 'it' });
    assert.strictEqual(next.id, 3); // fortlaufend nach den übernommenen Wörtern
});

test('Serverfehler brechen die Übertragung ab und werden gemeldet', async () => {
    const local = await filledLocal();
    const failing = async (endpoint, o = {}) => { if ((o.method || 'GET') === 'POST') throw Object.assign(new Error('HTTP error! status: 500'), { status: 500 }); return []; };
    await assert.rejects(LocalSync.pushToServer({ data: await local.exportData(), api: failing }), (e) => e.status === 500);
});
