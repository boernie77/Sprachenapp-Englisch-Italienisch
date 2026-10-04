// Grammatikarten und Niveaus für die KI-Satzerzeugung.
// Die Grundliste stammt aus den Excel-Listen; dazu kommen die Kategorien, die in der
// globalen Grammatik-Tabelle tatsächlich vorkommen, damit Filter und KI-Sätze zusammenpassen.
const { GrammarSentence } = require('../../models');

const LEVELS = ['A1', 'A2', 'B1', 'B2'];

const BASE_CATEGORIES = {
    it: ['Presente', 'Passato Prossimo', 'Imperfetto', 'Gerundio', 'Preposizioni Articolate'],
    // Namen wie nach dem Admin-Import (uploadGrammar vereinheitlicht die englischen Kategorien)
    en: ['Simple Present', 'Present Continuous', 'Simple Past', 'Present Perfect', 'Modalverb',
        'Imperativ', 'Conditional', 'Future'],
    // Spanisch (Spanien): Namen wie in den Excel-Listen erwartet
    es: ['Presente', 'Pretérito Perfecto', 'Pretérito Indefinido', 'Pretérito Imperfecto', 'Gerundio']
};

// Neu für die KI-Auswahl (Imperativ, Konjunktiv, Zukunft); im Englischen gibt es Imperative und Future schon
const NEW_CATEGORIES = {
    it: ['Imperativo', 'Congiuntivo', 'Futuro Semplice'],
    en: ['Subjunctive'],
    es: ['Imperativo', 'Subjuntivo', 'Futuro', 'Condicional']
};

// Sammelkategorien und Ausreißer aus den Listen, die sich nicht als Grammatikart eignen
const EXCLUDED = new Set(['Grammatik', 'Gemischt', 'Allgemein', 'Eigene Sätze']);

// Kurze Erklärung je Kategorie, damit die KI die Zeitform eindeutig trifft.
// Je Sprache getrennt, weil Namen wie "Presente", "Gerundio" und "Imperativo" in mehreren Sprachen vorkommen.
const HINTS_BY_LANG = {
    es: {
        'Presente': 'Presente de indicativo (Spanien)',
        'Pretérito Perfecto': 'Pretérito perfecto compuesto (haber + participio), z.B. he comido',
        'Pretérito Indefinido': 'Pretérito indefinido (abgeschlossene Handlung in der Vergangenheit), z.B. comí, fue',
        'Pretérito Imperfecto': 'Pretérito imperfecto (Gewohnheit, Beschreibung), z.B. comía, era',
        'Gerundio': 'Gerundio, z.B. estar + gerundio (estoy comiendo)',
        'Imperativo': 'Imperativo (tú, usted, nosotros, vosotros oder ustedes), auch verneint',
        'Subjuntivo': 'Subjuntivo presente, z.B. nach quiero que, espero que, es posible que',
        'Futuro': 'Futuro simple, z.B. comeré, será',
        'Condicional': 'Condicional simple, z.B. comería, sería'
    }
};
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
    'Simple Present': 'Present simple',
    'Present Continuous': 'Present continuous (nur mit Handlungsverben, keine Zustandsverben wie love/know)',
    'Simple Past': 'Simple past',
    'Present Perfect': 'Present perfect',
    'Imperativ': 'Imperative',
    'Conditional': 'First conditional (if + present, will) oder second conditional (if + past, would)',
    'Future': 'Future mit will oder be going to',
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
        .filter(c => language !== 'en' || !/\(.*\)$/.test(c));
    const all = [...BASE_CATEGORIES[language], ...fromDb, ...NEW_CATEGORIES[language]];
    return [...new Set(all)];
}

// Erklärung für eine Kategorie in der jeweiligen Sprache (sprachspezifisch vor allgemein)
const hintFor = (language, category) => (HINTS_BY_LANG[language] && HINTS_BY_LANG[language][category]) || HINTS[category];

module.exports = { LEVELS, HINTS, hintFor, NEW_CATEGORIES, getCategories, isSupportedLanguage };
