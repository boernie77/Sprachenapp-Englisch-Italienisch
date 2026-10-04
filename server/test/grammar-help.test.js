// Tests für server/public/grammar-help.js (Konjugation, Satzanalyse, Spanisch-Helfer).
// Start: cd server && node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const G = require('../public/grammar-help.js');

const tense = (word, id, lang = 'es') => {
    const c = G.conjugate(word, lang);
    assert.ok(c, `${word} sollte konjugierbar sein`);
    const t = c.tenses.find(x => x.id === id);
    assert.ok(t, `${word}: Zeitform ${id} fehlt`);
    return t.forms;
};

// --- Regression: Italienisch und Englisch dürfen sich durch die Spanisch-Erweiterung nicht ändern ---
test('Italienisch und Englisch unverändert (Vergleich mit gespeichertem Stand vor Spanisch)', () => {
    const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'it-en-baseline.json'), 'utf8'));
    const roundTrip = (x) => JSON.parse(JSON.stringify(x));
    for (const [verb, expected] of Object.entries(base.it)) assert.deepEqual(roundTrip(G.conjugate(verb, 'it')), expected, `it ${verb}`);
    for (const [verb, expected] of Object.entries(base.en)) assert.deepEqual(roundTrip(G.conjugate(verb, 'en')), expected, `en ${verb}`);
    const infs = ['mangiare', 'andare', 'leggere', 'parlare', 'partire'];
    for (const [sentence, expected] of Object.entries(base.analyze)) {
        const lang = ['I will go and I would help.', 'She is reading and has eaten.', 'You must go.'].includes(sentence) ? 'en' : 'it';
        assert.deepEqual(roundTrip(G.analyzeSentence(sentence, lang, infs)), expected, sentence);
    }
    for (const lang of ['it', 'en']) assert.deepEqual(roundTrip(G.EXPLANATIONS[lang]), base.expl[lang], `Erklärungen ${lang}`);
    assert.deepEqual([G.preferredTense('Presente', 'it'), G.getExplanations('Presente', 'it').length], base.tense.Presenteit);
    assert.deepEqual([G.preferredTense('Future', 'en'), G.getExplanations('Future', 'en').length], base.tense.Futureen);
    assert.deepEqual([G.preferredTense('Passato Prossimo + Gerundio', 'it'), G.getExplanations('Passato Prossimo + Gerundio', 'it').length], base.tense['Passato Prossimo + Gerundioit']);
    // geprüfte Formen: nur für die jeweilige Sprache
    G.setVerifiedForms('it', { parlare: { presente: ['a', 'b', 'c', 'd', 'e', 'f'] } });
    assert.deepEqual(G.conjugate('parlare', 'it').tenses[0].forms, base.verifiedIt);
    assert.equal(G.getVerified('es', 'parlare'), null);
    G.setVerifiedForms('it', {});
});

test('unbekannte Sprache fällt nicht still auf Italienisch zurück', () => {
    assert.equal(G.conjugate('parlare', 'xx'), null);
    assert.deepEqual(G.analyzeSentence('Ieri abbiamo mangiato', 'xx', []).categories, []);
});

