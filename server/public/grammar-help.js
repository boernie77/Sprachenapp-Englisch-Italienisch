// Grammatik-Hilfe für den Grammatik-Modus: Erklärungen je Kategorie und Konjugationstabellen
// (Italienisch, Englisch und Spanisch). Läuft im Browser (window.GrammarHelp) und in Node (für Tests).
(function (root) {
    'use strict';

    // ---------------------------------------------------------------------------------------
    // Erklärungen (auf Deutsch, für deutschsprachige Lernende)
    // ---------------------------------------------------------------------------------------
    const EXPLANATIONS = {
        it: {
            'Presente': {
                title: 'Presente (Gegenwart)',
                text: 'Für Handlungen, die jetzt oder regelmäßig passieren, und für feste Pläne in naher Zukunft.',
                rule: 'Stamm + -o, -i, -a/-e, -iamo, -ate/-ete/-ite, -ano/-ono',
                example: 'Ogni mattina bevo un caffè. – Jeden Morgen trinke ich einen Kaffee.'
            },
            'Passato Prossimo': {
                title: 'Passato prossimo (Perfekt)',
                text: 'Für abgeschlossene Handlungen in der Vergangenheit. Verben der Bewegung und Zustandsänderung sowie reflexive Verben bilden es mit „essere“ – dann richtet sich das Partizip nach dem Subjekt (andato/andata/andati/andate).',
                rule: 'avere/essere im Presente + Partizip (-ato, -uto, -ito)',
                example: 'Ieri abbiamo mangiato la pizza. / Maria è partita. – Gestern haben wir Pizza gegessen. / Maria ist abgereist.'
            },
            'Imperfetto': {
                title: 'Imperfetto (Vergangenheit, Hintergrund)',
                text: 'Für Gewohnheiten, Beschreibungen und Zustände in der Vergangenheit sowie für Handlungen, die gerade im Gange waren, als etwas anderes passierte.',
                rule: 'Stamm + -avo/-evo/-ivo, -avi, -ava, -avamo, -avate, -avano',
                example: 'Da bambino giocavo sempre in giardino. – Als Kind spielte ich immer im Garten.'
            },
            'Gerundio': {
                title: 'Gerundio (Verlaufsform)',
                text: 'Mit „stare“ beschreibt es, was gerade passiert („ich bin gerade dabei …“). Allein steht es für gleichzeitige Handlungen („während/indem …“).',
                rule: 'stare + Stamm + -ando (-are) / -endo (-ere, -ire)',
                example: 'Sto leggendo un libro. – Ich lese gerade ein Buch.'
            },
            'Preposizioni Articolate': {
                title: 'Preposizioni articolate (verschmolzene Präpositionen)',
                text: 'Die Präpositionen di, a, da, in, su verschmelzen mit dem bestimmten Artikel zu einem Wort. Die Form richtet sich nach dem folgenden Substantiv (Geschlecht, Zahl, Anfangsbuchstabe).',
                rule: 'di+il = del, a+la = alla, da+i = dai, in+lo = nello, su+le = sulle …',
                example: 'Il libro è sul tavolo nella cucina. – Das Buch liegt auf dem Tisch in der Küche.'
            },
            'Gemischt': {
                title: 'Passato prossimo und Imperfetto gemischt',
                text: 'Das Imperfetto beschreibt den Hintergrund oder eine laufende Handlung, das Passato prossimo die neue, abgeschlossene Handlung, die dazwischenkommt.',
                rule: 'Hintergrund: Imperfetto – Ereignis: Passato prossimo',
                example: 'Mentre leggevo, è squillato il telefono. – Während ich las, klingelte das Telefon.'
            },
            'Imperativo': {
                title: 'Imperativo (Befehlsform)',
                text: 'Für Aufforderungen, Bitten und Ratschläge. Die verneinte Form für „tu“ ist „non“ + Infinitiv. Pronomen hängen bei tu/noi/voi hinten an (dimmi, alzati).',
                rule: 'tu: parla / prendi / senti – Lei: parli / prenda – noi: parliamo – voi: parlate',
                example: 'Chiudi la finestra, per favore! Non parlare così forte! – Schließ bitte das Fenster! Sprich nicht so laut!'
            },
            'Congiuntivo': {
                title: 'Congiuntivo (Möglichkeitsform)',
                text: 'Steht in Nebensätzen nach Ausdrücken von Meinung, Wunsch, Zweifel, Gefühl oder Notwendigkeit (penso che, spero che, voglio che, è importante che) sowie nach benché, affinché, prima che.',
                rule: '-are: parli, parli, parli, parliamo, parliate, parlino – -ere/-ire: prenda … prendano',
                example: 'Penso che Marco abbia ragione. – Ich glaube, dass Marco recht hat.'
            },
            'Condizionale': {
                title: 'Condizionale (Wunsch, höfliche Bitte)',
                text: 'Für höfliche Bitten, Wünsche, Ratschläge und mögliche (nicht sichere) Handlungen. Der Stamm ist wie beim Futur, dazu kommen die Endungen des Condizionale.',
                rule: 'Futurstamm + -ei, -esti, -ebbe, -emmo, -este, -ebbero',
                example: 'Vorrei un caffè. / Potresti aiutarmi? – Ich hätte gern einen Kaffee. / Könntest du mir helfen?'
            },
            'Futuro Semplice': {
                title: 'Futuro semplice (Zukunft)',
                text: 'Für Handlungen in der Zukunft, aber auch für Vermutungen in der Gegenwart („sarà stanco“ – er wird wohl müde sein).',
                rule: 'Infinitiv ohne -e (-are → -er-) + -ò, -ai, -à, -emo, -ete, -anno',
                example: 'L’anno prossimo andrò in Italia. – Nächstes Jahr werde ich nach Italien fahren.'
            }
        },
        en: {
            'Simple Present': {
                title: 'Simple Present (einfache Gegenwart)',
                text: 'Für Gewohnheiten, Fakten und regelmäßige Abläufe. Bei he/she/it kommt ein -s an das Verb. Fragen und Verneinungen bildet man mit do/does.',
                rule: 'I work – he works – Do you work? – She doesn’t work.',
                example: 'She drinks coffee every morning. – Sie trinkt jeden Morgen Kaffee.'
            },
            'Present Continuous': {
                title: 'Present Continuous (Verlaufsform der Gegenwart)',
                text: 'Für Handlungen, die gerade jetzt passieren oder vorübergehend sind, und für feste Pläne. Zustandsverben (know, like, want, need) stehen nicht in dieser Form.',
                rule: 'am/is/are + Verb-ing',
                example: 'I am reading a book right now. – Ich lese gerade ein Buch.'
            },
            'Simple Past': {
                title: 'Simple Past (einfache Vergangenheit)',
                text: 'Für abgeschlossene Handlungen zu einem bestimmten Zeitpunkt in der Vergangenheit (yesterday, last week, in 2010). Regelmäßige Verben bekommen -ed, unregelmäßige haben eigene Formen.',
                rule: 'worked / went – Did you go? – I didn’t go.',
                example: 'We visited our grandparents last weekend. – Wir besuchten letztes Wochenende unsere Großeltern.'
            },
            'Present Perfect': {
                title: 'Present Perfect',
                text: 'Verbindet Vergangenheit und Gegenwart: für Erfahrungen, Ergebnisse, die jetzt wichtig sind, und Handlungen bis jetzt (since, for, already, yet, ever, never). Kein bestimmter Zeitpunkt in der Vergangenheit.',
                rule: 'have/has + Partizip (worked, seen, been)',
                example: 'I have never been to London. – Ich war noch nie in London.'
            },
            'Modalverb': {
                title: 'Modalverben',
                text: 'can, could, must, should, may, might drücken Fähigkeit, Pflicht, Rat oder Möglichkeit aus. Sie bekommen kein -s und stehen mit dem Infinitiv ohne „to“.',
                rule: 'Modalverb + Infinitiv (He can swim. You should rest.)',
                example: 'You must wear a helmet. – Du musst einen Helm tragen.'
            },
            'Imperativ': {
                title: 'Imperative (Befehlsform)',
                text: 'Für Aufforderungen, Anweisungen und Bitten. Man nimmt die Grundform des Verbs ohne Subjekt; verneint mit „don’t“.',
                rule: 'Open the door! – Don’t touch it!',
                example: 'Please close the window. – Bitte schließ das Fenster.'
            },
            'Conditional': {
                title: 'Conditional (Bedingungssätze)',
                text: 'Typ 1 – reale Bedingung: if + Simple Present, will + Infinitiv. Typ 2 – unwahrscheinliche oder gedachte Bedingung: if + Simple Past, would + Infinitiv.',
                rule: 'If it rains, we will stay home. / If I had time, I would help you.',
                example: 'If you study, you will pass the test. – Wenn du lernst, wirst du den Test bestehen.'
            },
            'Future': {
                title: 'Future (will / going to)',
                text: '„will“ für spontane Entscheidungen, Versprechen und Vorhersagen; „be going to“ für Pläne und Absichten sowie für Vorhersagen mit sichtbaren Anzeichen.',
                rule: 'will + Infinitiv / am/is/are going to + Infinitiv',
                example: 'Look at the clouds – it is going to rain. – Schau dir die Wolken an – es wird regnen.'
            },
            'Subjunctive': {
                title: 'Subjunctive (Möglichkeitsform)',
                text: 'Für Wünsche und gedachte Situationen („If I were …“, „I wish I were …“) und nach Verben wie suggest, insist, recommend (dann Grundform ohne -s).',
                rule: 'If I were you … / I suggest that he see a doctor.',
                example: 'I wish I were on holiday. – Ich wünschte, ich wäre im Urlaub.'
            }
        },
        es: {
            'Presente': {
                title: 'Presente (Gegenwart)',
                text: 'Für Handlungen, die jetzt oder regelmäßig passieren, und für feste Pläne in naher Zukunft. Viele häufige Verben haben einen Stammwechsel (pensar → pienso, poder → puedo, pedir → pido), der bei nosotros und vosotros ausbleibt.',
                rule: '-ar: -o, -as, -a, -amos, -áis, -an – -er: -o, -es, -e, -emos, -éis, -en – -ir: -o, -es, -e, -imos, -ís, -en',
                example: 'Todas las mañanas bebo un café. – Jeden Morgen trinke ich einen Kaffee.'
            },
            'Pretérito Perfecto': {
                title: 'Pretérito perfecto (Perfekt)',
                text: 'Für Handlungen, die in einem Zeitraum liegen, der bis jetzt reicht (hoy, esta semana, este año, ya, todavía no), und für Erfahrungen. In Spanien wird es sehr häufig benutzt. Das Partizip bleibt nach „haber“ immer gleich (-ado, -ido).',
                rule: 'haber (he, has, ha, hemos, habéis, han) + Partizip (hablado, comido, vivido) – unregelmäßig: hecho, dicho, visto, puesto, escrito, abierto',
                example: 'Hoy he comido paella. – Heute habe ich Paella gegessen.'
            },
            'Pretérito Indefinido': {
                title: 'Pretérito indefinido (abgeschlossene Vergangenheit)',
                text: 'Für abgeschlossene Handlungen in einem Zeitraum, der vorbei ist (ayer, el año pasado, en 2010, hace dos días). Viele häufige Verben sind unregelmäßig (ser/ir → fui, tener → tuve, hacer → hice).',
                rule: '-ar: -é, -aste, -ó, -amos, -asteis, -aron – -er/-ir: -í, -iste, -ió, -imos, -isteis, -ieron',
                example: 'Ayer visité a mis abuelos. – Gestern habe ich meine Großeltern besucht.'
            },
            'Pretérito Imperfecto': {
                title: 'Pretérito imperfecto (Vergangenheit, Hintergrund)',
                text: 'Für Gewohnheiten, Beschreibungen und Zustände in der Vergangenheit sowie für Handlungen, die gerade im Gange waren. Nur drei Verben sind unregelmäßig: ser (era), ir (iba), ver (veía).',
                rule: '-ar: -aba, -abas, -aba, -ábamos, -abais, -aban – -er/-ir: -ía, -ías, -ía, -íamos, -íais, -ían',
                example: 'De niño jugaba siempre en el jardín. – Als Kind spielte ich immer im Garten.'
            },
            'Gerundio': {
                title: 'Gerundio (Verlaufsform)',
                text: 'Mit „estar“ beschreibt es, was gerade passiert („ich bin gerade dabei …“). Allein steht es für gleichzeitige Handlungen („indem, während“). Pronomen hängen hinten an (estoy lavándome / me estoy lavando).',
                rule: 'estar + Stamm + -ando (-ar) / -iendo (-er, -ir) – leer → leyendo, dormir → durmiendo, decir → diciendo',
                example: 'Estoy leyendo un libro. – Ich lese gerade ein Buch.'
            },
            'Imperativo': {
                title: 'Imperativo (Befehlsform)',
                text: 'Für Aufforderungen, Bitten und Ratschläge. Bejaht hat „tú“ die Form der 3. Person Singular, „vosotros“ endet auf -d. Verneint (und bei usted/ustedes/nosotros) benutzt man den Subjuntivo. Pronomen hängen bei bejahten Befehlen hinten an (dime, siéntate).',
                rule: 'tú: habla / come / escribe – usted: hable / coma – vosotros: hablad / comed – verneint: no hables / no comas',
                example: 'Cierra la ventana, por favor. No hables tan alto. – Schließ bitte das Fenster. Sprich nicht so laut.'
            },
            'Subjuntivo': {
                title: 'Subjuntivo (Möglichkeitsform)',
                text: 'Steht in Nebensätzen nach Wunsch, Zweifel, Gefühl, Befehl oder Notwendigkeit (quiero que, espero que, es posible que, dudo que, para que, cuando + Zukunft). Der Stamm kommt von der yo-Form des Presente.',
                rule: '-ar: -e, -es, -e, -emos, -éis, -en – -er/-ir: -a, -as, -a, -amos, -áis, -an (tengo → tenga)',
                example: 'Quiero que vengas a mi fiesta. – Ich möchte, dass du auf meine Party kommst.'
            },
            'Futuro': {
                title: 'Futuro simple (Zukunft)',
                text: 'Für Handlungen in der Zukunft, aber auch für Vermutungen in der Gegenwart („estará cansado“ – er ist wohl müde). Im Alltag steht oft „ir a + Infinitiv“ (voy a viajar).',
                rule: 'Infinitiv + -é, -ás, -á, -emos, -éis, -án – Stammwechsel bei tener (tendré), hacer (haré), poder (podré), decir (diré)',
                example: 'El año que viene viajaré a España. – Nächstes Jahr werde ich nach Spanien reisen.'
            },
            'Condicional': {
                title: 'Condicional simple (Wunsch, höfliche Bitte)',
                text: 'Für höfliche Bitten, Wünsche, Ratschläge und mögliche (nicht sichere) Handlungen. Der Stamm ist wie beim Futur, dazu kommen die Endungen von haber im Imperfecto.',
                rule: 'Infinitiv + -ía, -ías, -ía, -íamos, -íais, -ían',
                example: '¿Podrías ayudarme? Me gustaría un café. – Könntest du mir helfen? Ich hätte gern einen Kaffee.'
            },
            'Gemischt': {
                title: 'Indefinido und Imperfecto gemischt',
                text: 'Das Imperfecto beschreibt den Hintergrund oder eine laufende Handlung, das Indefinido die neue, abgeschlossene Handlung, die dazwischenkommt.',
                rule: 'Hintergrund: Imperfecto – Ereignis: Indefinido',
                example: 'Mientras leía, sonó el teléfono. – Während ich las, klingelte das Telefon.'
            },
            'Ser y Estar': {
                title: 'Ser und estar',
                text: '„Ser“ für Identität, Herkunft, Beruf, Eigenschaften und Zeit; „estar“ für Ort, Zustände, Befinden und die Verlaufsform (estar + Gerundio).',
                rule: 'ser: soy, eres, es, somos, sois, son – estar: estoy, estás, está, estamos, estáis, están',
                example: 'Soy alemán, pero estoy en Madrid. – Ich bin Deutscher, aber ich bin in Madrid.'
            },
            'Por y Para': {
                title: 'Por und para',
                text: '„Para“ nennt Ziel, Zweck, Empfänger und Frist; „por“ nennt Grund, Ursache, Weg, Dauer und Tausch.',
                rule: 'para + Ziel/Zweck/Frist – por + Grund/Weg/Dauer/Preis',
                example: 'Este regalo es para ti. Gracias por tu ayuda. – Dieses Geschenk ist für dich. Danke für deine Hilfe.'
            }
        }
    };

    // Welche Zeitform der Tabelle zur Kategorie passt (wird im Dialog zuerst gezeigt)
    const CATEGORY_TENSE = {
        it: { 'Presente': 'presente', 'Passato Prossimo': 'passato', 'Imperfetto': 'imperfetto', 'Gerundio': 'gerundio',
            'Gemischt': 'passato', 'Imperativo': 'imperativo', 'Congiuntivo': 'congiuntivo', 'Futuro Semplice': 'futuro', 'Condizionale': 'condizionale' },
        en: { 'Simple Present': 'present', 'Present Continuous': 'continuous', 'Simple Past': 'past', 'Present Perfect': 'perfect',
            'Imperativ': 'present', 'Conditional': 'conditional', 'Future': 'future', 'Subjunctive': 'past' },
        es: { 'Presente': 'presente', 'Pretérito Perfecto': 'perfecto', 'Pretérito Indefinido': 'indefinido', 'Pretérito Imperfecto': 'imperfecto',
            'Gerundio': 'gerundio', 'Imperativo': 'imperativo', 'Subjuntivo': 'subjuntivo', 'Futuro': 'futuro', 'Condicional': 'condicional', 'Gemischt': 'indefinido' }
    };

    // Kategorienamen aus Excel-Listen können abweichen (z. B. „Perfecto“, „Indefinido“, „Pretérito perfecto compuesto“): auf unsere Namen abbilden
    const ES_CATEGORY_ALIASES = {
        'presente': 'Presente', 'presente de indicativo': 'Presente',
        'perfecto': 'Pretérito Perfecto', 'preterito perfecto': 'Pretérito Perfecto', 'preterito perfecto compuesto': 'Pretérito Perfecto', 'pretérito perfecto': 'Pretérito Perfecto',
        'indefinido': 'Pretérito Indefinido', 'preterito indefinido': 'Pretérito Indefinido', 'preterito perfecto simple': 'Pretérito Indefinido', 'pasado simple': 'Pretérito Indefinido',
        'imperfecto': 'Pretérito Imperfecto', 'preterito imperfecto': 'Pretérito Imperfecto',
        'gerundio': 'Gerundio', 'imperativo': 'Imperativo', 'subjuntivo': 'Subjuntivo', 'subjuntivo presente': 'Subjuntivo',
        'futuro': 'Futuro', 'futuro simple': 'Futuro', 'condicional': 'Condicional', 'condicional simple': 'Condicional',
        'gemischt': 'Gemischt', 'ser y estar': 'Ser y Estar', 'por y para': 'Por y Para'
    };
    const stripAccents = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    function canonicalCategory(category, lang) {
        const c = String(category || '').trim();
        if (lang !== 'es') return c;
        const key = c.toLowerCase();
        return ES_CATEGORY_ALIASES[key] || ES_CATEGORY_ALIASES[stripAccents(key)] || c;
    }

    function splitCategories(category) {
        return String(category || '').split('+').map(c => c.trim()).filter(Boolean);
    }

    function getExplanations(category, lang) {
        const table = EXPLANATIONS[lang] || {};
        return splitCategories(category).map(c => table[canonicalCategory(c, lang)]).filter(Boolean);
    }

    function preferredTense(category, lang) {
        const map = CATEGORY_TENSE[lang] || {};
        for (const c of splitCategories(category)) { const name = canonicalCategory(c, lang); if (map[name]) return map[name]; }
        return null;
    }

    // ---------------------------------------------------------------------------------------
    // Italienisch
    // ---------------------------------------------------------------------------------------
    const IT_PERSONS = ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'];
    const IT_REFL = ['mi', 'ti', 'si', 'ci', 'vi', 'si'];
    const AVERE_PRES = ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'];
    const ESSERE_PRES = ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'];

    const sp = s => s.split(' ');

    // Unregelmäßige Verben: pres (6 Formen), fut (Futurstamm), cong (6, sonst aus io-Form), imp (tu-Form),
    // impf (Imperfettostamm ohne -vo), ger (Gerundio), part (Partizip), aux
    const IT_IRREGULAR = {
        essere: { pres: sp('sono sei è siamo siete sono'), impfForms: sp('ero eri era eravamo eravate erano'), fut: 'sar', cong: sp('sia sia sia siamo siate siano'), imp: 'sii', impLei: 'sia', impVoi: 'siate', ger: 'essendo', part: 'stato', aux: 'essere' },
        avere: { pres: AVERE_PRES, fut: 'avr', cong: sp('abbia abbia abbia abbiamo abbiate abbiano'), imp: 'abbi', impVoi: 'abbiate', part: 'avuto' },
        andare: { pres: sp('vado vai va andiamo andate vanno'), fut: 'andr', imp: "va' / vai", part: 'andato', aux: 'essere' },
        fare: { pres: sp('faccio fai fa facciamo fate fanno'), impf: 'face', fut: 'far', imp: "fa' / fai", ger: 'facendo', part: 'fatto' },
        dare: { pres: sp('do dai dà diamo date danno'), fut: 'dar', cong: sp('dia dia dia diamo diate diano'), imp: "da' / dai", part: 'dato' },
        stare: { pres: sp('sto stai sta stiamo state stanno'), fut: 'star', cong: sp('stia stia stia stiamo stiate stiano'), imp: "sta' / stai", part: 'stato', aux: 'essere' },
        dire: { pres: sp('dico dici dice diciamo dite dicono'), impf: 'dice', fut: 'dir', imp: "di'", ger: 'dicendo', part: 'detto' },
        bere: { pres: sp('bevo bevi beve beviamo bevete bevono'), impf: 'beve', fut: 'berr', ger: 'bevendo', part: 'bevuto' },
        venire: { pres: sp('vengo vieni viene veniamo venite vengono'), fut: 'verr', imp: 'vieni', part: 'venuto', aux: 'essere' },
        tenere: { pres: sp('tengo tieni tiene teniamo tenete tengono'), fut: 'terr', imp: 'tieni', part: 'tenuto' },
        potere: { pres: sp('posso puoi può possiamo potete possono'), fut: 'potr', imp: null, part: 'potuto' },
        volere: { pres: sp('voglio vuoi vuole vogliamo volete vogliono'), fut: 'vorr', imp: null, part: 'voluto' },
        dovere: { pres: sp('devo devi deve dobbiamo dovete devono'), fut: 'dovr', cong: sp('debba debba debba dobbiamo dobbiate debbano'), imp: null, part: 'dovuto' },
        sapere: { pres: sp('so sai sa sappiamo sapete sanno'), fut: 'sapr', cong: sp('sappia sappia sappia sappiamo sappiate sappiano'), imp: 'sappi', impVoi: 'sappiate', part: 'saputo' },
        uscire: { pres: sp('esco esci esce usciamo uscite escono'), part: 'uscito', aux: 'essere' },
        rimanere: { pres: sp('rimango rimani rimane rimaniamo rimanete rimangono'), fut: 'rimarr', part: 'rimasto', aux: 'essere' },
        scegliere: { pres: sp('scelgo scegli sceglie scegliamo scegliete scelgono'), part: 'scelto' },
        togliere: { pres: sp('tolgo togli toglie togliamo togliete tolgono'), part: 'tolto' },
        cogliere: { pres: sp('colgo cogli coglie cogliamo cogliete colgono'), part: 'colto' },
        salire: { pres: sp('salgo sali sale saliamo salite salgono'), part: 'salito', aux: 'essere' },
        piacere: { pres: sp('piaccio piaci piace piacciamo piacete piacciono'), part: 'piaciuto', aux: 'essere' },
        tacere: { pres: sp('taccio taci tace tacciamo tacete tacciono'), part: 'taciuto' },
        sedere: { pres: sp('siedo siedi siede sediamo sedete siedono'), imp: 'siedi', part: 'seduto' },
        morire: { pres: sp('muoio muori muore moriamo morite muoiono'), imp: 'muori', part: 'morto', aux: 'essere' },
        spegnere: { pres: sp('spengo spegni spegne spegniamo spegnete spengono'), part: 'spento' },
        vedere: { fut: 'vedr', part: 'visto' },
        vivere: { fut: 'vivr', part: 'vissuto' },
        cadere: { fut: 'cadr', part: 'caduto', aux: 'essere' },
        parere: { pres: sp('paio pari pare paiamo parete paiono'), fut: 'parr', part: 'parso', aux: 'essere' },
        apparire: { pres: sp('appaio appari appare appariamo apparite appaiono'), part: 'apparso', aux: 'essere' },
        porre: { pres: sp('pongo poni pone poniamo ponete pongono'), impf: 'pone', fut: 'porr', ger: 'ponendo', part: 'posto' },
        trarre: { pres: sp('traggo trai trae traiamo traete traggono'), impf: 'trae', fut: 'trarr', ger: 'traendo', part: 'tratto' },
        durre: { pres: sp('duco duci duce duciamo ducete ducono'), impf: 'duce', fut: 'durr', ger: 'ducendo', part: 'dotto' }
    };

    // Unregelmäßige Verben, die auch mit Vorsilbe vorkommen (mantenere, divenire, riuscire, proporre, tradurre …)
    const IT_PREFIXABLE = ['tenere', 'venire', 'uscire', 'porre', 'trarre', 'durre', 'togliere', 'cogliere', 'scegliere', 'fare', 'dire'];
    // Diese Verben enden zwar auf ein Muster, sind aber regelmäßig
    const IT_NOT_PREFIXED = new Set(['affare', 'sfare', 'ardire', 'gradire', 'tradire', 'ubbidire', 'obbedire', 'spedire', 'impedire', 'condire', 'aderire', 'ferire']);

    // Unregelmäßige Partizipien (auch mit Vorsilbe: riprendere → ripreso)
    const IT_PARTICIPLES = {
        prendere: 'preso', mettere: 'messo', leggere: 'letto', scrivere: 'scritto', vedere: 'visto', chiedere: 'chiesto',
        rispondere: 'risposto', chiudere: 'chiuso', decidere: 'deciso', perdere: 'perso', correre: 'corso', scendere: 'sceso',
        spendere: 'speso', accendere: 'acceso', rompere: 'rotto', vincere: 'vinto', vivere: 'vissuto', nascere: 'nato',
        aprire: 'aperto', offrire: 'offerto', coprire: 'coperto', soffrire: 'sofferto', ridere: 'riso', piangere: 'pianto',
        dipingere: 'dipinto', muovere: 'mosso', discutere: 'discusso', succedere: 'successo', conoscere: 'conosciuto',
        crescere: 'cresciuto', giungere: 'giunto', nascondere: 'nascosto', uccidere: 'ucciso', dividere: 'diviso',
        distruggere: 'distrutto', rendere: 'reso', difendere: 'difeso', attendere: 'atteso', appendere: 'appeso',
        esprimere: 'espresso', spingere: 'spinto', fingere: 'finto', stringere: 'stretto', correggere: 'corretto',
        proteggere: 'protetto', dirigere: 'diretto', valere: 'valso', accorgere: 'accorto', sorgere: 'sorto',
        rodere: 'roso', cuocere: 'cotto', torcere: 'torto', volgere: 'volto', fondere: 'fuso', chiudersi: 'chiuso',
        mordere: 'morso', radere: 'raso', emergere: 'emerso', immergere: 'immerso', redigere: 'redatto', assumere: 'assunto',
        concedere: 'concesso', scuotere: 'scosso', percuotere: 'percosso', comparire: 'comparso', esistere: 'esistito',
        sospendere: 'sospeso', ammettere: 'ammesso'
    };

    const IT_ESSERE = new Set(['andare', 'venire', 'arrivare', 'partire', 'entrare', 'uscire', 'tornare', 'ritornare', 'restare',
        'rimanere', 'stare', 'essere', 'nascere', 'morire', 'salire', 'scendere', 'cadere', 'diventare', 'divenire', 'durare',
        'sembrare', 'piacere', 'dispiacere', 'succedere', 'accadere', 'capitare', 'costare', 'bastare', 'mancare', 'riuscire',
        'apparire', 'sparire', 'scomparire', 'scappare', 'crescere', 'invecchiare', 'dimagrire', 'ingrassare', 'guarire',
        'fuggire', 'emigrare', 'giungere', 'avvenire', 'esistere', 'dipendere', 'piovere', 'nevicare', 'parere', 'servire',
        'affogare', 'annegare', 'evadere', 'impazzire', 'arrossire', 'svenire', 'sorgere', 'tramontare', 'risultare', 'occorrere']);

    const IT_ISC = new Set(['capire', 'finire', 'preferire', 'pulire', 'spedire', 'costruire', 'colpire', 'suggerire', 'gestire',
        'sparire', 'unire', 'chiarire', 'favorire', 'fornire', 'garantire', 'impedire', 'inserire', 'punire', 'restituire',
        'riferire', 'sostituire', 'stabilire', 'tradire', 'trasferire', 'ubbidire', 'obbedire', 'guarire', 'dimagrire',
        'arrossire', 'definire', 'distribuire', 'contribuire', 'attribuire', 'agire', 'reagire', 'ferire', 'abolire',
        'approfondire', 'condire', 'demolire', 'esaurire', 'fallire', 'impazzire', 'influire', 'istruire', 'percepire',
        'proibire', 'rapire', 'riunire', 'scolpire', 'smarrire', 'svanire', 'digerire', 'aderire', 'intuire', 'diminuire',
        'arricchire', 'impallidire', 'gradire', 'costruire', 'ingrandire', 'stupire', 'zittire', 'sbalordire', 'tossire',
        'starnutire', 'concepire', 'differire', 'eseguire', 'patire', 'reagire', 'sgranchire', 'colorire', 'ammonire',
        'abbellire', 'aggredire', 'alleggerire', 'ammorbidire', 'appassire', 'arrostire', 'atterrire', 'avvilire', 'bandire',
        'custodire', 'deperire', 'esibire', 'fiorire', 'impartire', 'incuriosire', 'indebolire', 'inghiottire', 'inibire',
        'intimidire', 'istituire', 'mollire', 'nutrire', 'partorire', 'prestabilire', 'rifinire', 'ripulire', 'risarcire',
        'sfinire', 'spartire', 'subire', 'tramortire', 'trasalire', 'usufruire', 'abbrustolire', 'assorbire', 'accudire']);

    function findIrregular(inf) {
        if (IT_IRREGULAR[inf]) return { prefix: '', base: inf, data: IT_IRREGULAR[inf] };
        if (IT_NOT_PREFIXED.has(inf)) return null;
        for (const base of IT_PREFIXABLE) {
            if (inf.length > base.length && inf.endsWith(base)) return { prefix: inf.slice(0, -base.length), base, data: IT_IRREGULAR[base] };
        }
        // tradurre, produrre, condurre … (Endung -durre)
        if (inf.endsWith('durre')) return { prefix: inf.slice(0, -5), base: 'durre', data: IT_IRREGULAR.durre };
        return null;
    }

    function irregularParticiple(inf) {
        if (IT_PARTICIPLES[inf]) return IT_PARTICIPLES[inf];
        for (const [base, part] of Object.entries(IT_PARTICIPLES)) {
            if (base.length >= 6 && inf.length > base.length && inf.endsWith(base)) return inf.slice(0, -base.length) + part;
        }
        return null;
    }

    // Normalisiert Eingaben wie "lavarsi", "Mangiare" oder "porsi"
    function parseItalianInfinitive(word) {
        let inf = String(word || '').toLowerCase().trim();
        let reflexive = false;
        if (/rsi$/.test(inf)) {
            reflexive = true;
            inf = inf.slice(0, -3) + 're'; // lavarsi → lavare
            if (/(po|tra|du)re$/.test(inf)) inf = inf.slice(0, -2) + 'rre'; // porsi → porre, tradursi → tradurre
        }
        if (!/(are|ere|ire|rre)$/.test(inf)) return null;
        return { inf, reflexive };
    }

    // Von der KI geprüfte Formen (vom Server geladen); ersetzen die Regelrechnung, solange vorhanden
    const verified = { it: {}, en: {}, es: {} };
    const isForm6 = (a) => Array.isArray(a) && a.length === 6 && a.every(x => typeof x === 'string' && x);

    function conjugateItalian(word, options) {
        const parsed = parseItalianInfinitive(word);
        if (!parsed) return null;
        const { inf, reflexive } = parsed;
        const irr = findIrregular(inf);
        const d = irr ? irr.data : {};
        const px = irr ? irr.prefix : '';
        const pre = arr => arr.map(f => px + f);

        const ending = inf.endsWith('rre') ? 'rre' : inf.slice(-3);
        const stem = inf.slice(0, -3);
        const isc = ending === 'ire' && IT_ISC.has(inf);

        // --- Presente ---
        let pres;
        if (d.pres) {
            pres = pre(d.pres);
        } else if (ending === 'are') {
            const tu = stem.endsWith('i') ? stem : (/[cg]$/.test(stem) ? stem + 'hi' : stem + 'i');
            const noi = stem.endsWith('i') ? stem + 'amo' : (/[cg]$/.test(stem) ? stem + 'hiamo' : stem + 'iamo');
            pres = [stem + 'o', tu, stem + 'a', noi, stem + 'ate', stem + 'ano'];
        } else if (ending === 'ere') {
            pres = [stem + 'o', stem + 'i', stem + 'e', stem + 'iamo', stem + 'ete', stem + 'ono'];
        } else if (isc) {
            pres = [stem + 'isco', stem + 'isci', stem + 'isce', stem + 'iamo', stem + 'ite', stem + 'iscono'];
        } else {
            pres = [stem + 'o', stem + 'i', stem + 'e', stem + 'iamo', stem + 'ite', stem + 'ono'];
        }

        // --- Imperfetto ---
        let impf;
        if (d.impfForms) impf = pre(d.impfForms);
        else {
            const s = d.impf ? px + d.impf : stem + { are: 'a', ere: 'e', ire: 'i' }[ending];
            impf = ['vo', 'vi', 'va', 'vamo', 'vate', 'vano'].map(e => s + e);
        }

        // --- Futuro / Condizionale ---
        let futStem;
        if (d.fut) futStem = px + d.fut;
        else if (ending === 'are') {
            futStem = /[cg]i$/.test(stem) ? stem.slice(0, -1) + 'er' : (/[cg]$/.test(stem) ? stem + 'her' : stem + 'er');
        } else futStem = stem + (ending === 'ire' ? 'ir' : 'er');
        let fut = ['ò', 'ai', 'à', 'emo', 'ete', 'anno'].map(e => futStem + e);
        let cond = ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero'].map(e => futStem + e);

        // --- Congiuntivo presente ---
        let cong;
        if (d.cong) cong = pre(d.cong);
        else {
            const noi = pres[3];
            const voi = noi.replace(/amo$/, 'ate');
            let sing, loro;
            if (ending === 'are' && !d.pres) {
                sing = stem.endsWith('i') ? stem : (/[cg]$/.test(stem) ? stem + 'hi' : stem + 'i');
                loro = stem.endsWith('i') ? stem.slice(0, -1) + 'ino' : (/[cg]$/.test(stem) ? stem + 'hino' : stem + 'ino');
            } else {
                // aus der io-Form: vado → vada, vengo → venga, finisco → finisca
                const io = pres[0];
                sing = io.replace(/o$/, 'a');
                loro = sing + 'no';
            }
            cong = [sing, sing, sing, noi, voi, loro];
        }

        // --- Imperativo ---
        let impTu;
        if (d.imp !== undefined) impTu = d.imp === null ? null : px + d.imp;
        else impTu = ending === 'are' ? stem + 'a' : pres[1];
        let imperativo = d.imp === null && !d.impLei ? null : {
            tu: impTu,
            Lei: d.impLei ? px + d.impLei : cong[0],
            noi: pres[3],
            voi: d.impVoi ? px + d.impVoi : pres[4]
        };

        // --- Gerundio / Partizip / Hilfsverb ---
        let gerundio = d.ger ? px + d.ger : stem + (ending === 'are' ? 'ando' : 'endo');
        let part = d.part ? px + d.part : (irregularParticiple(inf) || stem + { are: 'ato', ere: 'uto', ire: 'ito' }[ending]);
        let aux = reflexive || d.aux === 'essere' || IT_ESSERE.has(inf) || (irr && IT_ESSERE.has(irr.base)) ? 'essere' : 'avere';

        // Geprüfte Formen der KI haben Vorrang vor den Regeln (reflexive Verben bekommen die Pronomen wie gewohnt dazu)
        const ver = options && options.ignoreVerified ? null : verified.it[inf];
        if (ver) {
            if (isForm6(ver.presente)) pres = ver.presente;
            if (isForm6(ver.imperfetto)) impf = ver.imperfetto;
            if (isForm6(ver.futuro)) fut = ver.futuro;
            if (isForm6(ver.condizionale)) cond = ver.condizionale;
            if (isForm6(ver.congiuntivo)) cong = ver.congiuntivo;
            if (ver.imperativo && ver.imperativo.tu && ver.imperativo.Lei && ver.imperativo.noi && ver.imperativo.voi) imperativo = { tu: ver.imperativo.tu, Lei: ver.imperativo.Lei, noi: ver.imperativo.noi, voi: ver.imperativo.voi };
            if (ver.gerundio) gerundio = ver.gerundio;
            if (ver.participio) part = ver.participio;
            if (ver.aux === 'avere' || ver.aux === 'essere') aux = reflexive ? 'essere' : ver.aux;
        }
        const partForms = aux === 'essere'
            ? [part.slice(0, -1) + 'o/a', part.slice(0, -1) + 'i/e']
            : [part, part];
        const passato = (aux === 'essere' ? ESSERE_PRES : AVERE_PRES).map((a, i) => `${a} ${i < 3 ? partForms[0] : partForms[1]}`);

        // Reflexive Verben: Pronomen vor die konjugierten Formen
        const refl = arr => reflexive ? arr.map((f, i) => `${IT_REFL[i]} ${f}`) : arr;
        let imperativoRefl = imperativo;
        if (reflexive && imperativo) {
            const attach = (form, pron) => form ? form.split(' / ')[0].replace(/'$/, '') + pron : null;
            imperativoRefl = { tu: attach(imperativo.tu, 'ti'), Lei: `si ${imperativo.Lei}`, noi: attach(imperativo.noi, 'ci'), voi: attach(imperativo.voi, 'vi') };
        }

        const display = !reflexive ? inf : (inf.endsWith('rre') ? inf.slice(0, -2) + 'si' : inf.slice(0, -1) + 'si');
        return {
            lang: 'it',
            infinitive: display,
            persons: IT_PERSONS,
            irregular: !!irr || !!irregularParticiple(inf),
            verified: !!ver,
            aux,
            gerundio: reflexive ? gerundio + 'si' : gerundio,
            participio: part,
            tenses: [
                { id: 'presente', name: 'Presente', forms: refl(pres) },
                { id: 'passato', name: 'Passato prossimo', forms: refl(passato) },
                { id: 'imperfetto', name: 'Imperfetto', forms: refl(impf) },
                { id: 'futuro', name: 'Futuro semplice', forms: refl(fut) },
                { id: 'condizionale', name: 'Condizionale', forms: refl(cond) },
                { id: 'congiuntivo', name: 'Congiuntivo presente', forms: refl(cong).map(f => `che ${f}`) },
                { id: 'gerundio', name: 'Gerundio (stare + …)', forms: ['sto', 'stai', 'sta', 'stiamo', 'state', 'stanno'].map((s, i) => `${reflexive ? IT_REFL[i] + ' ' : ''}${s} ${gerundio}`) },
                imperativoRefl ? { id: 'imperativo', name: 'Imperativo', forms: [null, imperativoRefl.tu, imperativoRefl.Lei, imperativoRefl.noi, imperativoRefl.voi, null], personsOverride: ['', 'tu', 'Lei', 'noi', 'voi', ''] } : null
            ].filter(Boolean)
        };
    }

    // ---------------------------------------------------------------------------------------
    // Englisch
    // ---------------------------------------------------------------------------------------
    const EN_PERSONS = ['I', 'you', 'he/she/it', 'we', 'you', 'they'];
    const EN_MODALS = new Set(['can', 'could', 'must', 'should', 'may', 'might', 'will', 'would', 'shall', 'ought']);

    // Grundform: [Simple Past, Partizip]
    const EN_IRREGULAR = {
        be: ['was/were', 'been'], have: ['had', 'had'], do: ['did', 'done'], go: ['went', 'gone'], say: ['said', 'said'],
        get: ['got', 'got'], make: ['made', 'made'], know: ['knew', 'known'], think: ['thought', 'thought'], take: ['took', 'taken'],
        see: ['saw', 'seen'], come: ['came', 'come'], give: ['gave', 'given'], find: ['found', 'found'], tell: ['told', 'told'],
        become: ['became', 'become'], leave: ['left', 'left'], feel: ['felt', 'felt'], bring: ['brought', 'brought'],
        begin: ['began', 'begun'], keep: ['kept', 'kept'], hold: ['held', 'held'], write: ['wrote', 'written'],
        stand: ['stood', 'stood'], hear: ['heard', 'heard'], let: ['let', 'let'], mean: ['meant', 'meant'], set: ['set', 'set'],
        meet: ['met', 'met'], run: ['ran', 'run'], pay: ['paid', 'paid'], sit: ['sat', 'sat'], speak: ['spoke', 'spoken'],
        lie: ['lay', 'lain'], lead: ['led', 'led'], read: ['read', 'read'], grow: ['grew', 'grown'], lose: ['lost', 'lost'],
        fall: ['fell', 'fallen'], send: ['sent', 'sent'], build: ['built', 'built'], understand: ['understood', 'understood'],
        draw: ['drew', 'drawn'], break: ['broke', 'broken'], spend: ['spent', 'spent'], cut: ['cut', 'cut'], rise: ['rose', 'risen'],
        drive: ['drove', 'driven'], buy: ['bought', 'bought'], wear: ['wore', 'worn'], choose: ['chose', 'chosen'],
        seek: ['sought', 'sought'], throw: ['threw', 'thrown'], catch: ['caught', 'caught'], deal: ['dealt', 'dealt'],
        win: ['won', 'won'], forget: ['forgot', 'forgotten'], sell: ['sold', 'sold'], fight: ['fought', 'fought'],
        teach: ['taught', 'taught'], eat: ['ate', 'eaten'], sing: ['sang', 'sung'], drink: ['drank', 'drunk'],
        swim: ['swam', 'swum'], fly: ['flew', 'flown'], sleep: ['slept', 'slept'], hit: ['hit', 'hit'], put: ['put', 'put'],
        shut: ['shut', 'shut'], hurt: ['hurt', 'hurt'], cost: ['cost', 'cost'], quit: ['quit', 'quit'], ride: ['rode', 'ridden'],
        ring: ['rang', 'rung'], shake: ['shook', 'shaken'], steal: ['stole', 'stolen'], wake: ['woke', 'woken'],
        freeze: ['froze', 'frozen'], hide: ['hid', 'hidden'], bite: ['bit', 'bitten'], blow: ['blew', 'blown'],
        feed: ['fed', 'fed'], forgive: ['forgave', 'forgiven'], hang: ['hung', 'hung'], light: ['lit', 'lit'],
        lend: ['lent', 'lent'], shoot: ['shot', 'shot'], show: ['showed', 'shown'], shine: ['shone', 'shone'],
        sink: ['sank', 'sunk'], slide: ['slid', 'slid'], stick: ['stuck', 'stuck'], sting: ['stung', 'stung'],
        strike: ['struck', 'struck'], swear: ['swore', 'sworn'], sweep: ['swept', 'swept'], swing: ['swung', 'swung'],
        tear: ['tore', 'torn'], bend: ['bent', 'bent'], bet: ['bet', 'bet'], bind: ['bound', 'bound'], bleed: ['bled', 'bled'],
        breed: ['bred', 'bred'], dig: ['dug', 'dug'], forbid: ['forbade', 'forbidden'], grind: ['ground', 'ground'],
        kneel: ['knelt', 'knelt'], lay: ['laid', 'laid'], leap: ['leapt', 'leapt'], mistake: ['mistook', 'mistaken'],
        overcome: ['overcame', 'overcome'], prove: ['proved', 'proven'], shrink: ['shrank', 'shrunk'],
        spin: ['spun', 'spun'], split: ['split', 'split'], spread: ['spread', 'spread'], spring: ['sprang', 'sprung'],
        stink: ['stank', 'stunk'], undertake: ['undertook', 'undertaken'], upset: ['upset', 'upset'], weep: ['wept', 'wept'],
        wind: ['wound', 'wound'], withdraw: ['withdrew', 'withdrawn'], arise: ['arose', 'arisen'], awake: ['awoke', 'awoken'],
        bear: ['bore', 'born'], beat: ['beat', 'beaten'], burn: ['burnt/burned', 'burnt/burned'], dream: ['dreamt/dreamed', 'dreamt/dreamed'],
        learn: ['learnt/learned', 'learnt/learned'], smell: ['smelt/smelled', 'smelt/smelled'], spell: ['spelt/spelled', 'spelt/spelled'],
        flee: ['fled', 'fled'], foresee: ['foresaw', 'foreseen'], fit: ['fit/fitted', 'fit/fitted']
    };
    const EN_DOUBLE = new Set(['prefer', 'admit', 'occur', 'refer', 'permit', 'regret', 'commit', 'control', 'travel', 'transfer', 'equip', 'submit', 'omit', 'patrol', 'propel', 'compel', 'expel', 'rebel', 'deter', 'incur', 'recur', 'confer', 'infer']);

    function enThirdPerson(v) {
        if (v === 'have') return 'has';
        if (v === 'be') return 'is';
        if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';
        if (/(s|sh|ch|x|z|o)$/.test(v)) return v + 'es';
        return v + 's';
    }
    function shouldDouble(v) {
        if (EN_DOUBLE.has(v)) return true;
        // einsilbig, Konsonant-Vokal-Konsonant am Ende (stop, plan, run), nicht w/x/y
        return /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v);
    }
    function enIng(v) {
        if (v === 'be') return 'being';
        if (v.endsWith('ie')) return v.slice(0, -2) + 'ying';
        if (/[^aeiou]e$/.test(v) && v !== 'be') return v.slice(0, -1) + 'ing';
        if (/ee$/.test(v)) return v + 'ing';
        if (shouldDouble(v)) return v + v.slice(-1) + 'ing';
        return v + 'ing';
    }
    function enPastRegular(v) {
        if (v.endsWith('e')) return v + 'd';
        if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied';
        if (shouldDouble(v)) return v + v.slice(-1) + 'ed';
        return v + 'ed';
    }

    function conjugateEnglish(word, options) {
        let v = String(word || '').toLowerCase().trim().replace(/^to\s+/, '');
        if (!/^[a-z]+(-[a-z]+)?$/.test(v)) return null;
        if (EN_MODALS.has(v)) {
            return { lang: 'en', infinitive: v, modal: true, persons: EN_PERSONS, tenses: [] };
        }
        const irr = EN_IRREGULAR[v];
        const ver = options && options.ignoreVerified || v === 'be' ? null : verified.en[v]; // "be" bleibt bei der Sonderbehandlung
        const past = ver && ver.past ? ver.past : (irr ? irr[0] : enPastRegular(v));
        const part = ver && ver.participio ? ver.participio : (irr ? irr[1] : enPastRegular(v));
        const ing = ver && ver.gerundio ? ver.gerundio : enIng(v);
        const third = ver && ver.thirdPerson ? ver.thirdPerson : enThirdPerson(v);

        const present = v === 'be' ? ['am', 'are', 'is', 'are', 'are', 'are'] : [v, v, third, v, v, v];
        const pastForms = v === 'be' ? ['was', 'were', 'was', 'were', 'were', 'were'] : Array(6).fill(past);
        const beNow = ['am', 'are', 'is', 'are', 'are', 'are'];
        const haveNow = ['have', 'have', 'has', 'have', 'have', 'have'];
        const withPron = forms => forms.map((f, i) => `${EN_PERSONS[i]} ${f}`);

        return {
            lang: 'en',
            infinitive: v,
            persons: EN_PERSONS,
            irregular: !!irr,
            verified: !!ver,
            participio: part,
            gerundio: ing,
            pastSimple: past,
            tenses: [
                { id: 'present', name: 'Simple Present', forms: withPron(present) },
                { id: 'continuous', name: 'Present Continuous', forms: withPron(beNow.map(b => `${b} ${ing}`)) },
                { id: 'past', name: 'Simple Past', forms: withPron(pastForms) },
                { id: 'perfect', name: 'Present Perfect', forms: withPron(haveNow.map(h => `${h} ${part}`)) },
                { id: 'future', name: 'Future (will / going to)', forms: withPron(Array(6).fill(`will ${v}`)), extra: `oder: am/is/are going to ${v}` },
                { id: 'conditional', name: 'Conditional (would)', forms: withPron(Array(6).fill(`would ${v}`)) }
            ],
            noPersonColumn: true
        };
    }

    // ---------------------------------------------------------------------------------------
    // Spanisch (Spanien, Anrede „vosotros“)
    // ---------------------------------------------------------------------------------------
    const ES_PERSONS = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ustedes'];
    const ES_REFL = ['me', 'te', 'se', 'nos', 'os', 'se'];
    const HABER_PRES = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];
    const ESTAR_PRES = ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'];

    // Stammwechsel: ie (e>ie), ue (o>ue), jue (u>ue), ie-i / ue-u (-ir: im Indefinido, Gerundio und bei nosotros/vosotros im Subjuntivo i bzw. u),
    // i (e>i), adq (i>ie)
    const ES_STEM_TYPES = {
        ie: 'pensar empezar comenzar cerrar despertar sentar recomendar negar nevar acertar apretar atravesar calentar confesar regar temblar tropezar merendar gobernar manifestar fregar plegar segar cegar quebrar helar arrendar enterrar encerrar sembrar remendar sosegar descender ascender atender desatender entender perder querer defender encender tender extender pretender contender verter discernir cernir',
        ue: 'contar encontrar recordar costar mostrar demostrar probar soñar volar almorzar acostar colgar rogar sonar aprobar comprobar forzar esforzar poblar renovar tostar volcar apostar consolar rodar soltar trocar mover volver poder doler soler llover morder torcer resolver devolver envolver revolver absolver disolver conmover promover remover desenvolver',
        jue: 'jugar',
        'ie-i': 'sentir mentir preferir divertir sugerir convertir herir hervir advertir referir consentir invertir requerir arrepentir diferir transferir inferir conferir digerir ingerir pervertir presentir resentir desmentir disentir subvertir controvertir proferir',
        'ue-u': 'dormir morir adormir',
        i: 'pedir servir repetir seguir vestir elegir medir competir corregir despedir impedir rendir gemir derretir teñir reñir concebir ceñir colegir embestir expedir regir proseguir conseguir perseguir desvestir revestir investir reelegir estreñir desteñir constreñir henchir',
        adq: 'adquirir inquirir'
    };
    const ES_STEM = {};
    Object.keys(ES_STEM_TYPES).forEach(type => ES_STEM_TYPES[type].split(' ').forEach(v => { ES_STEM[v] = type; }));
    // Vorsilben, mit denen die häufigsten Verben des Stammwechsels vorkommen (rehacer, mantener, …)
    const ES_PREFIXES = new Set(['a', 'ab', 'abs', 'ante', 'com', 'con', 'contra', 'de', 'des', 'dis', 'en', 'entre', 'ex', 'im', 'in', 'inter', 'man', 'ob', 'per', 'pos', 'pre', 'pro', 're', 'sobre', 'sos', 'su', 'sub', 'subs', 'sus', 'trans', 'tras', 'super', 'equi', 'yuxta', 'o', 'descom', 'predis', 'indis', 'presu', 'rea']);
    const ES_STEM_PREFIXABLE = ['tender', 'sentir', 'mentir', 'pedir', 'seguir', 'servir', 'vestir', 'mover', 'volver', 'contar', 'mostrar', 'probar', 'pensar', 'cerrar', 'sonar', 'costar'];

    const ES_IAR_ACCENT = new Set('enviar guiar variar esquiar confiar fiar criar ampliar vaciar enfriar resfriar liar desafiar fotografiar contrariar espiar expiar rociar ansiar chirriar aliar desvariar telegrafiar cariar agriar arriar averiar extraviar inventariar porfiar amnistiar autografiar biografiar historiar radiografiar'.split(' '));
    const ES_UAR_ACCENT = new Set('actuar continuar graduar evaluar efectuar situar valuar insinuar acentuar habituar puntuar perpetuar extenuar atenuar devaluar fluctuar exceptuar conceptuar individuar redituar tatuar'.split(' '));
    // cocer/mecer: nur z (cuezo, mezo), nicht zc
    const ES_Z_ONLY = new Set(['cocer', 'recocer', 'escocer', 'mecer', 'remecer']);

    const sp6 = s => s.split(' ');

    // Unregelmäßige Verben. Felder: pres (6 Formen), yo (nur 1. Person; Subjuntivo geht von diesem Stamm aus), stemchg, ind (6) oder
    // indStem (+ indJ: Endung -eron), impf (6), fut (Stamm), subj (6), impTu, impNos, ger, part, noImp
    const ES_IRREGULAR = {
        ser: { pres: sp6('soy eres es somos sois son'), ind: sp6('fui fuiste fue fuimos fuisteis fueron'), impf: sp6('era eras era éramos erais eran'), fut: 'ser', subj: sp6('sea seas sea seamos seáis sean'), impTu: 'sé', ger: 'siendo', part: 'sido' },
        estar: { pres: sp6('estoy estás está estamos estáis están'), indStem: 'estuv', subj: sp6('esté estés esté estemos estéis estén'), impTu: 'está' },
        ir: { pres: sp6('voy vas va vamos vais van'), ind: sp6('fui fuiste fue fuimos fuisteis fueron'), impf: sp6('iba ibas iba íbamos ibais iban'), fut: 'ir', subj: sp6('vaya vayas vaya vayamos vayáis vayan'), impTu: 've', impNos: 'vamos', ger: 'yendo', part: 'ido' },
        haber: { pres: sp6('he has ha hemos habéis han'), indStem: 'hub', fut: 'habr', subj: sp6('haya hayas haya hayamos hayáis hayan'), noImp: true },
        dar: { pres: sp6('doy das da damos dais dan'), ind: sp6('di diste dio dimos disteis dieron'), subj: sp6('dé des dé demos deis den'), impTu: 'da' },
        ver: { pres: sp6('veo ves ve vemos veis ven'), ind: sp6('vi viste vio vimos visteis vieron'), impf: sp6('veía veías veía veíamos veíais veían'), subj: sp6('vea veas vea veamos veáis vean'), impTu: 've', ger: 'viendo', part: 'visto' },
        prever: { pres: sp6('preveo prevés prevé prevemos prevéis prevén'), ind: sp6('preví previste previó previmos previsteis previeron'), impf: sp6('preveía preveías preveía preveíamos preveíais preveían'), subj: sp6('prevea preveas prevea preveamos preveáis prevean'), impTu: 'prevé', ger: 'previendo', part: 'previsto' },
        saber: { pres: sp6('sé sabes sabe sabemos sabéis saben'), indStem: 'sup', fut: 'sabr', subj: sp6('sepa sepas sepa sepamos sepáis sepan') },
        caber: { yo: 'quepo', indStem: 'cup', fut: 'cabr' },
        poder: { stemchg: 'ue', indStem: 'pud', fut: 'podr', ger: 'pudiendo' },
        querer: { stemchg: 'ie', indStem: 'quis', fut: 'querr' },
        hacer: { yo: 'hago', ind: sp6('hice hiciste hizo hicimos hicisteis hicieron'), fut: 'har', impTu: 'haz', part: 'hecho' },
        decir: { pres: sp6('digo dices dice decimos decís dicen'), ind: sp6('dije dijiste dijo dijimos dijisteis dijeron'), fut: 'dir', subj: sp6('diga digas diga digamos digáis digan'), impTu: 'di', ger: 'diciendo', part: 'dicho' },
        poner: { yo: 'pongo', indStem: 'pus', fut: 'pondr', impTu: 'pon', impTuPx: 'pón', part: 'puesto' },
        tener: { yo: 'tengo', stemchg: 'ie', indStem: 'tuv', fut: 'tendr', impTu: 'ten', impTuPx: 'tén' },
        venir: { yo: 'vengo', stemchg: 'ie', ind: sp6('vine viniste vino vinimos vinisteis vinieron'), fut: 'vendr', impTu: 'ven', impTuPx: 'vén', ger: 'viniendo' },
        salir: { yo: 'salgo', fut: 'saldr', impTu: 'sal' },
        valer: { yo: 'valgo', fut: 'valdr' },
        traer: { yo: 'traigo', ind: sp6('traje trajiste trajo trajimos trajisteis trajeron') },
        caer: { yo: 'caigo' },
        oir: { yo: 'oigo', pres: sp6('oigo oyes oye oímos oís oyen') },
        reir: { pres: sp6('río ríes ríe reímos reís ríen'), ind: sp6('reí reíste rio reímos reísteis rieron'), ind3Px: 'rió', subj: sp6('ría rías ría riamos riáis rían'), ger: 'riendo', part: 'reído' },
        andar: { indStem: 'anduv' },
        errar: { pres: sp6('yerro yerras yerra erramos erráis yerran'), subj: sp6('yerre yerres yerre erremos erréis yerren') },
        oler: { pres: sp6('huelo hueles huele olemos oléis huelen'), subj: sp6('huela huelas huela olamos oláis huelan') }
    };
    // Verben, die ihre Formen von einem Grundverb mit Vorsilbe ableiten (mantener, componer, atraer, deshacer, sonreír …)
    const ES_PREFIXABLE = ['tener', 'venir', 'poner', 'hacer', 'decir', 'traer', 'caer', 'valer', 'salir', 'reir', 'oir'];
    const esPrefixed = (rec, px) => {
        const out = {};
        Object.keys(rec).forEach(k => {
            const v = rec[k];
            if (k === 'stemchg' || k === 'noImp') out[k] = v;
            else if (Array.isArray(v)) out[k] = v.map(x => px + x);
            else if (typeof v === 'string') out[k] = px + v;
            else out[k] = v;
        });
        return out;
    };
    // bendecir/maldecir: wie decir, aber regelmäßiges Futur, Partizip und Imperativ
    ES_IRREGULAR.bendecir = { ...esPrefixed(ES_IRREGULAR.decir, 'ben'), fut: 'bendecir', part: 'bendecido', impTu: 'bendice' };
    ES_IRREGULAR.maldecir = { ...esPrefixed(ES_IRREGULAR.decir, 'mal'), fut: 'maldecir', part: 'maldecido', impTu: 'maldice' };
    ES_IRREGULAR.freir = { ...esPrefixed(ES_IRREGULAR.reir, 'f'), part: 'frito' };
    // satisfacer: wie hacer mit f statt h
    ES_IRREGULAR.satisfacer = (() => {
        const rec = {};
        Object.keys(ES_IRREGULAR.hacer).forEach(k => {
            const v = ES_IRREGULAR.hacer[k];
            const f = s => 'satisf' + s.slice(1);
            rec[k] = Array.isArray(v) ? v.map(f) : (typeof v === 'string' && k !== 'stemchg' ? f(v) : v);
        });
        rec.impTu = 'satisface';
        return rec;
    })();
    ES_IRREGULAR.desandar = esPrefixed(ES_IRREGULAR.andar, 'des');
    ES_IRREGULAR.desoir = esPrefixed(ES_IRREGULAR.oir, 'des');

    // Unregelmäßige Partizipien nach Endung: [Endung, Ersatz]
    const ES_PART_SUFFIX = [['scribir', 'scrito'], ['cubrir', 'cubierto'], ['abrir', 'abierto'], ['volver', 'vuelto'], ['solver', 'suelto'],
        ['romper', 'roto'], ['morir', 'muerto'], ['imprimir', 'impreso'], ['proveer', 'provisto']];

    // Welche Vorsilben bei welchem Grundverb vorkommen (verhindert falsche Treffer wie „mandar“ bei andar)
    const ES_COMPOUND_OK = (base, px) => {
        if (base === 'oir') return ['des', 'entre'].includes(px);
        if (base === 'reir') return px === 'son';
        if (base === 'caer') return ['de', 're', 'des', 'sobre'].includes(px);
        if (base === 'valer') return ['equi', 'pre', 'sobre'].includes(px);
        if (base === 'salir') return px === 'sobre';
        return ES_PREFIXES.has(px);
    };

    function findSpanishIrregular(infN) {
        if (ES_IRREGULAR[infN]) return { prefix: '', data: ES_IRREGULAR[infN] };
        if (infN.endsWith('ducir') && infN.length > 5) return { prefix: '', data: { indStem: infN.slice(0, -3) + 'j', indJ: true } }; // conducir, traducir …
        for (const base of ES_PREFIXABLE) {
            if (infN.length > base.length && infN.endsWith(base)) {
                const px = infN.slice(0, -base.length);
                if (px.length <= 8 && ES_COMPOUND_OK(base, px)) {
                    const rec = esPrefixed(ES_IRREGULAR[base], px);
                    if (ES_IRREGULAR[base].impTuPx) rec.impTu = px + ES_IRREGULAR[base].impTuPx;
                    if (base === 'decir') delete rec.impTu; // predice, contradice (nur decir selbst hat di)
                    if (ES_IRREGULAR[base].ind3Px) rec.ind3Px = px + ES_IRREGULAR[base].ind3Px;
                    return { prefix: px, data: rec };
                }
            }
        }
        return null;
    }

    function esStemType(infN) {
        if (ES_STEM[infN]) return ES_STEM[infN];
        for (const base of ES_STEM_PREFIXABLE) {
            if (infN.length > base.length && infN.endsWith(base) && ES_PREFIXES.has(infN.slice(0, -base.length)) && ES_STEM[base]) return ES_STEM[base];
        }
        return null;
    }

    function esChangeStem(stem, type) {
        const rep = (ch, to) => { const i = stem.lastIndexOf(ch); return i < 0 ? stem : stem.slice(0, i) + to + stem.slice(i + 1); };
        switch (type) {
            case 'ie': case 'ie-i': return rep('e', 'ie');
            case 'ue': case 'ue-u': return rep('o', 'ue');
            case 'jue': return rep('u', 'ue');
            case 'i': return rep('e', 'i');
            case 'adq': return rep('i', 'ie');
            default: return stem;
        }
    }
    // Schwache Variante bei -ir-Verben (Indefinido 3. Person, Gerundio, Subjuntivo nosotros/vosotros)
    function esWeakStem(stem, type) {
        const rep = (ch, to) => { const i = stem.lastIndexOf(ch); return i < 0 ? stem : stem.slice(0, i) + to + stem.slice(i + 1); };
        if (type === 'ie-i' || type === 'i') return rep('e', 'i');
        if (type === 'ue-u') return rep('o', 'u');
        return stem;
    }

    // Rechtschreibregeln beim Anfügen der Endung (sacar → saqué, pagar → pagué, empezar → empecé, vencer → venzo,
    // conocer → conozca, escoger → escojo, seguir → sigo, averiguar → averigüé)
    function esFix(infN, stem, ending) {
        if (infN.endsWith('ar') && /^[eé]/.test(ending)) {
            if (/car$/.test(infN) && stem.endsWith('c')) return stem.slice(0, -1) + 'qu' + ending;
            if (/gar$/.test(infN) && stem.endsWith('g')) return stem + 'u' + ending;
            if (/zar$/.test(infN) && stem.endsWith('z')) return stem.slice(0, -1) + 'c' + ending;
            if (/guar$/.test(infN) && stem.endsWith('gu')) return stem.slice(0, -2) + 'gü' + ending;
        }
        if (!infN.endsWith('ar') && /^[oaá]/.test(ending)) {
            if (/c[ei]r$/.test(infN) && stem.endsWith('c')) {
                const prev = stem.length > 1 ? stem[stem.length - 2] : '';
                const vowelBefore = /[aeiouáéíóú]/.test(prev);
                if (vowelBefore && !ES_Z_ONLY.has(infN)) return stem.slice(0, -1) + 'zc' + ending;
                return stem.slice(0, -1) + 'z' + ending;
            }
            if (/g[ei]r$/.test(infN) && stem.endsWith('g')) return stem.slice(0, -1) + 'j' + ending;
            if (/guir$/.test(infN) && stem.endsWith('gu')) return stem.slice(0, -1) + ending;
            if (/quir$/.test(infN) && stem.endsWith('qu')) return stem.slice(0, -2) + 'c' + ending;
        }
        return stem + ending;
    }

    const ES_ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

    // Silbenkerne (für Betonung und Akzent beim Anhängen von Pronomen): Diphthonge (schwach+stark, schwach+schwach) zählen als einer
    function esNuclei(word) {
        const w = word.replace(/qu(?=[eéií])/g, 'q_').replace(/gu(?=[eéií])/g, 'g_');
        const out = [];
        let i = 0;
        const isVowel = ch => /[aeiouáéíóúü]/.test(ch || '');
        const isWeak = ch => /[iuü]/.test(ch || '');
        while (i < w.length) {
            if (!isVowel(w[i])) { i++; continue; }
            let j = i + 1;
            while (j < w.length && isVowel(w[j]) && (isWeak(w[j]) || isWeak(w[j - 1])) && !/[íú]/.test(w[j]) && !/[íú]/.test(w[j - 1])) j++;
            out.push({ start: i, end: j });
            i = j;
        }
        return out;
    }
    function esStressIndex(word, nuclei) {
        const marked = nuclei.findIndex(n => /[áéíóú]/.test(word.slice(n.start, n.end)));
        if (marked >= 0) return marked;
        if (nuclei.length <= 1) return nuclei.length - 1;
        return /[aeiouns]$/.test(word) ? nuclei.length - 2 : nuclei.length - 1;
    }
    // Hängt ein Pronomen an (lava + te = lávate, lavando + se = lavándose, pon + te = ponte)
    function esEnclitic(form, suffix) {
        const nuclei = esNuclei(form);
        const stress = esStressIndex(form, nuclei);
        const word = form + suffix;
        if (/[áéíóú]/.test(form)) return word; // Betonung ist schon markiert
        const nn = esNuclei(word);
        if (stress < 0 || stress >= nn.length) return word;
        const natural = nn.length <= 1 ? 0 : (/[aeiouns]$/.test(word) ? nn.length - 2 : nn.length - 1);
        if (stress === natural) return word;
        const n = nn[stress];
        const seg = word.slice(n.start, n.end);
        let k = seg.search(/[aeo]/);
        if (k < 0) k = seg.length === 2 ? 1 : 0; // iu / ui: der zweite Vokal
        const pos = n.start + k;
        const ch = word[pos];
        return word.slice(0, pos) + (ES_ACUTE[ch] || ch) + word.slice(pos + 1);
    }

    // Normalisiert Eingaben wie „lavarse“, „Comer“ oder „oír“
    function parseSpanishInfinitive(word) {
        let inf = String(word || '').toLowerCase().trim();
        let reflexive = false;
        if (/(ar|er|ir|ír)se$/.test(inf)) { reflexive = true; inf = inf.slice(0, -2); }
        if (!/^[a-záéíóúüñ]+$/.test(inf)) return null;
        const infN = inf.replace(/ír$/, 'ir');
        if (!/(ar|er|ir)$/.test(infN) || infN.length < (infN === 'ir' ? 2 : 3)) return null;
        return { inf: infN, reflexive };
    }

    const isForm5 = (o, keys) => !!o && keys.every(k => typeof o[k] === 'string' && o[k]);

    function conjugateSpanish(word, options) {
        const parsed = parseSpanishInfinitive(word);
        if (!parsed) return null;
        const { inf: infN, reflexive } = parsed;
        const end = infN.slice(-2);
        const stem = infN.slice(0, -2);
        const ar = end === 'ar', er = end === 'er';
        const irr = findSpanishIrregular(infN);
        const d = irr ? irr.data : {};
        const pre = arr => arr; // Datensätze von Verben mit Vorsilbe sind schon vollständig (esPrefixed)
        const type = d.stemchg || esStemType(infN);
        const weakType = end === 'ir' && (type === 'ie-i' || type === 'ue-u' || type === 'i');
        const isUir = /[^gq]uir$/.test(infN);
        const strongStem = !ar && /[aeo]$/.test(stem);
        const accentIar = (ar && ES_IAR_ACCENT.has(infN) && stem.endsWith('i')) || (ar && ES_UAR_ACCENT.has(infN) && stem.endsWith('u'));
        const fix = (s, e) => esFix(infN, s, e);
        const acc = s => s.slice(0, -1) + (ES_ACUTE[s.slice(-1)] || s.slice(-1));
        const strongPerson = i => i === 0 || i === 1 || i === 2 || i === 5;

        // --- Presente ---
        const presEnd = ar ? ['o', 'as', 'a', 'amos', 'áis', 'an'] : er ? ['o', 'es', 'e', 'emos', 'éis', 'en'] : ['o', 'es', 'e', 'imos', 'ís', 'en'];
        const presStem = i => {
            if (!strongPerson(i)) return stem;
            let s = type ? esChangeStem(stem, type) : stem;
            if (isUir) s = stem + 'y';
            if (accentIar) s = acc(stem);
            return s;
        };
        let pres;
        if (d.pres) pres = pre(d.pres);
        else {
            pres = presEnd.map((e, i) => fix(presStem(i), e));
            if (d.yo) pres[0] = d.yo;
        }

        // --- Indefinido ---
        let ind;
        if (d.ind) {
            ind = pre(d.ind);
            if (irr && irr.prefix && d.ind3Px) ind[2] = d.ind3Px;
        } else if (d.indStem) {
            const e = d.indJ ? ['e', 'iste', 'o', 'imos', 'isteis', 'eron'] : ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'];
            ind = e.map(x => d.indStem + x);
        } else {
            let e = ar ? ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'] : ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'];
            if (!ar) {
                if (isUir || strongStem) {
                    e = e.slice(); e[2] = 'yó'; e[5] = 'yeron';
                    if (strongStem) { e[1] = 'íste'; e[3] = 'ímos'; e[4] = 'ísteis'; }
                } else if (/(ñ|ll)$/.test(weakType ? esWeakStem(stem, type) : stem)) {
                    e = e.slice(); e[2] = 'ó'; e[5] = 'eron';
                }
            }
            ind = e.map((x, i) => fix((i === 2 || i === 5) && weakType ? esWeakStem(stem, type) : stem, x));
        }

        // --- Imperfecto ---
        let impf;
        if (d.impf) impf = pre(d.impf);
        else impf = (ar ? ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'] : ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']).map(e => stem + e);

        // --- Futuro / Condicional ---
        const futStem = d.fut ? d.fut : infN;
        let fut = ['é', 'ás', 'á', 'emos', 'éis', 'án'].map(e => futStem + e);
        let cond = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'].map(e => futStem + e);

        // --- Subjuntivo presente ---
        const subjEnd = ar ? ['e', 'es', 'e', 'emos', 'éis', 'en'] : ['a', 'as', 'a', 'amos', 'áis', 'an'];
        let subj;
        if (d.subj) subj = pre(d.subj);
        else {
            const yoStem = d.yo && /o$/.test(d.yo) ? d.yo.slice(0, -1) : null;
            subj = subjEnd.map((e, i) => {
                if (yoStem) return yoStem + e;
                let s = stem;
                if (isUir) s = stem + 'y';
                else if (strongPerson(i)) { if (type) s = esChangeStem(stem, type); if (accentIar) s = acc(stem); }
                else if (weakType) s = esWeakStem(stem, type);
                return fix(s, e);
            });
        }

        // --- Gerundio / Partizip ---
        const gerStem = weakType ? esWeakStem(stem, type) : stem;
        let gerundio;
        if (d.ger) gerundio = d.ger;
        else if (ar) gerundio = stem + 'ando';
        else if (isUir || strongStem) gerundio = stem + 'yendo';
        else if (/(ñ|ll)$/.test(gerStem)) gerundio = gerStem + 'endo';
        else gerundio = gerStem + 'iendo';
        let part = null;
        if (d.part) part = d.part;
        else {
            for (const [suf, rep] of ES_PART_SUFFIX) if (infN.endsWith(suf) && !ES_IRREGULAR[infN]) { part = infN.slice(0, -suf.length) + rep; break; }
            if (!part) part = ar ? stem + 'ado' : stem + (strongStem ? 'ído' : 'ido');
        }

        // --- Imperativo ---
        const infDisplay = /(oir|reir)$/.test(infN) ? infN.slice(0, -2) + 'ír' : infN;
        let imperativo = d.noImp ? null : {
            tu: d.impTu !== undefined ? d.impTu : pres[2],
            usted: subj[2],
            nosotros: d.impNos ? d.impNos : subj[3],
            vosotros: infDisplay.slice(0, -1) + 'd',
            ustedes: subj[5]
        };

        // Geprüfte Formen der KI haben Vorrang vor den Regeln
        const ver = options && options.ignoreVerified ? null : verified.es[infN];
        if (ver) {
            if (isForm6(ver.presente)) pres = ver.presente;
            if (isForm6(ver.indefinido)) ind = ver.indefinido;
            if (isForm6(ver.imperfecto)) impf = ver.imperfecto;
            if (isForm6(ver.futuro)) fut = ver.futuro;
            if (isForm6(ver.condicional)) cond = ver.condicional;
            if (isForm6(ver.subjuntivo)) subj = ver.subjuntivo;
            if (isForm5(ver.imperativo, ['tu', 'usted', 'nosotros', 'vosotros', 'ustedes'])) imperativo = { ...ver.imperativo };
            if (ver.gerundio) gerundio = ver.gerundio;
            if (ver.participio) part = ver.participio;
        }
        const perfecto = HABER_PRES.map(h => `${h} ${part}`);

        // Reflexive Verben: Pronomen vor die konjugierten Formen, beim Imperativ und Gerundio angehängt
        const refl = arr => reflexive ? arr.map((f, i) => `${ES_REFL[i]} ${f}`) : arr;
        let impAff = imperativo, impNeg = null;
        if (imperativo) {
            const vosBase = imperativo.vosotros;
            impNeg = { tu: `no ${subj[1]}`, usted: `no ${subj[2]}`, nosotros: `no ${subj[3]}`, vosotros: `no ${subj[4]}`, ustedes: `no ${subj[5]}` };
            if (reflexive) {
                impNeg = { tu: `no te ${subj[1]}`, usted: `no se ${subj[2]}`, nosotros: `no nos ${subj[3]}`, vosotros: `no os ${subj[4]}`, ustedes: `no se ${subj[5]}` };
                const nos = imperativo.nosotros;
                const vos = infN === 'ir' ? 'idos' : (/id$/.test(vosBase) ? vosBase.slice(0, -2) + 'íos' : vosBase.slice(0, -1) + 'os');
                impAff = {
                    tu: esEnclitic(imperativo.tu, 'te'),
                    usted: esEnclitic(imperativo.usted, 'se'),
                    nosotros: esEnclitic(nos.replace(/s$/, ''), 'nos'),
                    vosotros: vos,
                    ustedes: esEnclitic(imperativo.ustedes, 'se')
                };
            }
        }

        const display = reflexive ? infDisplay + 'se' : infDisplay;
        const regularYo = (ar || er || end === 'ir') && pres[0] === stem + 'o';
        return {
            lang: 'es',
            infinitive: display,
            persons: ES_PERSONS,
            irregular: !!irr || !!type || isUir || strongStem || accentIar || !regularYo || part !== (ar ? stem + 'ado' : stem + 'ido'),
            verified: !!ver,
            gerundio: reflexive ? esEnclitic(gerundio, 'se') : gerundio,
            participio: part,
            tenses: [
                { id: 'presente', name: 'Presente', forms: refl(pres) },
                { id: 'perfecto', name: 'Pretérito perfecto', forms: refl(perfecto) },
                { id: 'indefinido', name: 'Pretérito indefinido', forms: refl(ind) },
                { id: 'imperfecto', name: 'Pretérito imperfecto', forms: refl(impf) },
                { id: 'futuro', name: 'Futuro simple', forms: refl(fut) },
                { id: 'condicional', name: 'Condicional simple', forms: refl(cond) },
                { id: 'subjuntivo', name: 'Subjuntivo presente', forms: refl(subj).map(f => `que ${f}`) },
                { id: 'gerundio', name: 'Gerundio (estar + …)', forms: ESTAR_PRES.map((s, i) => `${reflexive ? ES_REFL[i] + ' ' : ''}${s} ${gerundio}`) },
                impAff ? { id: 'imperativo', name: 'Imperativo', forms: [null, impAff.tu, impAff.usted, impAff.nosotros, impAff.vosotros, impAff.ustedes], personsOverride: ['', 'tú', 'usted', 'nosotros', 'vosotros', 'ustedes'] } : null,
                impNeg ? { id: 'imperativoNeg', name: 'Imperativo negativo', forms: [null, impNeg.tu, impNeg.usted, impNeg.nosotros, impNeg.vosotros, impNeg.ustedes], personsOverride: ['', 'tú', 'usted', 'nosotros', 'vosotros', 'ustedes'] } : null
            ].filter(Boolean)
        };
    }

    // ---------------------------------------------------------------------------------------
    // Spanisch: Satzanalyse, Artikel, Geschlecht, Antwortvergleich
    // ---------------------------------------------------------------------------------------
    const esIndexCache = { key: '', index: null };
    const ES_HABER_FORMS = new Set(HABER_PRES);
    const ES_ESTAR_FORMS = new Set([...ESTAR_PRES, 'estaba', 'estabas', 'estábamos', 'estabais', 'estaban', 'estuve', 'estuvo', 'estaré', 'estará', 'estaría']);

    function buildSpanishIndex(infinitives) {
        const forms = new Map();
        const add = (form, inf, tense) => {
            const f = String(form || '').toLowerCase();
            if (!f || /\s/.test(f)) return;
            if (!forms.has(f)) forms.set(f, []);
            forms.get(f).push({ inf, tense });
        };
        const all = new Set([...Object.keys(ES_IRREGULAR).filter(k => !['prever', 'desandar', 'desoir', 'bendecir', 'maldecir', 'freir', 'satisfacer'].includes(k)), ...infinitives.map(i => String(i || '').toLowerCase().trim())]);
        all.forEach(raw => {
            const parsed = parseSpanishInfinitive(raw);
            if (!parsed) return;
            const conj = conjugateSpanish(parsed.inf, { ignoreVerified: true });
            if (!conj) return;
            conj.tenses.forEach(t => {
                if (['presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo'].includes(t.id)) {
                    t.forms.forEach(f => add(String(f || '').replace(/^que /, ''), parsed.inf, t.id));
                }
            });
            const part = String(conj.participio || '').toLowerCase();
            if (part) { add(part, parsed.inf, 'participio'); if (/o$/.test(part)) ['a', 'os', 'as'].forEach(e => add(part.slice(0, -1) + e, parsed.inf, 'participio')); }
            if (conj.gerundio) add(conj.gerundio.replace(/se$/, ''), parsed.inf, 'gerundio');
        });
        return forms;
    }

    function analyzeSpanish(sentence, infinitives) {
        const key = infinitives.length + ':' + infinitives.join('|');
        if (esIndexCache.key !== key) { esIndexCache.index = buildSpanishIndex(infinitives); esIndexCache.key = key; }
        const index = esIndexCache.index;
        const tokens = String(sentence || '').toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
        const categories = new Set();
        const verbs = new Set();
        let hasPresente = false;
        tokens.forEach((token, i) => {
            (index.get(token) || []).forEach(({ inf, tense }) => {
                if (tense === 'futuro') { categories.add('Futuro'); verbs.add(inf); }
                else if (tense === 'condicional') { categories.add('Condicional'); verbs.add(inf); }
                else if (tense === 'imperfecto') { categories.add('Pretérito Imperfecto'); verbs.add(inf); }
                else if (tense === 'indefinido') { categories.add('Pretérito Indefinido'); verbs.add(inf); }
                else if (tense === 'subjuntivo') { verbs.add(inf); hasPresente = true; } // gleich lautend mit Presente/Imperativo: nicht als eigene Art melden
                else if (tense === 'presente') { hasPresente = true; verbs.add(inf); }
                else if (tense === 'participio' && ES_HABER_FORMS.has(tokens[i - 1])) { categories.add('Pretérito Perfecto'); verbs.add(inf); }
                else if (tense === 'gerundio') { categories.add('Gerundio'); verbs.add(inf); }
            });
        });
        // Verben, die nicht in den eigenen Vokabeln stehen: nur an eindeutigen Endungen erkennen
        tokens.forEach((token, i) => {
            if (index.has(token)) return;
            if (token.length > 5 && /(aré|eré|iré|arás|erás|irás|ará|erá|irá|aremos|eremos|iremos|aréis|eréis|iréis|arán|erán|irán)$/.test(token)) categories.add('Futuro');
            else if (token.length > 6 && /(aría|ería|iría|arías|erías|irías|aríamos|eríamos|iríamos|aríais|eríais|iríais|arían|erían|irían)$/.test(token)) categories.add('Condicional');
            else if (token.length > 5 && /(ábamos|abais|aban|abas|aba)$/.test(token)) categories.add('Pretérito Imperfecto');
            else if (token.length > 5 && /(ando|iendo|yendo)$/.test(token) && ES_ESTAR_FORMS.has(tokens[i - 1])) categories.add('Gerundio');
            else if (token.length > 4 && /(ado|ido|to|cho|ídos|ado|ada|idas)$/.test(token) && ES_HABER_FORMS.has(tokens[i - 1])) categories.add('Pretérito Perfecto');
        });
        return { categories: [...categories], hasPresente, verbs: [...verbs] };
    }

    // Feminine Wörter, die im Singular „el/un“ bekommen (betontes a- oder ha- am Anfang): el agua, un águila, aber las aguas
    const ES_EL_FEM = new Set(['agua', 'águila', 'alma', 'arma', 'aula', 'área', 'hacha', 'hada', 'hambre', 'ala', 'ancla', 'asma', 'alba', 'ave', 'ansia', 'arpa', 'habla', 'haba', 'aya', 'alga', 'ama', 'asa', 'ascua', 'álgebra', 'alza', 'ánima', 'áncora', 'ágora', 'acta', 'arca', 'aria', 'asta', 'aura', 'ara', 'hampa', 'harpa']);

    // Bestimmter oder unbestimmter Artikel zu einem spanischen Substantiv. gender: 'm' | 'f'; options: { plural, indefinite }
    function esArticle(word, gender, options) {
        const o = options || {};
        const g = gender === 'f' ? 'f' : 'm';
        if (o.plural) return o.indefinite ? (g === 'f' ? 'unas' : 'unos') : (g === 'f' ? 'las' : 'los');
        const w = String(word || '').toLowerCase().trim().replace(/^(el|la|un|una)\s+/, '');
        if (g === 'f' && ES_EL_FEM.has(w)) return o.indefinite ? 'un' : 'el';
        return o.indefinite ? (g === 'f' ? 'una' : 'un') : (g === 'f' ? 'la' : 'el');
    }

    const ES_M_EXCEPTIONS = new Set(['día', 'mapa', 'planeta', 'sofá', 'idioma', 'problema', 'tema', 'sistema', 'programa', 'clima', 'diploma', 'poema', 'telegrama', 'esquema', 'síntoma', 'fantasma', 'dilema', 'drama', 'pijama', 'lema', 'trauma', 'teorema', 'cometa', 'tranvía', 'camión', 'avión', 'corazón', 'jamón', 'limón', 'balcón', 'salón', 'pie', 'lápiz', 'pez', 'país', 'mes', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'color', 'amor', 'calor', 'dolor', 'valor', 'sabor', 'olor', 'error', 'motor', 'doctor', 'profesor', 'ordenador', 'camarero', 'mar', 'árbol', 'papel', 'hotel', 'ratón', 'reloj', 'jardín', 'tren', 'cuaderno']);
    const ES_F_EXCEPTIONS = new Set(['mano', 'foto', 'moto', 'radio', 'flor', 'labor', 'razón', 'sazón', 'canción', 'lección', 'noche', 'calle', 'leche', 'nube', 'llave', 'gente', 'muerte', 'suerte', 'carne', 'clase', 'parte', 'fuente', 'torre', 'tarde', 'sal', 'miel', 'piel', 'señal', 'sed', 'cárcel', 'red', 'pared', 'ciudad', 'luz', 'paz', 'voz', 'vez', 'cruz', 'nuez', 'tez', 'nariz', 'raíz', 'mujer', 'imagen', 'hambre', 'sangre', 'fiebre', 'tos', 'crisis', 'tesis', 'base', 'nave', 'madre', 'costumbre', 'agua']);

    // Rät das Geschlecht eines spanischen Substantivs (ohne Artikel) aus Ausnahmen und Endungen.
    // Ergebnis { gender: 'm' | 'f' | null, plural: boolean }; null = unsicher (dann KI oder manuelle Wahl)
    function esGuessGender(word) {
        let w = String(word || '').toLowerCase().trim().replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
        if (!w || /\s/.test(w)) return { gender: null, plural: false };
        const direct = (x) => {
            if (ES_M_EXCEPTIONS.has(x)) return 'm';
            if (ES_F_EXCEPTIONS.has(x)) return 'f';
            if (/(ción|sión|xión|dad|tad|tud|umbre|itis|ie)$/.test(x)) return 'f';
            if (/(aje|or|án|ambre)$/.test(x)) return 'm';
            if (/ista$/.test(x)) return null; // el/la dentista, turista
            if (/o$/.test(x)) return 'm';
            if (/a$/.test(x)) return 'f';
            if (/ón$/.test(x)) return 'm';
            return null;
        };
        const g = direct(w);
        if (g) return { gender: g, plural: false };
        // Mehrzahl: -os / -as / -es mit passender Einzahl
        if (/os$/.test(w)) { const s = w.slice(0, -1); const sg = direct(s); return { gender: sg || 'm', plural: true }; }
        if (/as$/.test(w)) { const sg = direct(w.slice(0, -1)); return { gender: sg || 'f', plural: true }; }
        if (/es$/.test(w)) { const sg = direct(w.slice(0, -2)) || direct(w.slice(0, -1)); return { gender: sg, plural: !!sg }; }
        return { gender: null, plural: false };
    }

    // Antworten vergleichen (Schreibmodus, Grammatiklücken). Groß-/Kleinschreibung, Satzzeichen (auch ¿ ¡) und
    // Mehrfach-Leerzeichen sind egal. Beim Spanischen zählen die Akzente (á é í ó ú) nicht, „ñ“ und „ü“ bleiben eigene Buchstaben.
    const ES_ACCENT_MAP = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
    function normalizeAnswer(text, lang, options) {
        let s = String(text == null ? '' : text).normalize('NFC').toLowerCase().replace(/[’‘`´]/g, "'");
        s = s.replace(/[¿¡?!.,;:"“”«»()\[\]…]/g, ' ').replace(/\s+/g, ' ').trim();
        if (lang === 'es' && !(options && options.keepAccents)) s = s.replace(/[áéíóú]/g, c => ES_ACCENT_MAP[c]);
        return s;
    }
    // 'exact' (inkl. Akzenttoleranz im Schreibmodus), 'accent' (nur Akzent fehlt oder ist falsch), 'wrong'.
    // strict = true: Akzente müssen stimmen (Grammatiklücken) – ein reiner Akzentfehler wird als 'accent' gemeldet, nicht als richtig.
    function compareAnswers(input, expected, lang, strict) {
        const a = normalizeAnswer(input, lang, { keepAccents: true });
        const b = normalizeAnswer(expected, lang, { keepAccents: true });
        if (a === b) return 'exact';
        if (lang === 'es' && normalizeAnswer(input, 'es') === normalizeAnswer(expected, 'es')) return strict ? 'accent' : 'accent-ok';
        return 'wrong';
    }

    // ---------------------------------------------------------------------------------------
    // Satzanalyse: welche Zeitformen kommen im Satz tatsächlich vor? (z. B. Futur „sarà“ in einem Presente-Satz)
    // ---------------------------------------------------------------------------------------
    const itIndexCache = { key: '', index: null };
    const IT_AUX_FORMS = new Set([...AVERE_PRES, ...ESSERE_PRES]);
    const IT_STARE_FORMS = new Set(['sto', 'stai', 'sta', 'stiamo', 'state', 'stanno']);

    // Index: Wortform -> [{ inf, tense }] für alle bekannten Verben (eigene Vokabeln + unregelmäßige)
    function buildItalianIndex(infinitives) {
        const forms = new Map();
        const add = (form, inf, tense) => {
            const f = String(form || '').toLowerCase();
            if (!f || /\s/.test(f)) return;
            if (!forms.has(f)) forms.set(f, []);
            forms.get(f).push({ inf, tense });
        };
        const all = new Set([...Object.keys(IT_IRREGULAR), ...infinitives.map(i => String(i || '').toLowerCase().trim())]);
        all.forEach(raw => {
            const parsed = parseItalianInfinitive(raw);
            if (!parsed) return;
            const conj = conjugateItalian(parsed.inf, { ignoreVerified: true });
            if (!conj) return;
            conj.tenses.forEach(t => {
                if (['presente', 'imperfetto', 'futuro', 'condizionale'].includes(t.id)) t.forms.forEach(f => add(f, parsed.inf, t.id));
            });
            const part = String(conj.participio || '').toLowerCase();
            if (part) {
                add(part, parsed.inf, 'participio');
                if (/o$/.test(part)) ['a', 'i', 'e'].forEach(e => add(part.slice(0, -1) + e, parsed.inf, 'participio'));
            }
            if (conj.gerundio) add(conj.gerundio.replace(/si$/, ''), parsed.inf, 'gerundio');
        });
        return forms;
    }

    function analyzeItalian(sentence, infinitives) {
        const key = infinitives.length + ':' + infinitives.join('|');
        if (itIndexCache.key !== key) { itIndexCache.index = buildItalianIndex(infinitives); itIndexCache.key = key; }
        const index = itIndexCache.index;
        const tokens = String(sentence || '').toLowerCase().replace(/’/g, "'").split(/[^a-zàèéìòù']+/).filter(Boolean);
        const categories = new Set();
        const verbs = new Set();
        let hasPresente = false;
        tokens.forEach((token, i) => {
            (index.get(token) || []).forEach(({ inf, tense }) => {
                if (tense === 'futuro') { categories.add('Futuro Semplice'); verbs.add(inf); }
                else if (tense === 'condizionale') { categories.add('Condizionale'); verbs.add(inf); }
                else if (tense === 'imperfetto') { categories.add('Imperfetto'); verbs.add(inf); }
                else if (tense === 'presente') { hasPresente = true; verbs.add(inf); }
                else if (tense === 'participio' && IT_AUX_FORMS.has(tokens[i - 1])) { categories.add('Passato Prossimo'); verbs.add(inf); }
                else if (tense === 'gerundio') { categories.add('Gerundio'); verbs.add(inf); }
            });
        });
        // Verben, die nicht in den eigenen Vokabeln stehen: nur an eindeutigen Endungen erkennen
        tokens.forEach((token, i) => {
            if (index.has(token)) return;
            if (token.length > 5 && /(erò|irò|erà|irà|eremo|erete|eranno|iremo|irete|iranno)$/.test(token)) categories.add('Futuro Semplice');
            else if (token.length > 6 && /(erei|iresti|eresti|irei|erebbe|irebbe|eremmo|iremmo|ereste|ireste|erebbero|irebbero)$/.test(token)) categories.add('Condizionale');
            else if (token.length > 5 && /(ando|endo)$/.test(token) && IT_STARE_FORMS.has(tokens[i - 1])) categories.add('Gerundio');
        });
        return { categories: [...categories], hasPresente, verbs: [...verbs] };
    }

    // Englisch: erkennbar an Hilfsverben und Endungen
    function analyzeEnglish(sentence) {
        const text = String(sentence || '').toLowerCase().replace(/’/g, "'");
        const categories = [];
        if (/\b(will|won't|shall)\b|'ll\b|\bgoing to\b/.test(text)) categories.push('Future');
        if (/\b(would|wouldn't)\b|'d\b/.test(text)) categories.push('Conditional');
        if (/\b(am|is|are|isn't|aren't)\s+(\w+ing)\b|\b(i'm|you're|he's|she's|it's|we're|they're)\s+\w+ing\b/.test(text)) categories.push('Present Continuous');
        if (/\b(have|has|haven't|hasn't)\s+(\w+ed|been|done|gone|seen|made|had|got|known|taken|given|written|come|become|begun|run|eaten|found|left|lost|met|said|told|thought|bought|brought)\b|\b(i've|you've|we've|they've|he's|she's)\s+(\w+ed|been|done|gone|seen|made|had)\b/.test(text)) categories.push('Present Perfect');
        if (/\b(can|could|must|should|may|might)\b/.test(text)) categories.push('Modalverb');
        return { categories, hasPresente: false, verbs: [] };
    }

    // Sprachen ohne eigenen Zweig liefern bewusst nichts (kein stiller Rückfall auf Italienisch)
    function analyzeSentence(sentence, lang, infinitives) {
        switch (lang) {
            case 'en': return analyzeEnglish(sentence);
            case 'es': return analyzeSpanish(sentence, infinitives || []);
            case 'it': return analyzeItalian(sentence, infinitives || []);
            default: return { categories: [], hasPresente: false, verbs: [] };
        }
    }

    function conjugate(word, lang, options) {
        switch (lang) {
            case 'en': return conjugateEnglish(word, options);
            case 'es': return conjugateSpanish(word, options);
            case 'it': return conjugateItalian(word, options);
            default: return null;
        }
    }

    const api = { EXPLANATIONS, getExplanations, preferredTense, splitCategories, canonicalCategory, conjugate, conjugateItalian, conjugateEnglish, conjugateSpanish };
    // Geprüfte Formen setzen/abfragen: map = { infinitive: forms }
    const verifiedLang = (lang) => (lang === 'en' || lang === 'es' ? lang : 'it');
    api.setVerifiedForms = (lang, map) => { verified[verifiedLang(lang)] = map || {}; };
    api.getVerified = (lang, infinitive) => (verified[verifiedLang(lang)] || {})[String(infinitive || '').toLowerCase().trim()] || null;
    // Alle einwortigen Verbformen eines spanischen Verbs (für die Rückwärtssuche Form -> Grundform im Grammatikmodus)
    api.spanishForms = (infinitive) => {
        const bare = String(infinitive || '').toLowerCase().trim().replace(/(ar|er|ir|ír)se$/, m => m.slice(0, -2));
        const conj = conjugateSpanish(bare);
        if (!conj) return [];
        const out = new Set();
        conj.tenses.forEach(t => {
            if (t.id === 'perfecto' || t.id === 'gerundio') return;
            t.forms.forEach(f => {
                if (!f) return;
                const w = String(f).toLowerCase().replace(/^(que|no) /, '');
                if (!/\s/.test(w)) out.add(w);
            });
        });
        if (conj.participio) out.add(conj.participio);
        if (conj.gerundio) out.add(conj.gerundio);
        return [...out];
    };
    api.esArticle = esArticle;
    api.esGuessGender = esGuessGender;
    api.normalizeAnswer = normalizeAnswer;
    api.compareAnswers = compareAnswers;
    api.analyzeSentence = analyzeSentence;
    api.isIscVerb = (infinitive) => IT_ISC.has(String(infinitive || '').toLowerCase().trim());
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GrammarHelp = api;
})(typeof window !== 'undefined' ? window : globalThis);
