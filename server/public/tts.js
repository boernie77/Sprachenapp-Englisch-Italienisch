// Sprachausgabe (TTS): Textaufbereitung, Stimmenwahl, Queue/Abbruch und die drei Wege zur Stimme
// (Web Speech API, natives Capacitor-Plugin, Cloudstimme vom Server).
// Läuft im Browser (window.Tts) und in Node (Textaufbereitung und Stimmenwahl für Tests).
(function (root) {
    'use strict';

    // Je Sprache das Gebietsschema für die Stimme (de-DE fest; das Feld `locale` der Lernsprachen ist nur für den Collator)
    const TTS_LOCALES = { it: 'it-IT', en: 'en-GB', es: 'es-ES', de: 'de-DE' };
    const LANGS = ['it', 'en', 'es', 'de'];
    const STORAGE_KEY = 'lernapp-tts';
    const DEFAULT_SETTINGS = { enabled: true, auto: false, rate: 0.9, voice: { it: '', en: '', es: '', de: '' }, speakDe: false, engine: 'device' };

    // ---------------------------------------------------------------------------------------
    // Textaufbereitung
    // ---------------------------------------------------------------------------------------
    // Kleine Abkürzungstabelle je Sprache (erweiterbar); Schlüssel klein geschrieben, mit Punkt
    const ABBREVIATIONS = {
        it: { 'sig.ra': 'signora', 'sig.': 'signor', 'dott.ssa': 'dottoressa', 'dott.': 'dottor', 'prof.': 'professor', 'ecc.': 'eccetera', 'es.': 'esempio' },
        en: { 'mr.': 'mister', 'mrs.': 'missus', 'dr.': 'doctor', 'etc.': 'et cetera' },
        es: { 'sra.': 'señora', 'sr.': 'señor', 'dr.': 'doctor', 'etc.': 'etcétera' },
        de: { 'z. b.': 'zum Beispiel', 'z.b.': 'zum Beispiel', 'usw.': 'und so weiter', 'bzw.': 'beziehungsweise' }
    };

    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Text mit Lücken (Grammatik-Modus vor dem Prüfen) wird nie vorgelesen
    const hasGap = (text) => /_{2,}|\.{3}/.test(String(text == null ? '' : text));

    // Liefert den sprechbaren Text oder '' (nichts sprechen)
    function clean(text, lang) {
        let t = String(text == null ? '' : text);
        if (!t.trim() || hasGap(t)) return '';
        t = t.replace(/\p{Extended_Pictographic}|[︀-️‍⃣]/gu, ''); // Emoji samt Variation Selectors
        t = t.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');                                   // Klammern samt Inhalt (Hinweise wie „(f)“)
        t = t.replace(/(\p{L}[\p{L}']*)\s*\/\s*(\p{L})/gu, '$1, $2');                  // „el/la“ -> „el, la“
        t = t.replace(/…/g, ', ').replace(/_/g, ' ');
        const table = ABBREVIATIONS[lang] || {};
        Object.keys(table).sort((a, b) => b.length - a.length).forEach(abbr => {
            t = t.replace(new RegExp(`(^|[^\\p{L}])${esc(abbr)}`, 'giu'), (m, pre) => pre + table[abbr]);
        });
        t = t.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^[\s,;:]+|[\s,;:]+$/g, '').trim();
        if (lang === 'en') t = t.replace(/^(the|an|a)\s+/i, ''); // englische Artikel nie mitsprechen
        return /[\p{L}\p{N}]/u.test(t) ? t : '';
    }

    // Eintrag + Feld -> { text, lang } oder null. `ctx.full` = Fremdwort samt Artikel/„to“ (wie auf der Karte),
    // `ctx.lang` = Lernsprache. Feld `de` ist immer Deutsch, Feld `it` (Fremdwort) die Lernsprache.
    function prepare(entry, field, ctx) {
        if (!entry) return null;
        ctx = ctx || {};
        const lang = field === 'de' ? 'de' : (ctx.lang || (state.getLearningLang && state.getLearningLang()) || 'it');
        const raw = field === 'de' ? entry.de : (ctx.full || entry[field || 'it']);
        const text = clean(raw, lang);
        return text ? { text, lang } : null;
    }

    // Lange Texte in Sätze/Häppchen teilen (Chrome bricht Äußerungen nach ca. 15 s ab)
    function splitText(text, maxLen) {
        maxLen = maxLen || 160;
        const parts = String(text).split(/(?<=[.!?;:])\s+/u).filter(Boolean);
        const out = [];
        parts.forEach(part => {
            while (part.length > maxLen) {
                let cut = part.lastIndexOf(',', maxLen);
                if (cut < maxLen / 3) cut = part.lastIndexOf(' ', maxLen);
                if (cut < 1) cut = maxLen;
                out.push(part.slice(0, cut + 1).trim());
                part = part.slice(cut + 1).trim();
            }
            if (part) out.push(part);
        });
        return out;
    }

    // ---------------------------------------------------------------------------------------
    // Stimmenwahl
    // ---------------------------------------------------------------------------------------
    const normLang = (l) => String(l || '').replace('_', '-').toLowerCase();
    const QUALITY = /enhanced|premium|neural|natural|erweitert|optimiert/i;

    function scoreVoice(v) {
        return (QUALITY.test(v.name || '') ? 4 : 0) + (v.local ? 2 : 0) + (v.default ? 1 : 0);
    }

    // voices: [{ uri, name, lang, local, default }]; liefert die beste Stimme oder null
    function pickVoice(voices, lang, savedUri) {
        const locale = normLang(TTS_LOCALES[lang]);
        const family = locale.slice(0, 2);
        if (savedUri) {
            const saved = voices.find(v => v.uri === savedUri && normLang(v.lang).startsWith(family));
            if (saved) return saved;
        }
        const best = (list) => list.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
        return best(voices.filter(v => normLang(v.lang) === locale)) || best(voices.filter(v => normLang(v.lang).startsWith(family)));
    }

    // ---------------------------------------------------------------------------------------
    // Zustand, Einstellungen
    // ---------------------------------------------------------------------------------------
    const state = {
        settings: null,
        token: 0,              // Epoche: Abbruch macht verspätete onend/Promises unwirksam
        chain: Promise.resolve(),
        refs: [],              // Utterance-Referenzen (Safari/Chrome räumen sonst vorzeitig ab, onend kommt nie)
        finish: null,          // beendet die laufende Wiedergabe sofort
        voices: null, voicesEmptyAt: 0,
        warned: {},
        audio: null, blobs: new Map(),
        // vom Hauptskript gesetzt:
        getLearningLang: null, notify: null, fetchAudio: null, cloudAvailable: null, getEpoch: null, label: null, resolveById: null, onChange: null
    };

    const hasWindow = typeof window !== 'undefined';
    const webSynth = () => (hasWindow && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined') ? window.speechSynthesis : null;
    const plugin = () => {
        try { return (hasWindow && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) || null; } catch (e) { return null; }
    };
    const isIos = () => { try { return hasWindow && window.Capacitor.getPlatform() === 'ios'; } catch (e) { return false; } };

    // Plugin auf Android (dort fehlt/hakt speechSynthesis im WebView) und auf iOS: Die Web-API zeigt im WKWebView
    // nicht alle geladenen Stimmen (erweiterte/hochwertige fehlen), das Plugin liest AVSpeechSynthesisVoice.speechVoices().
    // `webIos: true` in den Einstellungen schaltet iOS zurück auf die Web-API (der frühere Schlüssel `nativeIos` gilt nicht mehr, alte Werte blieben im Speicher stehen).
    function nativePlugin() {
        const p = plugin();
        if (!p) return null;
        return isIos() && loadSettings().webIos === true && webSynth() ? null : p;
    }

    function loadSettings() {
        if (state.settings) return state.settings;
        let stored = {};
        try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (e) { stored = {}; }
        const rate = Number(stored.rate);
        state.settings = {
            ...DEFAULT_SETTINGS, ...stored,
            enabled: stored.enabled !== false,
            auto: stored.auto === true,
            speakDe: stored.speakDe === true,
            engine: stored.engine === 'cloud' ? 'cloud' : 'device',
            rate: rate >= 0.6 && rate <= 1.2 ? rate : DEFAULT_SETTINGS.rate,
            voice: { ...DEFAULT_SETTINGS.voice, ...(stored.voice || {}) }
        };
        return state.settings;
    }

    function setSettings(patch) {
        const s = loadSettings();
        const next = { ...s, ...patch, voice: { ...s.voice, ...((patch && patch.voice) || {}) } };
        state.settings = next;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* privater Modus */ }
        if (!next.enabled || (patch && patch.engine && patch.engine !== s.engine)) stop();
        if (state.onChange) state.onChange(next);
        return next;
    }

    const cloudOn = () => loadSettings().engine === 'cloud' && !!(state.cloudAvailable && state.cloudAvailable());
    const available = () => loadSettings().enabled && !!(webSynth() || plugin() || cloudOn());

    // ---------------------------------------------------------------------------------------
    // Stimmen laden
    // ---------------------------------------------------------------------------------------
    const normalizeWeb = (v) => ({ uri: v.voiceURI || v.name, name: v.name, lang: v.lang, local: v.localService !== false, default: !!v.default, raw: v });

    // opts.refresh: Liste neu holen (nachträglich geladene Stimmen erscheinen so ohne App-Neustart)
    function getVoices(opts) {
        if (opts && opts.refresh) { state.voices = null; state.voicesEmptyAt = 0; }
        if (state.voices && state.voices.length) return Promise.resolve(state.voices);
        const p = nativePlugin();
        if (p) {
            return Promise.resolve(p.getSupportedVoices()).then(res => {
                state.voices = ((res && res.voices) || []).map((v, i) => ({ uri: v.voiceURI || v.name, name: v.name, lang: v.lang, local: v.localService !== false, default: !!v.default, index: i }));
                return state.voices;
            }).catch(() => []);
        }
        const ss = webSynth();
        if (!ss) return Promise.resolve([]);
        const now = () => { const list = ss.getVoices() || []; if (list.length) state.voices = list.map(normalizeWeb); return state.voices || []; };
        const first = now();
        if (first.length || Date.now() - state.voicesEmptyAt < 30000) return Promise.resolve(first);
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return; done = true;
                ss.removeEventListener && ss.removeEventListener('voiceschanged', finish);
                clearTimeout(timer);
                const list = now();
                if (!list.length) state.voicesEmptyAt = Date.now();
                resolve(list);
            };
            const timer = setTimeout(finish, 1500);
            ss.addEventListener && ss.addEventListener('voiceschanged', finish);
        });
    }

    // Fehlt eine Stimme der Sprache, einmal pro Sprache und Sitzung einen Hinweis zeigen
    function warnMissing(lang, voices) {
        if (state.warned[lang] || !voices.length || !state.notify) return;
        state.warned[lang] = true;
        state.notify('no_voice', lang);
    }

    // ---------------------------------------------------------------------------------------
    // Wiedergabe
    // ---------------------------------------------------------------------------------------
    function playWeb(text, lang, my) {
        const ss = webSynth();
        const s = loadSettings();
        return getVoices().then(voices => new Promise(resolve => {
            if (my !== state.token) return resolve(false);
            const voice = pickVoice(voices, lang, s.voice[lang]);
            if (!voice) warnMissing(lang, voices);
            const parts = splitText(text);
            let i = 0, finished = false;
            const watchdog = setTimeout(() => done(true), text.length * 120 + 2000 + parts.length * 500);
            function done(timedOut) {
                if (finished) return;
                finished = true;
                clearTimeout(watchdog);
                if (state.finish === done) state.finish = null;
                if (timedOut && my === state.token) { try { ss.cancel(); } catch (e) { /* egal */ } }
                resolve(true);
            }
            state.finish = done;
            const next = () => {
                if (finished) return;
                if (my !== state.token || i >= parts.length) return done();
                const u = new window.SpeechSynthesisUtterance(parts[i++]);
                u.lang = TTS_LOCALES[lang];
                if (voice && voice.raw) u.voice = voice.raw;
                u.rate = s.rate;
                state.refs.push(u);                       // Referenz halten (GC-Fehler)
                if (state.refs.length > 20) state.refs.shift();
                u.onend = () => { if (my === state.token) next(); else done(); };
                u.onerror = () => done();
                ss.speak(u);
            };
            next();
        }));
    }

    function playPlugin(p, text, lang, my) {
        const s = loadSettings();
        return getVoices().then(voices => {
            if (my !== state.token) return false;
            const voice = pickVoice(voices, lang, s.voice[lang]);
            if (!voice) warnMissing(lang, voices);
            const payload = { text, lang: TTS_LOCALES[lang], rate: s.rate, pitch: 1.0, volume: 1.0, category: 'ambient', queueStrategy: 0 };
            if (voice && voice.index !== undefined) payload.voice = voice.index;
            let finished = false;
            return new Promise(resolve => {
                const done = () => { if (finished) return; finished = true; clearTimeout(watchdog); if (state.finish === done) state.finish = null; resolve(true); };
                const watchdog = setTimeout(done, text.length * 120 + 2000);
                state.finish = done;
                Promise.resolve(p.speak(payload)).then(done, done);
            });
        });
    }

    function unlockAudio() {
        if (!hasWindow || state.audio) return;
        try {
            const a = new Audio();
            a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
            a.play().catch(() => { /* Entsperren ist nur ein Versuch */ });
            state.audio = a;
        } catch (e) { /* kein Audio */ }
    }

    function playCloud(text, lang, my) {
        const key = `${lang}|${text}`;
        const getBlob = state.blobs.has(key) ? Promise.resolve(state.blobs.get(key)) : Promise.resolve(state.fetchAudio(text, lang)).then(blob => {
            state.blobs.set(key, blob);
            if (state.blobs.size > 40) state.blobs.delete(state.blobs.keys().next().value);
            return blob;
        });
        return getBlob.then(blob => new Promise((resolve, reject) => {
            if (my !== state.token) return resolve(true);
            const a = state.audio || (state.audio = new Audio());
            const url = URL.createObjectURL(blob);
            let finished = false;
            const done = (err) => {
                if (finished) return;
                finished = true;
                clearTimeout(watchdog);
                try { a.pause(); } catch (e) { /* egal */ }
                a.onended = a.onerror = null;
                URL.revokeObjectURL(url);
                if (state.finish === done) state.finish = null;
                err ? reject(err) : resolve(true);
            };
            const watchdog = setTimeout(() => done(), text.length * 150 + 8000);
            state.finish = () => done();
            a.onended = () => done();
            a.onerror = () => done(new Error('audio'));
            a.src = url;
            a.playbackRate = loadSettings().rate;
            Promise.resolve(a.play()).catch(err => done(err || new Error('play')));
        }));
    }

    function play(text, lang, my) {
        if (my !== state.token) return Promise.resolve(false);
        const viaDevice = () => {
            const p = nativePlugin();
            if (p) return playPlugin(p, text, lang, my);
            if (webSynth()) return playWeb(text, lang, my);
            return Promise.resolve(false);
        };
        if (cloudOn()) {
            return playCloud(text, lang, my).catch(err => {
                if (my !== state.token) return false;
                if (state.notify && !state.warned.cloudFailed) { state.warned.cloudFailed = true; state.notify('cloud_failed', lang, err); }
                return viaDevice(); // Fallback auf die Gerätestimme
            });
        }
        return viaDevice();
    }

    // Beendet alles sofort (Epoche hochzählen, Engines anhalten)
    function stop() {
        state.token++;
        const fin = state.finish; state.finish = null;
        try { const ss = webSynth(); if (ss) ss.cancel(); } catch (e) { /* egal */ }
        try { const p = plugin(); if (p) Promise.resolve(p.stop()).catch(() => {}); } catch (e) { /* egal */ }
        try { if (state.audio) state.audio.pause(); } catch (e) { /* egal */ }
        if (fin) fin();
        state.chain = Promise.resolve();
        if (hasWindow && document.querySelectorAll) document.querySelectorAll('.tts-btn.speaking').forEach(b => b.classList.remove('speaking'));
    }

    // text/lang sprechen. opts: { queue } (an die laufende Ausgabe anhängen, z. B. Fremdwort + Deutsch),
    // { epoch } (Sprachwechsel-Epoche; weicht sie ab, wird nichts gesprochen), { rate }.
    function speak(text, lang, opts) {
        opts = opts || {};
        if (!loadSettings().enabled || !LANGS.includes(lang)) return Promise.resolve(false);
        if (opts.epoch !== undefined && state.getEpoch && opts.epoch !== state.getEpoch()) return Promise.resolve(false);
        const t = clean(text, lang);
        if (!t) return Promise.resolve(false);
        if (!available()) return Promise.resolve(false);
        let my;
        if (opts.queue) {
            my = state.token;
        } else {
            try { const ss = webSynth(); if (ss) ss.cancel(); } catch (e) { /* egal */ }   // zuerst abbrechen
            try { const p = plugin(); if (p) Promise.resolve(p.stop()).catch(() => {}); } catch (e) { /* egal */ }
            try { if (state.audio) state.audio.pause(); } catch (e) { /* egal */ }
            const fin = state.finish; state.finish = null; if (fin) fin();
            my = ++state.token;
            state.chain = Promise.resolve();
        }
        const job = state.chain.then(() => play(t, lang, my));
        state.chain = job.catch(() => false);
        return job.catch(() => false);
    }

    // Fremdwort sprechen, danach (Einstellung „Deutsch mitsprechen“) die deutsche Seite per Queue
    function speakEntry(entry, ctx, opts) {
        opts = opts || {};
        const foreign = prepare(entry, 'it', ctx);
        const de = loadSettings().speakDe && opts.withDe !== false ? prepare(entry, 'de', ctx) : null;
        if (!foreign) return Promise.resolve(false);
        const first = speak(foreign.text, foreign.lang, opts);
        if (de) speak(de.text, 'de', { queue: true, epoch: opts.epoch });
        return first;
    }

    // Automatisches Vorlesen: nur wenn eingeschaltet und der Nutzer die Seite schon bedient hat (Autoplay-Regel)
    let gestureSeen = false;
    const hasGesture = () => gestureSeen || !!(hasWindow && navigator.userActivation && navigator.userActivation.hasBeenActive);
    function autoAllowed() { const s = loadSettings(); return s.enabled && s.auto && hasGesture() && available(); }

    // ---------------------------------------------------------------------------------------
    // Knöpfe: HTML + ein delegierter Klick-Handler
    // ---------------------------------------------------------------------------------------
    const attr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

    // data: { text, lang, de } direkter Text; oder { src: 'vocab'|'sentence', id } (Text wird beim Klick aufgelöst)
    function buttonHtml(data, extraClass) {
        if (!available()) return '';
        const label = attr(state.label ? state.label() : 'Vorlesen');
        const parts = data.id !== undefined
            ? `data-tts-src="${attr(data.src)}" data-tts-id="${attr(data.id)}"`
            : `data-tts-text="${attr(data.text)}" data-tts-lang="${attr(data.lang)}"${data.de ? ` data-tts-de="${attr(data.de)}"` : ''}`;
        return `<button type="button" class="tts-btn${extraClass ? ' ' + extraClass : ''}" ${parts} aria-label="${label}" title="${label}">${ICON}</button>`;
    }

    function onClick(e) {
        const btn = e.target.closest && e.target.closest('.tts-btn');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();   // Karteikarte, Listenzeile usw. sollen nicht mitreagieren
        let item = null;
        if (btn.dataset.ttsId !== undefined) item = state.resolveById ? state.resolveById(btn.dataset.ttsSrc, btn.dataset.ttsId) : null;
        else item = { text: btn.dataset.ttsText, lang: btn.dataset.ttsLang, de: btn.dataset.ttsDe };
        if (!item || !item.text) return;
        btn.classList.add('speaking');
        speak(item.text, item.lang).then(() => btn.classList.remove('speaking'));
        if (item.de && loadSettings().speakDe) speak(item.de, 'de', { queue: true });
    }

    // Erste Bedienung: Audio entsperren und (nur bei Auto-Vorlesen) die Web-Sprachausgabe leise „anwärmen“,
    // damit spätere automatische Ausgaben nach einem Timer erlaubt sind (iOS/Safari)
    function onFirstGesture() {
        gestureSeen = true;
        const s = loadSettings();
        if (s.enabled && s.auto) {
            if (cloudOn()) unlockAudio();
            const ss = webSynth();
            if (ss && !nativePlugin()) { try { const u = new window.SpeechSynthesisUtterance('.'); u.volume = 0; ss.speak(u); } catch (e) { /* egal */ } }
        }
    }

    function init(opts) {
        Object.assign(state, opts || {});
        if (!hasWindow) return;
        document.addEventListener('click', onClick, true);   // Capture: vor allen Handlern der Zeile/Karte
        ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, function once() {
            document.removeEventListener(ev, once, true); onFirstGesture();
        }, true));
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stop(); });
        window.addEventListener('pagehide', stop);
    }

    const Tts = {
        TTS_LOCALES, ABBREVIATIONS, DEFAULT_SETTINGS,
        clean, prepare, splitText, pickVoice, hasGap,
        speak, speakEntry, stop, available, autoAllowed, buttonHtml, getVoices, init,
        getSettings: loadSettings, setSettings, unlockAudio,
        _state: state, _resetForTests() { state.settings = null; state.voices = null; state.voicesEmptyAt = 0; state.warned = {}; state.token++; state.chain = Promise.resolve(); state.blobs.clear(); }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = Tts;
    else root.Tts = Tts;
})(typeof window !== 'undefined' ? window : globalThis);
