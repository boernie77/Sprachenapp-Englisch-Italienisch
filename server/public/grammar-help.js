// Grammatik-Hilfe für den Grammatik-Modus: Erklärungen je Kategorie und Konjugationstabellen
// (Italienisch und Englisch). Läuft im Browser (window.GrammarHelp) und in Node (für Tests).
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
        }
    };

    // Welche Zeitform der Tabelle zur Kategorie passt (wird im Dialog zuerst gezeigt)
    const CATEGORY_TENSE = {
        it: { 'Presente': 'presente', 'Passato Prossimo': 'passato', 'Imperfetto': 'imperfetto', 'Gerundio': 'gerundio',
            'Gemischt': 'passato', 'Imperativo': 'imperativo', 'Congiuntivo': 'congiuntivo', 'Futuro Semplice': 'futuro' },
        en: { 'Simple Present': 'present', 'Present Continuous': 'continuous', 'Simple Past': 'past', 'Present Perfect': 'perfect',
            'Imperativ': 'present', 'Conditional': 'conditional', 'Future': 'future', 'Subjunctive': 'past' }
    };

    function splitCategories(category) {
        return String(category || '').split('+').map(c => c.trim()).filter(Boolean);
    }

    function getExplanations(category, lang) {
        const table = EXPLANATIONS[lang] || {};
        return splitCategories(category).map(c => table[c]).filter(Boolean);
    }

    function preferredTense(category, lang) {
        const map = CATEGORY_TENSE[lang] || {};
        for (const c of splitCategories(category)) if (map[c]) return map[c];
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
        'starnutire', 'concepire', 'differire', 'eseguire', 'patire', 'reagire', 'sgranchire', 'colorire', 'ammonire']);

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

    function conjugateItalian(word) {
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
        const fut = ['ò', 'ai', 'à', 'emo', 'ete', 'anno'].map(e => futStem + e);
        const cond = ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero'].map(e => futStem + e);

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
        const imperativo = d.imp === null && !d.impLei ? null : {
            tu: impTu,
            Lei: d.impLei ? px + d.impLei : cong[0],
            noi: pres[3],
            voi: d.impVoi ? px + d.impVoi : pres[4]
        };

        // --- Gerundio / Partizip / Hilfsverb ---
        const gerundio = d.ger ? px + d.ger : stem + (ending === 'are' ? 'ando' : 'endo');
        const part = d.part ? px + d.part : (irregularParticiple(inf) || stem + { are: 'ato', ere: 'uto', ire: 'ito' }[ending]);
        const aux = reflexive || d.aux === 'essere' || IT_ESSERE.has(inf) || (irr && IT_ESSERE.has(irr.base)) ? 'essere' : 'avere';
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

    function conjugateEnglish(word) {
        let v = String(word || '').toLowerCase().trim().replace(/^to\s+/, '');
        if (!/^[a-z]+(-[a-z]+)?$/.test(v)) return null;
        if (EN_MODALS.has(v)) {
            return { lang: 'en', infinitive: v, modal: true, persons: EN_PERSONS, tenses: [] };
        }
        const irr = EN_IRREGULAR[v];
        const past = irr ? irr[0] : enPastRegular(v);
        const part = irr ? irr[1] : enPastRegular(v);
        const ing = enIng(v);
        const third = enThirdPerson(v);

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

    function conjugate(word, lang) {
        return lang === 'en' ? conjugateEnglish(word) : conjugateItalian(word);
    }

    const api = { EXPLANATIONS, getExplanations, preferredTense, splitCategories, conjugate, conjugateItalian, conjugateEnglish };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GrammarHelp = api;
})(typeof window !== 'undefined' ? window : globalThis);
