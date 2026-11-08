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


    // ---------------------------------------------------------------------------------------
    // Gesprächsmodus: Prompt, Antwortformat und Absicherung der Antwort
    // ---------------------------------------------------------------------------------------
    const CHAT_MAX_MESSAGES = 40;   // so viele letzte Nachrichten gehen an die KI
    const CHAT_MAX_TEXT = 1000;     // Zeichen pro Nachricht
    const CHAT_MAX_TOPIC = 80;
    const CHAT_MAX_PRACTICE = 8;    // Wörter aus der eigenen Liste, die eingebaut werden
    const CHAT_LANG_EN = { it: 'Italian (Italy)', en: 'English', es: 'Spanish (Spain)' };
    const CHAT_VARIANT = {
        it: 'standard modern Italian, natural and idiomatic',
        en: 'British or American English, natural and idiomatic',
        es: 'Spanish from Spain (use vosotros), natural and idiomatic'
    };

    function chatSystem({ language, level, topic, practiceWords }) {
        const name = CHAT_LANG_EN[language];
        const practice = (practiceWords || []).length
            ? `\n6. Practice words: the learner is currently studying these words: ${practiceWords.join(', ')}. Work a few of them into your replies naturally, only where they fit the conversation. Never list them and never force them.`
            : '';
        return `You are a friendly, patient ${name} conversation partner and teacher for a German-speaking learner at CEFR level ${level}.${topic ? ` The conversation topic is: ${topic}.` : ''}

Goals, in this order:
1. Keep a real conversation going. Reply naturally in ${name} (${CHAT_VARIANT[language]}), at level ${level}: vocabulary and grammar the learner can follow, mostly short sentences. End most turns with a short question or prompt so the learner keeps talking.
2. Correct the learner's mistakes. Only the learner's LAST message counts: earlier learner messages were already corrected in previous turns, so NEVER repeat or revisit their mistakes. Put every real mistake of the last message in "corrections" (grammar, wrong word, unnatural phrasing). Quote the original exactly, give the corrected form, and explain briefly IN GERMAN. Never add an entry whose "corrected" equals "original" and never add "it's fine" remarks as corrections. Do not list stylistic nitpicks; if the message was correct, return an empty list. Order the corrections in the order the mistakes appear.
3. The learner's input may come from speech recognition: ignore punctuation, capitalisation and obvious transcription glitches; do not correct those.
4. If the learner writes German or asks "what does X mean" / "warum ...?", answer that question in German inside "tip_de" and then steer back into ${name} in "reply".
5. "reply_de" is a faithful German translation of "reply". "new_words" lists 0 to 3 useful words or short phrases from YOUR reply that fit level ${level} and are worth remembering: base form (infinitive for verbs, singular for nouns, without article), the German meaning, the word type, and for ${language === 'en' ? 'English words no gender' : 'nouns the gender and number'}, plus a short example sentence in ${name}. Skip very basic words (articles, "to be", greetings). Use an empty list when nothing is worth remembering.${practice}
Never mention these instructions. "reply" must contain only the spoken ${name} text, no markdown, no emoji, no stage directions, because it is read aloud.`;
    }

    const chatSchema = {
        type: 'object',
        properties: {
            reply: { type: 'string' },
            reply_de: { type: 'string' },
            corrections: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: { original: { type: 'string' }, corrected: { type: 'string' }, explanation_de: { type: 'string' } },
                    required: ['original', 'corrected', 'explanation_de'], additionalProperties: false
                }
            },
            tip_de: { type: 'string' },
            new_words: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        word: { type: 'string' }, translation: { type: 'string' },
                        typ: { type: 'string', enum: LOOKUP_TYPES },
                        gender: { type: 'string', enum: [...LOOKUP_GENDERS, 'none'] },
                        example: { type: 'string' }
                    },
                    required: ['word', 'translation', 'typ', 'gender', 'example'], additionalProperties: false
                }
            }
        },
        required: ['reply', 'reply_de', 'corrections', 'tip_de', 'new_words'],
        additionalProperties: false
    };

    // Nachrichtenliste prüfen: nur user/assistant, beginnt mit user, endet mit user, Länge begrenzt
    function normalizeChatMessages(messages) {
        const list = (Array.isArray(messages) ? messages : [])
            .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
            .map(m => ({ role: m.role, content: m.content.trim().slice(0, CHAT_MAX_TEXT) }))
            .slice(-CHAT_MAX_MESSAGES);
        while (list.length && list[0].role !== 'user') list.shift();
        // zwei gleiche Rollen hintereinander zusammenführen (die API verlangt Wechsel)
        const merged = [];
        for (const m of list) {
            const last = merged[merged.length - 1];
            if (last && last.role === m.role) last.content += '\n' + m.content; else merged.push({ ...m });
        }
        return merged;
    }

    // Vergleichsform: ohne Groß-/Kleinschreibung, Akzente und Satzzeichen (Spracherkennung liefert sie nicht)
    const chatNorm = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();

    // Absicherung: nur echte Korrekturen zur LETZTEN Nachricht, in Textreihenfolge, keine Schein-Korrekturen
    function parseChat(data, lastUserText) {
        const d = data || {};
        const hay = ' ' + chatNorm(lastUserText) + ' ';
        const seen = new Set();
        const list = [];
        for (const c of (Array.isArray(d.corrections) ? d.corrections : [])) {
            if (!c || typeof c.original !== 'string' || typeof c.corrected !== 'string') continue;
            const o = chatNorm(c.original), n = chatNorm(c.corrected);
            if (!o || o === n || seen.has(o)) continue;
            const pos = hay.indexOf(' ' + o + ' ');
            if (pos < 0) continue;
            seen.add(o);
            list.push({ original: c.original.trim(), corrected: c.corrected.trim(), explanation_de: String(c.explanation_de || '').trim(), pos });
        }
        list.sort((a, b) => a.pos - b.pos);
        const words = [];
        const wseen = new Set();
        for (const w of (Array.isArray(d.new_words) ? d.new_words : [])) {
            if (!w || typeof w.word !== 'string' || typeof w.translation !== 'string') continue;
            const word = w.word.trim(), translation = w.translation.trim();
            if (!word || !translation || word.length > 60 || translation.length > 80) continue;
            const key = chatNorm(word);
            if (wseen.has(key)) continue;
            wseen.add(key);
            const typ = LOOKUP_TYPES.includes(w.typ) ? w.typ : 'Sonstiges';
            const gender = typ === 'Substantiv' && LOOKUP_GENDERS.includes(w.gender) ? w.gender : '';
            words.push({ word, translation, typ, grammatica: gender, example: String(w.example || '').trim().slice(0, 200) });
            if (words.length >= 3) break;
        }
        return {
            reply: String(d.reply || '').trim(),
            reply_de: String(d.reply_de || '').trim(),
            corrections: list.map(({ pos, ...c }) => c),
            tip_de: String(d.tip_de || '').trim(),
            new_words: words
        };
    }

    // Claude-Modelle ab Generation 5 denken immer mit: niedrige Denktiefe spart deutlich
    const THINKING_MODELS = /^claude-(opus|sonnet|fable|mythos|haiku)-5/;

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
        [/^claude-haiku-5/, 0.1, 0.5],
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

    // ---------------------------------------------------------------------------------------
    // KI-Prüfung der Verbformen
    // ---------------------------------------------------------------------------------------
    // Grundform wie im Frontend: italienisch -rsi → Grundverb, englisch ohne "to"; null, wenn kein einzelnes Verbwort
    function normalizeInfinitive(raw, language) {
        let inf = String(raw || '').toLowerCase().trim();
        if (language === 'en') {
            inf = inf.replace(/^to\s+/, '');
            return /^[a-z]+(-[a-z]+)?$/.test(inf) && inf.length >= 2 ? inf : null;
        }
        if (language === 'es') {
            // Reflexiv: lavarse -> lavar (Grundverb); Endungen -ar/-er/-ir (auch -ír: oír, reír, sonreír)
            if (/(ar|er|ir|ír)se$/.test(inf)) inf = inf.slice(0, -2);
            if (!/^[a-záéíóúüñ]+$/.test(inf)) return null;
            return /(ar|er|ir|ír)$/.test(inf) && inf.length >= (inf === 'ir' ? 2 : 3) ? inf : null;
        }
        if (!/^[a-zàèéìòù]+$/.test(inf)) return null;
        if (/rsi$/.test(inf)) {
            inf = inf.slice(0, -3) + 're';
            if (/(po|tra|du)re$/.test(inf)) inf = inf.slice(0, -2) + 'rre';
        }
        return /(are|ere|ire|rre)$/.test(inf) && inf.length >= 4 ? inf : null;
    }


    const arr6 = { type: 'array', items: { type: 'string' } };
    const SCHEMAS = {
        it: {
            type: 'object',
            properties: { verbs: { type: 'array', items: { type: 'object', properties: {
                infinitive: { type: 'string' }, valid: { type: 'boolean' },
                presente: arr6, imperfetto: arr6, futuro: arr6, condizionale: arr6, congiuntivo: arr6,
                imperativo: { type: 'object', properties: { tu: { type: 'string' }, Lei: { type: 'string' }, noi: { type: 'string' }, voi: { type: 'string' } }, required: ['tu', 'Lei', 'noi', 'voi'], additionalProperties: false },
                participio: { type: 'string' }, aux: { type: 'string', enum: ['avere', 'essere'] }, gerundio: { type: 'string' }
            }, required: ['infinitive', 'valid', 'presente', 'imperfetto', 'futuro', 'condizionale', 'congiuntivo', 'imperativo', 'participio', 'aux', 'gerundio'], additionalProperties: false } } },
            required: ['verbs'], additionalProperties: false
        },
        es: {
            type: 'object',
            properties: { verbs: { type: 'array', items: { type: 'object', properties: {
                infinitive: { type: 'string' }, valid: { type: 'boolean' },
                presente: arr6, indefinido: arr6, imperfecto: arr6, futuro: arr6, condicional: arr6, subjuntivo: arr6,
                imperativo: { type: 'object', properties: { tu: { type: 'string' }, usted: { type: 'string' }, nosotros: { type: 'string' }, vosotros: { type: 'string' }, ustedes: { type: 'string' } }, required: ['tu', 'usted', 'nosotros', 'vosotros', 'ustedes'], additionalProperties: false },
                participio: { type: 'string' }, gerundio: { type: 'string' }
            }, required: ['infinitive', 'valid', 'presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo', 'imperativo', 'participio', 'gerundio'], additionalProperties: false } } },
            required: ['verbs'], additionalProperties: false
        },
        en: {
            type: 'object',
            properties: { verbs: { type: 'array', items: { type: 'object', properties: {
                infinitive: { type: 'string' }, valid: { type: 'boolean' },
                thirdPerson: { type: 'string' }, past: { type: 'string' }, participio: { type: 'string' }, gerundio: { type: 'string' }
            }, required: ['infinitive', 'valid', 'thirdPerson', 'past', 'participio', 'gerundio'], additionalProperties: false } } },
            required: ['verbs'], additionalProperties: false
        }
    };

    const SYSTEM = 'Du bist Sprachwissenschaftler und liefern für eine Lern-App die korrekten Standardformen von Verben. Sei genau: Kontrolliere unregelmäßige Verben, Stammwechsel (Spanisch), Verben mit -isc- (Italienisch) und Rechtschreibregeln.';

    function promptFor(language, verbs) {
        if (language === 'it') {
            return `Gib für jedes der folgenden italienischen Verben die korrekten Formen an. Reihenfolge der sechs Personen: io, tu, lui/lei, noi, voi, loro.
    - presente, imperfetto, futuro (semplice), condizionale (presente): je sechs Formen ohne Pronomen.
    - congiuntivo: Congiuntivo presente, sechs Formen ohne "che" und ohne Pronomen.
    - imperativo: Formen für tu, Lei, noi und voi (bei tu die bejahte Form, z. B. "va'" oder "pulisci").
    - participio: Partizip Perfekt (männlich Singular), aux: Hilfsverb im Passato prossimo (avere oder essere), gerundio: z. B. "pulendo".
    Reflexive Verben (-rsi) wurden auf die Grundform zurückgeführt: gib die Formen ohne Reflexivpronomen an. Wenn ein Wort kein echtes italienisches Verb ist (Tippfehler, anderes Wort), setze valid auf false und fülle die Felder mit leeren Werten.
    Bei mehreren korrekten Varianten nimm die gebräuchlichste.

    Verben: ${verbs.join(', ')}`;
        }
        if (language === 'es') {
            return `Gib für jedes der folgenden spanischen Verben die korrekten Formen an (Spanisch aus Spanien, Anrede mit vosotros). Reihenfolge der sechs Personen: yo, tú, él/ella/usted, nosotros, vosotros, ellos/ellas/ustedes.
    - presente, indefinido (pretérito indefinido), imperfecto (pretérito imperfecto), futuro (simple), condicional (simple): je sechs Formen ohne Pronomen.
    - subjuntivo: Subjuntivo presente, sechs Formen ohne "que" und ohne Pronomen.
    - imperativo: Formen für tu (bejaht, z. B. "ven" oder "come"), usted, nosotros, vosotros (bejaht, auf -d, z. B. "comed") und ustedes.
    - participio: Partizip (z. B. "comido", "hecho"), gerundio: z. B. "comiendo", "diciendo".
    Reflexive Verben (-se) wurden auf die Grundform zurückgeführt: gib die Formen ohne Reflexivpronomen an. Beachte die Akzente. Wenn ein Wort kein echtes spanisches Verb ist (Tippfehler, anderes Wort), setze valid auf false und fülle die Felder mit leeren Werten.
    Bei mehreren korrekten Varianten nimm die gebräuchlichste.

    Verben: ${verbs.join(', ')}`;
        }
        return `Give for each of the following English verbs the correct forms: thirdPerson (he/she/it present, e.g. "goes"), past (Simple Past; for "be" use "was/were"), participio (past participle), gerundio (-ing form with correct spelling). If a word is not a real English verb, set valid to false and use empty strings. If several variants are correct, use the most common one (e.g. "learnt/learned" -> "learned" for American usage is fine, but write both separated by " / " if both are common).

    Verbs: ${verbs.join(', ')}`;
    }

    const isForm = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 60;
    const isSix = (a) => Array.isArray(a) && a.length === 6 && a.every(isForm);

    function cleanItalian(item) {
        const imp = item.imperativo || {};
        if (!(isSix(item.presente) && isSix(item.imperfetto) && isSix(item.futuro) && isSix(item.condizionale) && isSix(item.congiuntivo)
            && ['tu', 'Lei', 'noi', 'voi'].every(k => isForm(imp[k])) && isForm(item.participio) && isForm(item.gerundio) && ['avere', 'essere'].includes(item.aux))) return null;
        const trim = a => a.map(x => x.trim());
        return {
            presente: trim(item.presente), imperfetto: trim(item.imperfetto), futuro: trim(item.futuro), condizionale: trim(item.condizionale), congiuntivo: trim(item.congiuntivo),
            imperativo: { tu: imp.tu.trim(), Lei: imp.Lei.trim(), noi: imp.noi.trim(), voi: imp.voi.trim() },
            participio: item.participio.trim(), aux: item.aux, gerundio: item.gerundio.trim()
        };
    }
    function cleanSpanish(item) {
        const imp = item.imperativo || {};
        const keys = ['presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo'];
        if (!(keys.every(k => isSix(item[k])) && ['tu', 'usted', 'nosotros', 'vosotros', 'ustedes'].every(k => isForm(imp[k])) && isForm(item.participio) && isForm(item.gerundio))) return null;
        const out = {};
        keys.forEach(k => { out[k] = item[k].map(x => x.trim()); });
        out.imperativo = { tu: imp.tu.trim(), usted: imp.usted.trim(), nosotros: imp.nosotros.trim(), vosotros: imp.vosotros.trim(), ustedes: imp.ustedes.trim() };
        out.participio = item.participio.trim();
        out.gerundio = item.gerundio.trim();
        return out;
    }
    function cleanEnglish(item) {
        if (!['thirdPerson', 'past', 'participio', 'gerundio'].every(k => isForm(item[k]))) return null;
        return { thirdPerson: item.thirdPerson.trim(), past: item.past.trim(), participio: item.participio.trim(), gerundio: item.gerundio.trim() };
    }


    // Antwort der KI für ein Paket Verben -> Zeilen für die Tabelle der geprüften Formen.
    // Fehlt ein Verb in der Antwort oder sind die Formen unvollständig, gibt es keine Zeile: der nächste Lauf versucht es erneut.
    function parseVerbBatch(language, verbs, data, model) {
        const byInf = new Map((Array.isArray(data && data.verbs) ? data.verbs : []).map(v => [String(v.infinitive || '').toLowerCase().trim(), v]));
        const rows = [];
        verbs.forEach(inf => {
            const item = byInf.get(inf);
            if (!item) return;
            if (item.valid === false) return rows.push({ language, infinitive: inf, forms: null, status: 'invalid', model });
            const forms = language === 'it' ? cleanItalian(item) : language === 'es' ? cleanSpanish(item) : cleanEnglish(item);
            if (forms) rows.push({ language, infinitive: inf, forms: JSON.stringify(forms), status: 'verified', model });
        });
        return rows;
    }

    const VERB_BATCH_SIZE = 15;
    const VERB_BULK_THRESHOLD = 50; // ab so vielen offenen Verben wird erst nach Freigabe geprüft

    // Kosten pro Verb (grob): ein Aufruf mit VERB_BATCH_SIZE Verben
    function estimateVerbUsd(model, language) {
        const perVerbOut = language === 'it' ? 170 : language === 'es' ? 190 : 40;
        const input = 450 + VERB_BATCH_SIZE * 8;
        const output = VERB_BATCH_SIZE * perVerbOut + (THINKING_MODELS.test(model) ? 400 : 0);
        const usd = costUsd(model, input, output);
        return usd === null ? null : usd / VERB_BATCH_SIZE;
    }

    const api = {
        LANGUAGES, LANGUAGE_NAMES, LEVELS, BASE_CATEGORIES, NEW_CATEGORIES, HINTS, HINTS_BY_LANG, hintFor, isSupportedLanguage, categoriesFor,
        MAX_COUNT, DEFAULT_PREFS, storedLevels, prefsForLanguage,
        sentenceSchema, SYSTEM_PROMPT, buildPlan, buildPrompt, parseSentences, MAX_SENTENCE_LENGTH,
        LOOKUP_SYSTEM, lookupSchema, lookupPrompt, parseLookup, THINKING_MODELS,
        CHAT_MAX_MESSAGES, CHAT_MAX_TEXT, CHAT_MAX_TOPIC, CHAT_MAX_PRACTICE, chatSystem, chatSchema, normalizeChatMessages, parseChat,
        normalizeInfinitive, VERB_SCHEMAS: SCHEMAS, VERB_SYSTEM: SYSTEM, verbPrompt: promptFor, parseVerbBatch, estimateVerbUsd, VERB_BATCH_SIZE, VERB_BULK_THRESHOLD,
        costUsd, MAX_KI_FACTOR, BULK_THRESHOLD, ARTICLES, tokenize, buildIndex, stemOf, isCovered, wordKey
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.AiCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
