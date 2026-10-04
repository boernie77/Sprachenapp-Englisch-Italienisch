// Tests für server/utils/uiMessages.js (API-Meldungen je nach Oberflächensprache).
const test = require('node:test');
const assert = require('node:assert/strict');
const { translate, uiLangOf, uiMessagesMiddleware, MESSAGES_EN } = require('../utils/uiMessages');

test('Meldungen: Englisch nur bei X-UI-Lang: en', () => {
    assert.equal(uiLangOf({ headers: { 'x-ui-lang': 'en' } }), 'en');
    assert.equal(uiLangOf({ headers: { 'x-ui-lang': 'de' } }), 'de');
    assert.equal(uiLangOf({ headers: {} }), 'de');
    assert.equal(translate('Sprache nicht unterstützt', 'de'), 'Sprache nicht unterstützt');
    assert.equal(translate('Sprache nicht unterstützt', 'en'), 'Language not supported');
    assert.equal(translate('Unbekannter Text', 'en'), 'Unbekannter Text');
    assert.equal(translate('Heute sind nur noch 3 Sätze möglich', 'en'), 'Only 3 more sentences are possible today');
    assert.equal(translate('Anzahl muss zwischen 1 und 20 liegen', 'en'), 'The number must be between 1 and 20');
    assert.ok(Object.values(MESSAGES_EN).every(v => !/[äöüß]/.test(v)), 'englische Texte ohne Umlaute');
});

test('Meldungen: Middleware übersetzt error und message', () => {
    const sent = [];
    const res = { json: (b) => { sent.push(b); return res; } };
    uiMessagesMiddleware({ headers: { 'x-ui-lang': 'en' } }, res, () => {});
    res.json({ error: 'Code gelöscht', message: 'Code gelöscht', other: 'Code gelöscht' });
    assert.deepEqual(sent[0], { error: 'Code deleted', message: 'Code deleted', other: 'Code gelöscht' });
    const sentDe = [];
    const resDe = { json: (b) => { sentDe.push(b); return resDe; } };
    uiMessagesMiddleware({ headers: {} }, resDe, () => {});
    resDe.json({ error: 'Code gelöscht' });
    assert.deepEqual(sentDe[0], { error: 'Code gelöscht' });
});
