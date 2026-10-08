const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const LocalStore = require('../public/local-store');
const LocalApi = require('../public/local-api');

const PUBLIC = path.join(__dirname, '..', 'public');
const loadJson = async (p) => JSON.parse(fs.readFileSync(path.join(PUBLIC, p), 'utf8'));
const fresh = () => LocalApi.create({ store: LocalStore.createMemoryBackend(), loadJson });

test('Vokabel anlegen: Antwort wie beim Server (Stat eingebettet, Standardwerte)', async () => {
    const api = fresh();
    const v = await api.handle('POST', '/vocab?language=it', { de: 'Haus', it: 'casa', typ: 'Substantiv', language: 'it' });
    assert.strictEqual(v.id, 1);
    assert.strictEqual(v.isActive, true);
    assert.strictEqual(v.isOwn, true);
    assert.strictEqual(v.isMarked, false);
    assert.deepStrictEqual({ p: v.Stat.presented, s: v.Stat.streak, l: v.Stat.lastReviewedDate }, { p: 0, s: 0, l: null });
    assert.strictEqual(v.deleted, undefined);
    const list = await api.handle('GET', '/vocab?language=it');
    assert.strictEqual(list.length, 1);
    assert.strictEqual((await api.handle('GET', '/vocab?language=en')).length, 0);
});

test('Sammelanlage vergibt fortlaufende Nummern, isOwn:false bleibt erhalten', async () => {
    const api = fresh();
    const r = await api.handle('POST', '/vocab/bulk', { language: 'es', words: [{ de: 'sein', it: 'ser', isOwn: false }, { de: 'haben', it: 'tener', isOwn: false }] });
    assert.deepStrictEqual(r.map(v => v.id), [1, 2]);
    assert.ok(r.every(v => v.isOwn === false && v.language === 'es'));
    const more = await api.handle('POST', '/vocab', { de: 'Haus', it: 'casa', language: 'es' });
    assert.strictEqual(more.id, 3);
});

test('Statistik, Aktiv-Schalter und Bearbeiten', async () => {
    const api = fresh();
    const v = await api.handle('POST', '/vocab', { de: 'Haus', it: 'casa', language: 'it' });
    await api.handle('PUT', `/vocab/${v.id}/stats`, { presented: 3, correct: 2, incorrect: 1, streak: 2, lastReviewedDate: '2026-10-01T10:00:00.000Z', isActive: false });
    let [got] = await api.handle('GET', '/vocab?language=it');
    assert.strictEqual(got.Stat.presented, 3);
    assert.strictEqual(got.Stat.lastReviewedDate, '2026-10-01T10:00:00.000Z');
    assert.strictEqual(got.isActive, false);
    await api.handle('PUT', `/vocab/${v.id}`, { it: 'la casa', emoji: '🏠' });
    [got] = await api.handle('GET', '/vocab?language=it');
    assert.strictEqual(got.it, 'la casa');
    assert.strictEqual(got.de, 'Haus');
    await assert.rejects(api.handle('PUT', '/vocab/99/stats', { presented: 1 }), (e) => e.status === 404);
});

test('Löschen: einzeln, Sammel-Löschen mit Sicherheitsabfrage, Neustart der Statistik', async () => {
    const api = fresh();
    await api.handle('POST', '/vocab/bulk', { language: 'it', words: [
        { de: 'a', it: 'a', isOwn: true }, { de: 'b', it: 'b', isOwn: false }, { de: 'c', it: 'c', typ: 'Satz', isOwn: true }] });
    await assert.rejects(api.handle('DELETE', '/vocab/clear/all?language=it&typ=Vocab'), (e) => e.status === 400);
    await api.handle('DELETE', '/vocab/clear/all?language=it&typ=Vocab&isOwn=false');
    assert.deepStrictEqual((await api.handle('GET', '/vocab?language=it')).map(v => v.de).sort(), ['a', 'c']);
    await api.handle('DELETE', '/vocab/1');
    assert.deepStrictEqual((await api.handle('GET', '/vocab?language=it')).map(v => v.de), ['c']);
    await assert.rejects(api.handle('DELETE', '/vocab/1'), (e) => e.status === 404);
    await api.handle('PUT', '/vocab/3/stats', { presented: 5 });
    await api.handle('PUT', '/auth/daily-activity', { '2026-10-01': 4 });
    await api.handle('PUT', '/vocab/stats/reset');
    const [c] = await api.handle('GET', '/vocab?language=it');
    assert.strictEqual(c.Stat.presented, 0);
    const me = await api.handle('GET', '/auth/me');
    assert.deepStrictEqual(me.dailyActivity, {});
    assert.ok(me.lastResetAt);
});

