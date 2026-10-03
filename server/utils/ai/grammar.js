// Grammatikarten und Niveaus für die KI-Satzerzeugung.
// Die Grundliste stammt aus den Excel-Listen; dazu kommen die Kategorien, die in der
// globalen Grammatik-Tabelle tatsächlich vorkommen, damit Filter und KI-Sätze zusammenpassen.
const { GrammarSentence } = require('../../models');

const LEVELS = ['A1', 'A2', 'B1', 'B2'];

const BASE_CATEGORIES = {
    it: ['Presente', 'Passato Prossimo', 'Imperfetto', 'Gerundio', 'Preposizioni Articolate'],
    en: ['Present Simple', 'Present Continuous', 'Simple Past', 'Present Perfect', 'Modalverb',
        'Imperative', 'Conditional 1', 'Conditional 2', 'Future (will)', 'Future (be going to)']
};

// Neu für die KI-Auswahl (Imperativ, Konjunktiv, Zukunft); im Englischen gibt es Imperative und Future schon
const NEW_CATEGORIES = {
    it: ['Imperativo', 'Congiuntivo', 'Futuro Semplice'],
    en: ['Subjunctive']
};

// Sammelkategorien und Ausreißer aus den Listen, die sich nicht als Grammatikart eignen
const EXCLUDED = new Set(['Grammatik', 'Gemischt', 'Allgemein', 'Eigene Sätze']);

// Kurze Erklärung je Kategorie, damit die KI die Zeitform eindeutig trifft
const HINTS = {
    'Presente': 'Indicativo presente',
    'Passato Prossimo': 'Passato prossimo (avere/essere + participio passato)',
    'Imperfetto': 'Indicativo imperfetto',
    'Gerundio': 'Gerundio, z.B. stare + gerundio',
    'Preposizioni Articolate': 'Satz mit mindestens einer zusammengezogenen Präposition (del, nella, sul, …)',
    'Imperativo': 'Imperativo (tu, Lei, noi oder voi), auch verneint',
    'Congiuntivo': 'Congiuntivo presente oder passato, z.B. nach penso che, spero che, bisogna che',
    'Futuro Semplice': 'Futuro semplice',
    'Modalverb': 'Satz mit einem Modalverb (can, must, should, may, might, have to)',
    'Imperative': 'Imperative',
    'Conditional 1': 'First conditional (if + present, will + infinitive)',
    'Conditional 2': 'Second conditional (if + past, would + infinitive)',
    'Future (will)': 'Future with will',
    'Future (be going to)': 'Future with be going to',
    'Subjunctive': 'Subjunctive, z.B. If I were…, I suggest that he be…, I wish I were…'
};

const isSupportedLanguage = (language) => Object.prototype.hasOwnProperty.call(BASE_CATEGORIES, language);

async function getCategories(language) {
    if (!isSupportedLanguage(language)) return [];
    const rows = await GrammarSentence.findAll({
        where: { language },
        attributes: ['category'],
        group: ['category'],
        raw: true
    });
    const fromDb = rows
        .flatMap(r => (r.category || '').split('+').map(c => c.trim()))
        .filter(c => c && !EXCLUDED.has(c))
        // Englische Zusätze wie "Present Simple (Comparative)" sind keine eigene Zeitform
        .filter(c => language !== 'en' || !/\(.*\)$/.test(c) || BASE_CATEGORIES.en.includes(c));
    const all = [...BASE_CATEGORIES[language], ...fromDb, ...NEW_CATEGORIES[language]];
    return [...new Set(all)];
}

module.exports = { LEVELS, HINTS, NEW_CATEGORIES, getCategories, isSupportedLanguage };
