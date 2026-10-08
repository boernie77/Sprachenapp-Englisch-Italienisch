// Zentrale Liste der Lernsprachen (liegt in public/ai-core.js, damit die App im lokalen Betrieb dieselbe nutzt).
// Die Spalte `it` der Tabellen heißt aus Altgründen so, enthält aber immer das Fremdwort der jeweiligen Lernsprache
// (it, en oder es) – nicht umbenennen.
const { LANGUAGES, LANGUAGE_NAMES } = require('../public/ai-core');
const DEFAULT_LANGUAGE = 'it'; // Altdaten ohne Sprache sind Italienisch

const isSupported = (language) => LANGUAGES.includes(language);
// Sprache aus einer Abfrage/Eingabe, sonst Standard
const normalizeLanguage = (language) => (isSupported(language) ? language : DEFAULT_LANGUAGE);

module.exports = { LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_NAMES, isSupported, normalizeLanguage };