test('Alle aktiv/inaktiv setzen nach Art', async () => {
    const api = fresh();
    await api.handle('POST', '/vocab/bulk', { language: 'it', words: [{ de: 'a', it: 'a' }, { de: 'b', it: 'b', typ: 'Satz' }] });
    await api.handle('PUT', '/vocab/bulk-active', { isActive: false, language: 'it', typ: 'Satz' });
    const l = await api.handle('GET', '/vocab?language=it');
    assert.deepStrictEqual(l.map(v => [v.de, v.isActive]), [['a', true], ['b', false]]);
});

test('Profil und Tagesaktivität (größerer Wert gewinnt)', async () => {
    const api = fresh();
    assert.strictEqual((await api.handle('GET', '/auth/me')).name, null);
    await api.handle('PUT', '/auth/profile', { name: ' Christian ' });
    await assert.rejects(api.handle('PUT', '/auth/profile', { name: '  ' }), (e) => e.status === 400);
    await api.handle('PUT', '/auth/daily-activity', { '2026-10-01': 5 });
    await api.handle('PUT', '/auth/daily-activity', { '2026-10-01': 3, '2026-10-02': 1 });
    const me = await api.handle('GET', '/auth/me');
    assert.strictEqual(me.name, 'Christian');
    assert.deepStrictEqual(me.dailyActivity, { '2026-10-01': 5, '2026-10-02': 1 });
    assert.strictEqual(me.id, 1);
    assert.strictEqual(me.isAdmin, false);
});

test('Mitgelieferte Basisliste und Sätze je Sprache', async () => {
    const api = fresh();
    for (const [lang, minVocab, minSent] of [['it', 1000, 2500], ['en', 900, 2500], ['es', 1300, 2500]]) {
        const base = await api.handle('GET', `/base-vocab?language=${lang}`);
        assert.ok(base.length >= minVocab, `${lang} Basisvokabeln: ${base.length}`);
        assert.ok(base[0].de && base[0].it);
        const s = await api.handle('GET', `/grammar-sentences?language=${lang}`);
        assert.ok(s.length >= minSent, `${lang} Sätze: ${s.length}`);
        assert.ok(s.every(x => x.language === lang && x.manualActive === true));
    }
    // zweiter Abruf übernimmt nichts doppelt
    assert.strictEqual((await api.handle('GET', '/grammar-sentences?language=it')).length, (await api.handle('GET', '/grammar-sentences?language=it')).length);
});

test('Satz-Auswahl: nur Abweichungen von der Voreinstellung, Modus umschalten', async () => {
    const api = fresh();
    const s = await api.handle('GET', '/grammar-sentences?language=en');
    assert.deepStrictEqual(await api.handle('GET', '/grammar-sentences/settings'), { mode: 'auto' });
    await api.handle('PUT', '/grammar-sentences/active', { isActive: false, ids: [s[0].id, s[1].id] });
    let after = await api.handle('GET', '/grammar-sentences?language=en');
    assert.deepStrictEqual(after.slice(0, 3).map(x => x.manualActive), [false, false, true]);
    await api.handle('PUT', '/grammar-sentences/active', { isActive: true, ids: [s[0].id] });
    after = await api.handle('GET', '/grammar-sentences?language=en');
    assert.deepStrictEqual(after.slice(0, 2).map(x => x.manualActive), [true, false]);
    await api.handle('PUT', '/grammar-sentences/active', { isActive: false, all: true, language: 'en' });
    assert.ok((await api.handle('GET', '/grammar-sentences?language=en')).every(x => x.manualActive === false));
    assert.deepStrictEqual(await api.handle('PUT', '/grammar-sentences/settings', { mode: 'manual' }), { mode: 'manual' });
    await assert.rejects(api.handle('PUT', '/grammar-sentences/settings', { mode: 'x' }), (e) => e.status === 400);
});

test('Sicherung und Wiederherstellung', async () => {
    const a = fresh();
    await a.handle('POST', '/vocab', { de: 'Haus', it: 'casa', language: 'it' });
    await a.handle('PUT', '/auth/profile', { name: 'Anna' });
    const backup = JSON.parse(JSON.stringify(await a.exportData()));
    const b = fresh();
    await b.importData(backup);
    assert.strictEqual((await b.handle('GET', '/vocab?language=it')).length, 1);
    assert.strictEqual((await b.handle('GET', '/auth/me')).name, 'Anna');
    await assert.rejects(b.importData({}), (e) => e.status === 400);
});

test('Unbekannte Route: 404', async () => {
    await assert.rejects(fresh().handle('GET', '/gibt-es-nicht'), (e) => e.status === 404);
});
