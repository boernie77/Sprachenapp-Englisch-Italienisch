// Tests für server/public/tts.js: Textaufbereitung, Lückentexte, Stimmenwahl, Aufteilung langer Texte.
const test = require('node:test');
const assert = require('node:assert/strict');
const Tts = require('../public/tts.js');

test('Aufbereitung: Slash-Varianten, Klammern, Emoji, Unterstrich, Auslassungszeichen', () => {
    assert.equal(Tts.clean('el/la estudiante', 'es'), 'el, la estudiante');
    assert.equal(Tts.clean('la casa (f)', 'it'), 'la casa');
    assert.equal(Tts.clean('il gatto 🐱', 'it'), 'il gatto');
    assert.equal(Tts.clean('❤️ amore', 'it'), 'amore');
    assert.equal(Tts.clean('buon_giorno', 'it'), 'buon giorno');
    assert.equal(Tts.clean('Ma… forse', 'it'), 'Ma, forse');
    assert.equal(Tts.clean('  viel   Platz  ', 'de'), 'viel Platz');
});

test('Aufbereitung: Lückentexte werden nie vorgelesen', () => {
    assert.equal(Tts.clean('Io ___ un caffè.', 'it'), '');
    assert.equal(Tts.clean('Yo ... mucho', 'es'), '');
    assert.equal(Tts.clean('Hi ______', 'en'), '');
    assert.equal(Tts.clean('', 'it'), '');
    assert.equal(Tts.clean('🙂', 'it'), '');
});

test('Aufbereitung: Abkürzungen je Sprache', () => {
    assert.equal(Tts.clean('Il sig. Rossi e la Dott.ssa Bianchi', 'it'), 'Il signor Rossi e la dottoressa Bianchi');
    assert.equal(Tts.clean('Dr. Smith', 'en'), 'doctor Smith');
    assert.equal(Tts.clean('Sra. López', 'es'), 'señora López');
});

test('Artikel: it/es mitsprechen, en nie', () => {
    assert.equal(Tts.prepare({ it: 'casa', de: 'Haus' }, 'it', { lang: 'it', full: 'la casa' }).text, 'la casa');
    assert.equal(Tts.prepare({ it: 'agua', de: 'Wasser' }, 'it', { lang: 'es', full: 'el agua' }).text, 'el agua');
    assert.equal(Tts.prepare({ it: 'house', de: 'Haus' }, 'it', { lang: 'en', full: 'the house' }).text, 'house');
    assert.equal(Tts.prepare({ it: 'eat', de: 'essen' }, 'it', { lang: 'en', full: 'to eat' }).text, 'to eat');
});

test('Spracherkennung feldbasiert: it-Feld = Lernsprache, de-Feld = de', () => {
    assert.deepEqual(Tts.prepare({ it: 'hablar', de: 'sprechen' }, 'it', { lang: 'es' }), { text: 'hablar', lang: 'es' });
    assert.deepEqual(Tts.prepare({ it: 'hablar', de: 'sprechen' }, 'de', { lang: 'es' }), { text: 'sprechen', lang: 'de' });
    assert.equal(Tts.prepare({ it: 'Io ___ bene', de: 'x' }, 'it', { lang: 'it' }), null);
    assert.equal(Tts.prepare(null, 'it'), null);
});

test('Locale-Feld: de-DE fest, it-IT, en-GB, es-ES', () => {
    assert.deepEqual(Tts.TTS_LOCALES, { it: 'it-IT', en: 'en-GB', es: 'es-ES', de: 'de-DE' });
});

test('Stimmenwahl: gespeichert > exakt+lokal/enhanced > exakt > Familie > keine', () => {
    const v = (uri, lang, extra = {}) => ({ uri, name: uri, lang, local: true, default: false, ...extra });
    const voices = [v('a', 'it-IT', { local: false }), v('b', 'it-IT'), v('c', 'it_IT', { name: 'Alice (Premium)' }), v('d', 'it-CH'), v('e', 'en-US')];
    assert.equal(Tts.pickVoice(voices, 'it', 'b').uri, 'b');
    assert.equal(Tts.pickVoice(voices, 'it', 'e').uri, 'c');   // gespeicherte Stimme der falschen Sprache zählt nicht
    assert.equal(Tts.pickVoice(voices, 'it', '').uri, 'c');    // Premium vor lokal vor entfernt
    assert.equal(Tts.pickVoice([v('a', 'it-IT', { local: false }), v('d', 'it-CH')], 'it').uri, 'a');
    assert.equal(Tts.pickVoice([v('d', 'it-CH')], 'it').uri, 'd'); // Sprachfamilie
    assert.equal(Tts.pickVoice([v('e', 'en-US')], 'it'), null);
    assert.equal(Tts.pickVoice([v('e', 'en-US')], 'en').uri, 'e'); // en-GB fehlt, en-US passt
});

test('Aufteilung langer Texte in Sätze und Häppchen', () => {
    assert.deepEqual(Tts.splitText('Ciao. Come stai? Bene!'), ['Ciao.', 'Come stai?', 'Bene!']);
    const long = 'parola '.repeat(60).trim();
    const parts = Tts.splitText(long, 100);
    assert.ok(parts.length > 3 && parts.every(p => p.length <= 100));
    assert.equal(parts.join(' ').replace(/\s+/g, ' '), long);
});

test('Ohne Browser: nichts verfügbar, speak spricht nicht', async () => {
    Tts._resetForTests();
    global.localStorage = { getItem: () => null, setItem() {} };
    assert.equal(Tts.available(), false);
    assert.equal(await Tts.speak('ciao', 'it'), false);
    assert.equal(Tts.buttonHtml({ text: 'ciao', lang: 'it' }), '');
    delete global.localStorage;
});
