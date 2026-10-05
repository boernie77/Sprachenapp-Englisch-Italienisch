// Tests für server/utils/tts: Zwischenspeicher, Tageslimit, Fehler – mit Mock-Anbieter, ohne Netz und Datenbank.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-123';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tts = require('../utils/tts');
const { PROVIDERS } = require('../utils/tts/providers');

const mkDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tts-test-'));
function setup(overrides = {}) {
    let calls = 0;
    const used = new Map();
    const provider = { defaultVoices: { it: 'v-it', en: 'v-en', es: 'v-es', de: 'v-de' }, async synthesize({ text, voice }) { calls++; return Buffer.from(`audio:${voice}:${text}`); } };
    const store = {
        remaining: async (user, limit) => limit - (used.get(user.id) || 0),
        add: async (id) => used.set(id, (used.get(id) || 0) + 1)
    };
    const config = { provider: 'mock', enabled: true, dailyLimit: 2, voices: { mock: { ...provider.defaultVoices } }, keys: {} };
    const service = tts.createService({ providers: { mock: provider }, cacheDir: mkDir(), store, getKey: () => 'KEY', ...overrides });
    return { service, config, calls: () => calls, used };
}
const user = { id: 1, isAdmin: false };

test('Cache: gleicher Text wird nur einmal beim Anbieter erzeugt und nicht erneut gezählt', async () => {
    const { service, config, calls, used } = setup();
    const a = await service.synthesize({ text: 'Buongiorno', lang: 'it', user, config });
    const b = await service.synthesize({ text: '  Buongiorno ', lang: 'it', user, config });
    assert.equal(a.cached, false);
    assert.equal(b.cached, true);
    assert.equal(calls(), 1);
    assert.equal(used.get(1), 1);
    assert.equal(a.audio.toString(), 'audio:v-it:Buongiorno');
});

test('Cache: Sprache und Stimme gehören zum Schlüssel', async () => {
    const { service, config, calls } = setup();
    await service.synthesize({ text: 'casa', lang: 'it', user: { id: 5, isAdmin: true }, config });
    await service.synthesize({ text: 'casa', lang: 'es', user: { id: 5, isAdmin: true }, config });
    config.voices.mock.it = 'andere';
    await service.synthesize({ text: 'casa', lang: 'it', user: { id: 5, isAdmin: true }, config });
    assert.equal(calls(), 3);
});

test('Tageslimit: nur neue Aufrufe zählen, zwischengespeicherte nie; Admins unbegrenzt', async () => {
    const { service, config, calls } = setup();
    await service.synthesize({ text: 'uno', lang: 'it', user, config });
    await service.synthesize({ text: 'due', lang: 'it', user, config });
    await service.synthesize({ text: 'uno', lang: 'it', user, config }); // Cache, trotz erreichtem Limit
    await assert.rejects(service.synthesize({ text: 'tre', lang: 'it', user, config }), { status: 429 });
    await service.synthesize({ text: 'tre', lang: 'it', user: { id: 2, isAdmin: true }, config });
    assert.equal(calls(), 3);
});

test('Parallele gleiche Anfragen kosten nur einen Aufruf', async () => {
    const { service, config, calls } = setup();
    await Promise.all([1, 2, 3].map(() => service.synthesize({ text: 'ciao', lang: 'it', user: { id: 9, isAdmin: true }, config })));
    assert.equal(calls(), 1);
});

test('Fehler: zu langer Text, leerer Text, unbekannte Sprache, ohne Schlüssel (503), Anbieterfehler zählt nicht', async () => {
    const { service, config, used } = setup();
    await assert.rejects(service.synthesize({ text: 'x'.repeat(301), lang: 'it', user, config }), { status: 400 });
    await assert.rejects(service.synthesize({ text: '   ', lang: 'it', user, config }), { status: 400 });
    await assert.rejects(service.synthesize({ text: 'hi', lang: 'fr', user, config }), { status: 400 });
    const noKey = setup({ getKey: () => null });
    await assert.rejects(noKey.service.synthesize({ text: 'hi', lang: 'it', user, config: noKey.config }), { status: 503 });
    const failing = setup({ providers: { mock: { defaultVoices: {}, synthesize: async () => { throw new tts.TtsError('kaputt', 502); } } } });
    await assert.rejects(failing.service.synthesize({ text: 'hi', lang: 'it', user, config: failing.config }), { status: 502 });
    assert.equal(failing.used.get(1), undefined);
    assert.equal(used.get(1), undefined);
});

test('Aufräumen: älteste Dateien fliegen zuerst raus', () => {
    const dir = mkDir();
    for (const [i, name] of ['aa', 'bb', 'cc'].entries()) {
        fs.mkdirSync(path.join(dir, name));
        const f = path.join(dir, name, `${name}1.mp3`);
        fs.writeFileSync(f, Buffer.alloc(100));
        fs.utimesSync(f, new Date(2020, 0, i + 1), new Date(2020, 0, i + 1));
    }
    assert.equal(tts.pruneCache(dir, 250), 1);
    assert.ok(!fs.existsSync(path.join(dir, 'aa', 'aa1.mp3')));
    assert.ok(fs.existsSync(path.join(dir, 'cc', 'cc1.mp3')));
});

test('Anbieter: Google und OpenAI bauen die Anfrage richtig auf (gemockter fetch)', async () => {
    let seen;
    const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ audioContent: Buffer.from('mp3').toString('base64') }), arrayBuffer: async () => Buffer.from('mp3') }; };
    const g = await PROVIDERS.google.synthesize({ apiKey: 'K', text: 'Ciao', lang: 'it', voice: 'it-IT-Wavenet-A', fetchImpl });
    assert.equal(g.toString(), 'mp3');
    assert.match(seen.url, /texttospeech\.googleapis\.com/);
    assert.equal(JSON.parse(seen.init.body).voice.languageCode, 'it-IT');
    const o = await PROVIDERS.openai.synthesize({ apiKey: 'K', text: 'Ciao', lang: 'it', voice: 'alloy', fetchImpl });
    assert.equal(o.toString(), 'mp3');
    assert.equal(JSON.parse(seen.init.body).model, 'gpt-4o-mini-tts');
    assert.match(JSON.parse(seen.init.body).instructions, /Italian/);
    const bad = async () => ({ ok: false, status: 429 });
    await assert.rejects(PROVIDERS.openai.synthesize({ apiKey: 'K', text: 'x', lang: 'it', voice: 'alloy', fetchImpl: bad }), { status: 429 });
});

test('Status/Verfügbarkeit: ohne Schlüssel nie verfügbar; publicConfig zeigt keinen Schlüssel', () => {
    const { encrypt } = require('../utils/secretBox');
    const base = { provider: 'google', enabled: true, dailyLimit: 300, voices: { google: {}, openai: {} }, keys: {} };
    assert.equal(tts.isAvailable(base), false);
    const withKey = { ...base, keys: { google: encrypt('geheim-1234') } };
    assert.equal(tts.isAvailable(withKey), true);
    assert.equal(tts.isAvailable({ ...withKey, enabled: false }), false);
    const pub = JSON.stringify(tts.publicConfig(withKey));
    assert.ok(!pub.includes('geheim') && pub.includes('1234'));
});

test('Rate-Limit je Nutzer', () => {
    const allow = tts.createRateLimiter(2, 60000);
    assert.ok(allow(1) && allow(1));
    assert.equal(allow(1), false);
    assert.ok(allow(2));
});
