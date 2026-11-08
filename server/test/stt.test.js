const test = require('node:test');
const assert = require('node:assert');
const Stt = require('../public/stt');

function withWindow(w, fn) {
    return async () => { global.window = w; try { await fn(); } finally { delete global.window; } };
}
// stt.js liest `window` zur Laufzeit nur über hasWindow (beim Laden). Darum Modul je Test frisch laden.
const load = () => { delete require.cache[require.resolve('../public/stt')]; return require('../public/stt'); };

test('Spracheingabe: Fehlertexte werden eingeordnet', () => {
    assert.strictEqual(Stt.kind({ message: 'User denied access' }), 'denied');
    assert.strictEqual(Stt.kind('not-allowed'), 'denied');
    assert.strictEqual(Stt.kind({ error: 'no-speech' }), 'none');
    assert.strictEqual(Stt.kind(new Error('boom')), 'error');
});

test('Spracheingabe: ohne Browser-Unterstützung nicht verfügbar', () => {
    assert.strictEqual(Stt.available(), false);
});

test('Spracheingabe: natives Plugin liefert Teilergebnisse und Ende', withWindow({
    Capacitor: { isNativePlatform: () => true, Plugins: { SpeechRecognition: (() => {
        const L = {}; const calls = [];
        return {
            calls,
            checkPermissions: async () => ({ speechRecognition: 'granted' }),
            addListener: async (n, f) => { L[n] = f; return { remove() {} }; },
            start: async (o) => { calls.push(o); setTimeout(() => { L.partialResults({ matches: ['ciao'] }); L.partialResults({ matches: ['ciao come stai'] }); L.listeningState({ state: 'stopped' }); }, 5); return {}; },
            stop: async () => {}
        };
    })() } }
}, async () => {
    const S = load();
    assert.strictEqual(S.available(), true);
    const parts = [];
    const res = await new Promise(async (resolve) => { await S.listen('it', { onPartial: (t) => parts.push(t), onEnd: (t, e) => resolve({ t, e }) }); });
    assert.deepStrictEqual(parts, ['ciao', 'ciao come stai']);
    assert.deepStrictEqual(res, { t: 'ciao come stai', e: null });
    assert.strictEqual(global.window.Capacitor.Plugins.SpeechRecognition.calls[0].language, 'it-IT');
}));

test('Spracheingabe: verweigerte Berechtigung', withWindow({
    Capacitor: { isNativePlatform: () => true, Plugins: { SpeechRecognition: {
        checkPermissions: async () => ({ speechRecognition: 'prompt' }), requestPermissions: async () => ({ speechRecognition: 'denied' })
    } } }
}, async () => {
    const S = load();
    const e = await new Promise((resolve) => S.listen('es', { onEnd: (t, err) => resolve(err) }));
    assert.strictEqual(e, 'denied');
}));

test('Spracheingabe: Web Speech API', withWindow({
    webkitSpeechRecognition: function () {
        this.start = () => setTimeout(() => { this.onresult({ results: [[{ transcript: 'hello' }], [{ transcript: ' there' }]] }); this.onend(); }, 5);
        this.stop = () => {};
    }
}, async () => {
    const S = load();
    assert.strictEqual(S.available(), true);
    const r = await new Promise((resolve) => S.listen('en', { onEnd: (t, err) => resolve({ t, err }) }));
    assert.deepStrictEqual(r, { t: 'hello there', err: null });
}));

test('Spracheingabe: nach dem Ende kommen keine Ergebnisse mehr an', withWindow({
    webkitSpeechRecognition: function () {
        let me = this;
        this.start = () => setTimeout(() => { me.onresult({ results: [[{ transcript: 'ciao' }]] }); }, 5);
        this.stop = () => { me.onend(); me.onresult({ results: [[{ transcript: 'Nachzügler' }]] }); };
        global.__rec = this;
    }
}, async () => {
    const S = load();
    const seen = [];
    let session;
    const done = new Promise(async (resolve) => { session = await S.listen('it', { onPartial: (t) => seen.push(t), onEnd: (t) => resolve(t) }); });
    await new Promise(r => setTimeout(r, 20));
    session.stop();
    assert.strictEqual(await done, 'ciao');
    assert.deepStrictEqual(seen, ['ciao']);
}));
