// Gemeinsamer Kern der KI-Funktionen: Grammatikarten, Prompts, Satzplanung, Preise, Wortabdeckung.
// Reine Funktionen ohne Datenbank und ohne Netzwerk. Der Server (server/utils/ai/*) und die App im lokalen Betrieb
// (local-ai.js) nutzen genau diese Datei – Prompts und Regeln gibt es nur hier.
(function (root) {
    'use strict';

    // Die Spalte `it` der Tabellen heißt aus Altgründen so, enthält aber immer das Fremdwort der jeweiligen Lernsprache.
    const LANGUAGES = ['it', 'en', 'es'];
    const LANGUAGE_NAMES = { it: 'Italienisch', en: 'Englisch', es: 'Spanisch' };

    // ---------------------------------------------------------------------------------------
    // Grammatikarten und Niveaus
    // ---------------------------------------------------------------------------------------
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

    // Erklärung für eine Kategorie in der jeweiligen Sprache (sprachspezifisch vor allgemein)
    const hintFor = (language, category) => (HINTS_BY_LANG[language] && HINTS_BY_LANG[language][category]) || HINTS[category];

    // Auswählbare Grammatikarten: Grundliste + Kategorien, die in den Satzlisten tatsächlich vorkommen + neue Arten
    function categoriesFor(language, usedCategories) {
        if (!isSupportedLanguage(language)) return [];
        const fromLists = (usedCategories || [])
            .flatMap(c => (c || '').split('+').map(x => x.trim()))
            .filter(c => c && !EXCLUDED.has(c))
            // Englische Zusätze wie "Present Simple (Comparative)" sind keine eigene Zeitform
            .filter(c => language !== 'en' || !/\(.*\)$/.test(c));
        return [...new Set([...BASE_CATEGORIES[language], ...fromLists, ...NEW_CATEGORIES[language]])];
    }

    // ---------------------------------------------------------------------------------------
    // Einstellungen je Nutzer (aiPrefs)
    // ---------------------------------------------------------------------------------------
    const MAX_COUNT = 10;
    const DEFAULT_PREFS = { enabled: false, levels: ['A1'], categories: [], count: 3 };

    // Frühere Einstellungen kannten nur ein Niveau (level)
    function storedLevels(prefs) {
        const raw = Array.isArray(prefs.levels) ? prefs.levels : (prefs.level ? [prefs.level] : []);
        const valid = LEVELS.filter(l => raw.includes(l));
        return valid.length ? valid : DEFAULT_PREFS.levels;
    }

    // Einstellungen pro Sprache: Grammatikarten unterscheiden sich zwischen den Sprachen
    const prefsForLanguage = (prefs, language) => ({
        enabled: prefs.enabled === true,
        levels: storedLevels(prefs),
        count: Number.isInteger(prefs.count) ? Math.min(MAX_COUNT, Math.max(1, prefs.count)) : DEFAULT_PREFS.count,
        categories: Array.isArray(prefs.categoriesByLang && prefs.categoriesByLang[language]) ? prefs.categoriesByLang[language] : []
    });

    // ---------------------------------------------------------------------------------------
    // Prompts und Schemas
    // ---------------------------------------------------------------------------------------
    function sentenceSchema(categories, levels) {
        return {
            type: 'object',
            properties: {
                sentences: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            foreign: { type: 'string' },
                            german: { type: 'string' },
                            category: { type: 'string', enum: categories },
                            level: { type: 'string', enum: levels }
                        },
                        required: ['foreign', 'german', 'category', 'level'],
                        additionalProperties: false
                    }
                }
            },
            required: ['sentences'],
            additionalProperties: false
        };
    }

    const SYSTEM_PROMPT = `Du bist eine erfahrene Lehrkraft für Fremdsprachen und schreibst Übungssätze für eine Lern-App deutschsprachiger Lernender.

Jeder Satz muss:
- inhaltlich logisch und alltagsnah sein. Prüfe vor der Ausgabe, ob die Handlung in der echten Welt Sinn ergibt (Brot isst man, Wasser trinkt man; Gegenstände handeln nicht wie Menschen; Zeitangaben passen zur Zeitform).
- das vorgegebene Wort in einer passenden, gebeugten oder unveränderten Form enthalten.
- die angegebene Grammatikart eindeutig und korrekt verwenden.
- zum Sprachniveau passen (A1 sehr einfach und kurz, B2 auch Nebensätze).
- höchstens 15 Wörter haben.
- bei Spanisch: Spanisch aus Spanien (kastilisch, Anrede vosotros/vosotras), mit korrekten Akzenten und mit ¿…? und ¡…! bei Fragen und Ausrufen.
- eine natürliche, inhaltlich genaue deutsche Übersetzung mit korrekter Groß- und Kleinschreibung haben.

Verteile die Sätze gleichmäßig auf die angegebenen Grammatikarten und wiederhole keine Satzmuster.`;

    function shuffled(list, random) {
        const copy = [...list];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    // Verteilt die Sätze fest auf die gewählten Grammatikarten und Niveaus (zufällige Reihenfolge je Wort,
    // damit bei wenigen Sätzen pro Wort über viele Wörter alle Arten gleich oft vorkommen)
    function buildPlan(categories, levels, count, random = Math.random) {
        const cats = shuffled(categories, random);
        const lvls = shuffled(levels, random);
        return Array.from({ length: count }, (_, i) => ({ category: cats[i % cats.length], level: lvls[i % lvls.length] }));
    }

    function buildPrompt({ word, translation, language, plan }) {
        const categories = [...new Set(plan.map(p => p.category))];
        const categoryLines = categories.map(c => `- ${c}${hintFor(language, c) ? ` (${hintFor(language, c)})` : ''}`).join('\n');
        const planLines = plan.map((p, i) => `${i + 1}. Grammatikart: ${p.category}, Niveau: ${p.level}`).join('\n');
        return `Sprache: ${LANGUAGE_NAMES[language]}
Wort: ${word}${translation ? `\nDeutsche Bedeutung: ${translation}` : ''}

Grammatikarten:
${categoryLines}

Schreibe genau ${plan.length} Sätze auf ${LANGUAGE_NAMES[language]} mit deutscher Übersetzung, in dieser Reihenfolge:
${planLines}
Setze "category" und "level" jedes Satzes genau wie in seiner Zeile oben.`;
    }

    const MAX_SENTENCE_LENGTH = 250; // Spalten it/de sind VARCHAR(255)

    // Antwort der KI -> Sätze; Grammatikart und Niveau stammen aus dem Plan, nicht aus der Antwort
    function parseSentences(result, plan, count) {
        return (Array.isArray(result && result.sentences) ? result.sentences : [])
            .slice(0, count)
            .map((sen, i) => ({
                foreign: String(sen.foreign || '').trim(),
                german: String(sen.german || '').trim(),
                category: plan[i].category,
                level: plan[i].level
            }))
            .filter(sen => sen.foreign && sen.german && sen.foreign.length <= MAX_SENTENCE_LENGTH && sen.german.length <= MAX_SENTENCE_LENGTH);
    }

    const LOOKUP_TYPES = ['Substantiv', 'Verb', 'Adjektiv', 'Sonstiges'];
    const LOOKUP_GENDERS = ['m-sg', 'f-sg', 'm-pl', 'f-pl'];
    const LOOKUP_SYSTEM = 'Du bestimmst für eine Vokabel-App die Wortart und bei italienischen und spanischen Substantiven das grammatische Geschlecht samt Zahl. Antworte ausschließlich nach dem Schema.';
    const lookupSchema = {
        type: 'object',
        properties: {
            typ: { type: 'string', enum: LOOKUP_TYPES },
            gender: { type: 'string', enum: [...LOOKUP_GENDERS, 'none'] }
        },
        required: ['typ', 'gender'],
        additionalProperties: false
    };
    const lookupPrompt = ({ word, translation, language }) =>
        `Sprache: ${LANGUAGE_NAMES[language]}\nWort: ${word}${translation ? `\nDeutsche Bedeutung: ${translation}` : ''}\n\nBestimme die Wortart (Substantiv, Verb, Adjektiv oder Sonstiges). "gender" ist bei italienischen und spanischen Substantiven m-sg (männlich Einzahl), f-sg, m-pl oder f-pl, sonst none.`;
    function parseLookup(data, language) {
        const typ = LOOKUP_TYPES.includes(data && data.typ) ? data.typ : 'Sonstiges';
        const gender = (language === 'it' || language === 'es') && typ === 'Substantiv' && LOOKUP_GENDERS.includes(data.gender) ? data.gender : '';
        return { typ, grammatica: gender };
    }

    // Claude-Modelle ab Generation 5 denken immer mit: niedrige Denktiefe spart deutlich
    const THINKING_MODELS = /^claude-(opus|sonnet|fable|mythos)-5/;

    // ---------------------------------------------------------------------------------------
    // Preise (Listenpreise in US-Dollar pro 1 Million Token [Eingabe, Ausgabe], Stand 2026-09, Anthropic-Preisliste).
    // Unbekannte Modelle (z.B. OpenAI) haben keinen Preis: dort werden nur Token gezählt.
    // ---------------------------------------------------------------------------------------
    const PRICES = [
        [/^claude-(fable|mythos)/, 10, 50],
        [/^claude-opus-5-5/, 4, 20],
        [/^claude-opus-(5|4)/, 5, 25],
        [/^claude-sonnet-5/, 2, 10],
        [/^claude-sonnet-4/, 3, 15],
        [/^claude-haiku-4-5/, 1, 5]
    ];
    function costUsd(model, inputTokens, outputTokens) {
        const entry = PRICES.find(([pattern]) => pattern.test(model || ''));
        if (!entry) return null;
        return (inputTokens * entry[1] + outputTokens * entry[2]) / 1e6;
    }

    // ---------------------------------------------------------------------------------------
    // Welche Wörter schon in einem Satz vorkommen (Näherung: Artikel weg, Verbstamm, grobe Endungen)
    // ---------------------------------------------------------------------------------------
    const MAX_KI_FACTOR = 2;   // höchstens so viele KI-Sätze pro Wort (und Niveau): Faktor mal eingestellte Anzahl
    const BULK_THRESHOLD = 50; // ab so vielen offenen Wörtern startet die Automatik erst nach Freigabe durch den Nutzer
    const ARTICLES = {
        it: ['il', 'lo', 'la', 'l', 'i', 'gli', 'le', 'un', 'uno', 'una'],
        en: ['to', 'the', 'a', 'an'],
        es: ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']
    };

    const tokenize = (text) => String(text || '').toLowerCase().replace(/[’']/g, ' ').split(/[^\p{L}]+/u).filter(Boolean);

    // Index aller Wörter in den vorhandenen Sätzen: erste 3 Buchstaben -> Wortformen
    function buildIndex(sentenceTexts) {
        const forms = new Set();
        sentenceTexts.forEach(text => tokenize(text).forEach(t => forms.add(t)));
        const byPrefix = new Map();
        forms.forEach(t => {
            const key = t.slice(0, 3);
            if (!byPrefix.has(key)) byPrefix.set(key, []);
            byPrefix.get(key).push(t);
        });
        return { forms, byPrefix };
    }

    function stemOf(token, language, typ) {
        if (language === 'it' && /verb/i.test(typ || '') && /(are|ere|ire)$/.test(token) && token.length > 4) return token.slice(0, -3);
        if (language === 'es' && /verb/i.test(typ || '') && /(ar|er|ir)$/.test(token) && token.length > 4) return token.slice(0, -2);
        if (token.length >= 5) return token.slice(0, -1); // Mehrzahl und Endungen grob abfangen
        return token;
    }

    function isCovered(word, language, index) {
        let tokens = tokenize(word.it);
        if (tokens.length > 1 && (ARTICLES[language] || []).includes(tokens[0])) tokens = tokens.slice(1);
        if (tokens.length === 0) return true; // nichts Sinnvolles zu suchen
        return tokens.every(token => {
            if (index.forms.has(token)) return true;
            const stem = stemOf(token, language, word.typ);
            if (stem.length < 3 || stem === token) return false;
            return (index.byPrefix.get(stem.slice(0, 3)) || []).some(form => form.startsWith(stem) && form.length <= token.length + 3);
        });
    }

    // Fremdwort ohne Artikel, klein geschrieben (gleicher Schlüssel für "la casa" und "casa")
    function wordKey(text, language) {
        const tokens = tokenize(text);
        if (tokens.length > 1 && (ARTICLES[language] || []).includes(tokens[0])) tokens.shift();
        return tokens.join(' ');
    }

    const api = {
        LANGUAGES, LANGUAGE_NAMES, LEVELS, BASE_CATEGORIES, NEW_CATEGORIES, HINTS, HINTS_BY_LANG, hintFor, isSupportedLanguage, categoriesFor,
        MAX_COUNT, DEFAULT_PREFS, storedLevels, prefsForLanguage,
        sentenceSchema, SYSTEM_PROMPT, buildPlan, buildPrompt, parseSentences, MAX_SENTENCE_LENGTH,
        LOOKUP_SYSTEM, lookupSchema, lookupPrompt, parseLookup, THINKING_MODELS,
        costUsd, MAX_KI_FACTOR, BULK_THRESHOLD, ARTICLES, tokenize, buildIndex, stemOf, isCovered, wordKey
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.AiCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