// --- Spanisch: Konjugation ---
test('Spanisch: regelmäßige Verben', () => {
    assert.deepEqual(tense('hablar', 'presente'), ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan']);
    assert.deepEqual(tense('comer', 'presente'), ['como', 'comes', 'come', 'comemos', 'coméis', 'comen']);
    assert.deepEqual(tense('vivir', 'presente'), ['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven']);
    assert.deepEqual(tense('hablar', 'indefinido'), ['hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron']);
    assert.deepEqual(tense('comer', 'indefinido'), ['comí', 'comiste', 'comió', 'comimos', 'comisteis', 'comieron']);
    assert.deepEqual(tense('hablar', 'imperfecto'), ['hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablabais', 'hablaban']);
    assert.deepEqual(tense('vivir', 'imperfecto'), ['vivía', 'vivías', 'vivía', 'vivíamos', 'vivíais', 'vivían']);
    assert.deepEqual(tense('hablar', 'futuro'), ['hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablaréis', 'hablarán']);
    assert.deepEqual(tense('hablar', 'condicional'), ['hablaría', 'hablarías', 'hablaría', 'hablaríamos', 'hablaríais', 'hablarían']);
    assert.deepEqual(tense('hablar', 'subjuntivo'), ['que hable', 'que hables', 'que hable', 'que hablemos', 'que habléis', 'que hablen']);
    assert.deepEqual(tense('comer', 'perfecto'), ['he comido', 'has comido', 'ha comido', 'hemos comido', 'habéis comido', 'han comido']);
    assert.deepEqual(tense('hablar', 'gerundio'), ['estoy hablando', 'estás hablando', 'está hablando', 'estamos hablando', 'estáis hablando', 'están hablando']);
    assert.deepEqual(tense('hablar', 'imperativo'), [null, 'habla', 'hable', 'hablemos', 'hablad', 'hablen']);
    assert.deepEqual(tense('comer', 'imperativoNeg'), [null, 'no comas', 'no coma', 'no comamos', 'no comáis', 'no coman']);
    const c = G.conjugate('hablar', 'es');
    assert.equal(c.lang, 'es');
    assert.equal(c.irregular, false);
    assert.equal(c.participio, 'hablado');
    assert.equal(c.gerundio, 'hablando');
});

test('Spanisch: Stammwechsel', () => {
    assert.deepEqual(tense('pensar', 'presente'), ['pienso', 'piensas', 'piensa', 'pensamos', 'pensáis', 'piensan']);
    assert.deepEqual(tense('poder', 'presente'), ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden']);
    assert.deepEqual(tense('pedir', 'presente'), ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden']);
    assert.deepEqual(tense('dormir', 'presente'), ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen']);
    assert.deepEqual(tense('dormir', 'indefinido'), ['dormí', 'dormiste', 'durmió', 'dormimos', 'dormisteis', 'durmieron']);
    assert.deepEqual(tense('dormir', 'subjuntivo'), ['que duerma', 'que duermas', 'que duerma', 'que durmamos', 'que durmáis', 'que duerman']);
    assert.deepEqual(tense('sentir', 'indefinido'), ['sentí', 'sentiste', 'sintió', 'sentimos', 'sentisteis', 'sintieron']);
    assert.deepEqual(tense('jugar', 'presente'), ['juego', 'juegas', 'juega', 'jugamos', 'jugáis', 'juegan']);
    assert.equal(G.conjugate('dormir', 'es').gerundio, 'durmiendo');
    assert.equal(G.conjugate('pedir', 'es').gerundio, 'pidiendo');
    assert.equal(G.conjugate('pensar', 'es').irregular, true);
});

test('Spanisch: unregelmäßige Verben', () => {
    assert.deepEqual(tense('ser', 'presente'), ['soy', 'eres', 'es', 'somos', 'sois', 'son']);
    assert.deepEqual(tense('ser', 'indefinido'), ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron']);
    assert.deepEqual(tense('ser', 'imperfecto'), ['era', 'eras', 'era', 'éramos', 'erais', 'eran']);
    assert.deepEqual(tense('estar', 'presente'), ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están']);
    assert.deepEqual(tense('estar', 'indefinido'), ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron']);
    assert.deepEqual(tense('ir', 'presente'), ['voy', 'vas', 'va', 'vamos', 'vais', 'van']);
    assert.deepEqual(tense('ir', 'imperfecto'), ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban']);
    assert.deepEqual(tense('ir', 'imperativo'), [null, 've', 'vaya', 'vamos', 'id', 'vayan']);
    assert.deepEqual(tense('tener', 'presente'), ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen']);
    assert.deepEqual(tense('tener', 'futuro'), ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán']);
    assert.deepEqual(tense('hacer', 'indefinido'), ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron']);
    assert.deepEqual(tense('decir', 'presente'), ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen']);
    assert.deepEqual(tense('decir', 'indefinido'), ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron']);
    assert.deepEqual(tense('venir', 'subjuntivo'), ['que venga', 'que vengas', 'que venga', 'que vengamos', 'que vengáis', 'que vengan']);
    assert.deepEqual(tense('saber', 'presente')[0], 'sé');
    assert.deepEqual(tense('dar', 'subjuntivo'), ['que dé', 'que des', 'que dé', 'que demos', 'que deis', 'que den']);
    assert.deepEqual(tense('oír', 'presente'), ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen']);
    assert.deepEqual(tense('reír', 'presente'), ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen']);
    assert.deepEqual(tense('haber', 'presente'), ['he', 'has', 'ha', 'hemos', 'habéis', 'han']);
    assert.equal(G.conjugate('haber', 'es').tenses.some(t => t.id === 'imperativo'), false);
    // Partizipien und Gerundien
    const parts = { hacer: 'hecho', decir: 'dicho', ver: 'visto', poner: 'puesto', escribir: 'escrito', abrir: 'abierto', volver: 'vuelto', romper: 'roto', morir: 'muerto', descubrir: 'descubierto', componer: 'compuesto', leer: 'leído', traer: 'traído', ir: 'ido' };
    for (const [v, p] of Object.entries(parts)) assert.equal(G.conjugate(v, 'es').participio, p, `Partizip ${v}`);
    const gers = { leer: 'leyendo', ir: 'yendo', decir: 'diciendo', venir: 'viniendo', poder: 'pudiendo', construir: 'construyendo', oír: 'oyendo', reír: 'riendo' };
    for (const [v, g] of Object.entries(gers)) assert.equal(G.conjugate(v, 'es').gerundio, g, `Gerundio ${v}`);
});

test('Spanisch: Verben mit Vorsilbe', () => {
    assert.deepEqual(tense('mantener', 'presente'), ['mantengo', 'mantienes', 'mantiene', 'mantenemos', 'mantenéis', 'mantienen']);
    assert.equal(tense('mantener', 'imperativo')[1], 'mantén');
    assert.equal(tense('componer', 'imperativo')[1], 'compón');
    assert.equal(tense('deshacer', 'imperativo')[1], 'deshaz');
    assert.equal(tense('predecir', 'imperativo')[1], 'predice');
    assert.equal(tense('predecir', 'indefinido')[0], 'predije');
    assert.equal(tense('conducir', 'indefinido')[0], 'conduje');
    assert.equal(tense('traducir', 'presente')[0], 'traduzco');
    assert.equal(tense('atraer', 'indefinido')[2], 'atrajo');
    assert.equal(tense('sonreír', 'indefinido')[2], 'sonrió');
    assert.equal(tense('satisfacer', 'indefinido')[2], 'satisfizo');
    assert.equal(G.conjugate('satisfacer', 'es').participio, 'satisfecho');
    // „mandar“ endet auf andar, ist aber regelmäßig
    assert.equal(tense('mandar', 'indefinido')[0], 'mandé');
});

test('Spanisch: Rechtschreibregeln', () => {
    assert.equal(tense('buscar', 'indefinido')[0], 'busqué');
    assert.deepEqual(tense('buscar', 'subjuntivo'), ['que busque', 'que busques', 'que busque', 'que busquemos', 'que busquéis', 'que busquen']);
    assert.equal(tense('pagar', 'indefinido')[0], 'pagué');
    assert.equal(tense('empezar', 'indefinido')[0], 'empecé');
    assert.equal(tense('empezar', 'subjuntivo')[0], 'que empiece');
    assert.equal(tense('averiguar', 'indefinido')[0], 'averigüé');
    assert.equal(tense('conocer', 'presente')[0], 'conozco');
    assert.equal(tense('conocer', 'subjuntivo')[3], 'que conozcamos');
    assert.equal(tense('vencer', 'presente')[0], 'venzo');
    assert.equal(tense('escoger', 'presente')[0], 'escojo');
    assert.equal(tense('elegir', 'presente')[0], 'elijo');
    assert.equal(tense('seguir', 'presente')[0], 'sigo');
    assert.equal(tense('seguir', 'indefinido')[2], 'siguió');
    assert.deepEqual(tense('leer', 'indefinido'), ['leí', 'leíste', 'leyó', 'leímos', 'leísteis', 'leyeron']);
    assert.deepEqual(tense('construir', 'presente'), ['construyo', 'construyes', 'construye', 'construimos', 'construís', 'construyen']);
    assert.deepEqual(tense('construir', 'indefinido'), ['construí', 'construiste', 'construyó', 'construimos', 'construisteis', 'construyeron']);
    assert.deepEqual(tense('enviar', 'presente'), ['envío', 'envías', 'envía', 'enviamos', 'enviáis', 'envían']);
    assert.deepEqual(tense('actuar', 'presente'), ['actúo', 'actúas', 'actúa', 'actuamos', 'actuáis', 'actúan']);
    assert.deepEqual(tense('estudiar', 'presente'), ['estudio', 'estudias', 'estudia', 'estudiamos', 'estudiáis', 'estudian']);
    assert.equal(tense('reñir', 'indefinido')[2], 'riñó');
    assert.equal(G.conjugate('reñir', 'es').gerundio, 'riñendo');
});

test('Spanisch: reflexive Verben', () => {
    const c = G.conjugate('lavarse', 'es');
    assert.equal(c.infinitive, 'lavarse');
    assert.deepEqual(tense('lavarse', 'presente'), ['me lavo', 'te lavas', 'se lava', 'nos lavamos', 'os laváis', 'se lavan']);
    assert.deepEqual(tense('lavarse', 'perfecto')[0], 'me he lavado');
    assert.deepEqual(tense('lavarse', 'subjuntivo')[0], 'que me lave');
    assert.deepEqual(tense('lavarse', 'imperativo'), [null, 'lávate', 'lávese', 'lavémonos', 'lavaos', 'lávense']);
    assert.deepEqual(tense('lavarse', 'imperativoNeg'), [null, 'no te laves', 'no se lave', 'no nos lavemos', 'no os lavéis', 'no se laven']);
    assert.equal(c.gerundio, 'lavándose');
    assert.equal(tense('lavarse', 'gerundio')[0], 'me estoy lavando');
    assert.deepEqual(tense('sentarse', 'imperativo'), [null, 'siéntate', 'siéntese', 'sentémonos', 'sentaos', 'siéntense']);
    assert.deepEqual(tense('vestirse', 'imperativo'), [null, 'vístete', 'vístase', 'vistámonos', 'vestíos', 'vístanse']);
    assert.deepEqual(tense('ponerse', 'imperativo'), [null, 'ponte', 'póngase', 'pongámonos', 'poneos', 'pónganse']);
    assert.deepEqual(tense('irse', 'imperativo'), [null, 'vete', 'váyase', 'vámonos', 'idos', 'váyanse']);
    assert.equal(G.conjugate('comiendo', 'es'), null);
});

test('Spanisch: Eingaben', () => {
    assert.equal(G.conjugate('Hablar', 'es').infinitive, 'hablar');
    assert.equal(G.conjugate('hablar ', 'es').infinitive, 'hablar');
    assert.equal(G.conjugate('oir', 'es').infinitive, 'oír');
    assert.equal(G.conjugate('casa', 'es'), null);
    assert.equal(G.conjugate('', 'es'), null);
    assert.equal(G.conjugate('dos palabras', 'es'), null);
});

test('Spanisch: geprüfte KI-Formen ersetzen die Regeln und bleiben auf Spanisch beschränkt', () => {
    const forms = {
        presente: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], indefinido: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'], imperfecto: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
        futuro: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], condicional: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'], subjuntivo: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
        imperativo: { tu: 'g1', usted: 'g2', nosotros: 'g3', vosotros: 'g4', ustedes: 'g5' }, participio: 'hecho2', gerundio: 'ger2'
    };
    G.setVerifiedForms('es', { hablar: forms });
    const c = G.conjugate('hablar', 'es');
    assert.equal(c.verified, true);
    assert.deepEqual(c.tenses.find(t => t.id === 'presente').forms, forms.presente);
    assert.equal(c.tenses.find(t => t.id === 'perfecto').forms[0], 'he hecho2');
    assert.deepEqual(c.tenses.find(t => t.id === 'imperativo').forms, [null, 'g1', 'g2', 'g3', 'g4', 'g5']);
    assert.equal(G.conjugate('hablar', 'es', { ignoreVerified: true }).verified, false);
    assert.ok(G.getVerified('es', 'hablar'));
    assert.equal(G.getVerified('it', 'hablar'), null);
    G.setVerifiedForms('es', {});
    assert.equal(G.conjugate('hablar', 'es').verified, false);
});

// --- Spanisch: Satzanalyse, Erklärungen, Helfer ---
test('Spanisch: Satzanalyse', () => {
    const a = (s, infs = ['comer', 'hablar', 'ir', 'viajar']) => G.analyzeSentence(s, 'es', infs);
    assert.ok(a('Mañana viajaré a España.').categories.includes('Futuro'));
    assert.ok(a('¿Podrías ayudarme? Hablaría con él.').categories.includes('Condicional'));
    assert.ok(a('Hoy he comido paella.').categories.includes('Pretérito Perfecto'));
    assert.ok(a('Ayer comí en casa.').categories.includes('Pretérito Indefinido'));
    assert.ok(a('De niño comía mucho.').categories.includes('Pretérito Imperfecto'));
    assert.ok(a('Estoy hablando con mi madre.').categories.includes('Gerundio'));
    assert.equal(a('Como una manzana.').hasPresente, true);
    assert.deepEqual(a('Como una manzana.').categories, []);
    // Verben, die nicht in der Vokabelliste stehen, werden an Endungen erkannt
    assert.ok(a('Mañana trabajaremos mucho.').categories.includes('Futuro'));
    // ¿ ¡ und Akzentbuchstaben zerlegen das Wort nicht
    assert.ok(a('¡Ayer fui al cine!', ['ir']).categories.includes('Pretérito Indefinido'));
});

test('Spanisch: Erklärungen und Kategorien', () => {
    const cats = ['Presente', 'Pretérito Perfecto', 'Pretérito Indefinido', 'Pretérito Imperfecto', 'Gerundio', 'Imperativo', 'Subjuntivo', 'Futuro', 'Condicional'];
    for (const c of cats) {
        assert.equal(G.getExplanations(c, 'es').length, 1, c);
        assert.ok(G.preferredTense(c, 'es'), c);
    }
    assert.equal(G.preferredTense('Pretérito Perfecto', 'es'), 'perfecto');
    assert.equal(G.getExplanations('Perfecto', 'es').length, 1); // Alias
    assert.equal(G.getExplanations('Indefinido + Gerundio', 'es').length, 2);
    assert.equal(G.canonicalCategory('Preterito Imperfecto', 'es'), 'Pretérito Imperfecto');
    assert.equal(G.canonicalCategory('Presente', 'it'), 'Presente');
});

test('Spanisch: Artikel (el agua!)', () => {
    assert.equal(G.esArticle('casa', 'f'), 'la');
    assert.equal(G.esArticle('libro', 'm'), 'el');
    assert.equal(G.esArticle('agua', 'f'), 'el');
    assert.equal(G.esArticle('águila', 'f'), 'el');
    assert.equal(G.esArticle('hacha', 'f'), 'el');
    assert.equal(G.esArticle('agua', 'f', { indefinite: true }), 'un');
    assert.equal(G.esArticle('aguas', 'f', { plural: true }), 'las');
    assert.equal(G.esArticle('amiga', 'f'), 'la'); // unbetontes a-: bleibt la
    assert.equal(G.esArticle('libros', 'm', { plural: true }), 'los');
    assert.equal(G.esArticle('casa', 'f', { indefinite: true, plural: true }), 'unas');
});

test('Spanisch: Geschlecht raten', () => {
    const g = w => G.esGuessGender(w).gender;
    assert.equal(g('libro'), 'm');
    assert.equal(g('casa'), 'f');
    assert.equal(g('la mesa'), 'f');
    assert.equal(g('día'), 'm');
    assert.equal(g('mano'), 'f');
    assert.equal(g('problema'), 'm');
    assert.equal(g('canción'), 'f');
    assert.equal(g('ciudad'), 'f');
    assert.equal(g('trabajo'), 'm');
    assert.equal(g('viaje'), 'm');
    assert.equal(g('estudiante'), null);
    assert.equal(g('turista'), null);
    assert.deepEqual(G.esGuessGender('libros'), { gender: 'm', plural: true });
    assert.deepEqual(G.esGuessGender('casas'), { gender: 'f', plural: true });
});

test('Antworten vergleichen (Akzent-Toleranz nur bei Spanisch)', () => {
    assert.equal(G.normalizeAnswer('¿Dónde estás?', 'es'), 'donde estas');
    assert.equal(G.normalizeAnswer('  ¡Hola,  amigo!  ', 'es'), 'hola amigo');
    assert.equal(G.normalizeAnswer('año', 'es'), 'año'); // ñ bleibt ein eigener Buchstabe
    assert.notEqual(G.normalizeAnswer('ano', 'es'), G.normalizeAnswer('año', 'es'));
    assert.equal(G.normalizeAnswer('pingüino', 'es'), 'pingüino');
    assert.equal(G.normalizeAnswer('perché', 'it'), 'perché'); // Italienisch: Akzente bleiben
    assert.equal(G.compareAnswers('Estas', 'estás', 'es', false), 'accent-ok');
    assert.equal(G.compareAnswers('estás', 'estás', 'es', false), 'exact');
    assert.equal(G.compareAnswers('estas', 'estás', 'es', true), 'accent');
    assert.equal(G.compareAnswers('esta', 'estás', 'es', false), 'wrong');
    assert.equal(G.compareAnswers('ano', 'año', 'es', false), 'wrong');
    assert.equal(G.compareAnswers('perche', 'perché', 'it', false), 'wrong');
});

test('Spanisch: geprüfte Formen für oír/reír (Server speichert mit Akzent) greifen auch ohne Akzent', () => {
    const six = x => [x + '1', x + '2', x + '3', x + '4', x + '5', x + '6'];
    const forms = { presente: six('p'), indefinido: six('i'), imperfecto: six('m'), futuro: six('f'), condicional: six('c'), subjuntivo: six('s'),
        imperativo: { tu: 'a', usted: 'b', nosotros: 'c', vosotros: 'd', ustedes: 'e' }, participio: 'oido2', gerundio: 'oyendo2' };
    G.setVerifiedForms('es', { 'oír': forms });
    assert.equal(G.conjugate('oír', 'es').verified, true);
    assert.equal(G.conjugate('oir', 'es').verified, true);
    assert.ok(G.getVerified('es', 'oír'));
    assert.ok(G.getVerified('es', 'oir'));
    G.setVerifiedForms('es', {});
    assert.equal(G.conjugate('oír', 'es').verified, false);
});
