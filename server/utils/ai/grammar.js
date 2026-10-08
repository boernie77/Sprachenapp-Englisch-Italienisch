// Grammatikarten und Niveaus für die KI-Satzerzeugung (Listen und Regeln: public/ai-core.js).
// Zur Grundliste kommen die Kategorien, die in der globalen Grammatik-Tabelle tatsächlich vorkommen,
// damit Filter und KI-Sätze zusammenpassen.
const { GrammarSentence } = require('../../models');

const { LEVELS, HINTS, NEW_CATEGORIES, hintFor, isSupportedLanguage, categoriesFor } = require('../../public/ai-core');

async function getCategories(language) {
    if (!isSupportedLanguage(language)) return [];
    const rows = await GrammarSentence.findAll({
        where: { language },
        attributes: ['category'],
        group: ['category'],
        raw: true
    });
    return categoriesFor(language, rows.map(r => r.category));
}

module.exports = { LEVELS, HINTS, hintFor, NEW_CATEGORIES, getCategories, isSupportedLanguage };
