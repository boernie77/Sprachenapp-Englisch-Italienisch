// Zentrale Liste der Lernsprachen. Die Spalte `it` der Tabellen heißt aus Altgründen so, enthält aber
// immer das Fremdwort der jeweiligen Lernsprache (it, en oder es) – nicht umbenennen.
const LANGUAGES = ['it', 'en', 'es'];
const DEFAULT_LANGUAGE = 'it'; // Altdaten ohne Sprache sind Italienisch
const LANGUAGE_NAMES = { it: 'Italienisch', en: 'Englisch', es: 'Spanisch' };

const isSupported = (language) => LANGUAGES.includes(language);
// Sprache aus einer Abfrage/Eingabe, sonst Standard
const normalizeLanguage = (language) => (isSupported(language) ? language : DEFAULT_LANGUAGE);

module.exports = { LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_NAMES, isSupported, normalizeLanguage };
