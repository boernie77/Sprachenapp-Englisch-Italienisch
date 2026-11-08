// Spracheingabe (Diktat) für den Gesprächsmodus.
// Nativ (iPhone/Android): Capacitor-Plugin @capacitor-community/speech-recognition (Gerätefunktion, kein Server, keine KI-Kosten).
// Browser: Web Speech API (Safari/Chrome). Andere Browser: nicht verfügbar, die Oberfläche blendet den Knopf dann aus.
(function (root) {
    'use strict';
    const LOCALES = { it: 'it-IT', en: 'en-GB', es: 'es-ES', de: 'de-DE' };
    const hasWindow = typeof window !== 'undefined';

    function nativePlugin() {
        try {
            return (hasWindow && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
                && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) || null;
        } catch (e) { return null; }
    }
    function webCtor() { return hasWindow ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null; }

    function available() { return !!(nativePlugin() || webCtor()); }

    // Fehlertexte verständlich machen: 'denied' = Zugriff verweigert, 'none' = nichts gehört, sonst Rohtext
    function kind(err) {
        const m = String((err && (err.message || err.error || err)) || '').toLowerCase();
        if (/denied|not-allowed|permission|service-not-allowed|not authorized|restricted/.test(m)) return 'denied';
        if (/no-speech|no speech|no match|nomatch|didn't understand|aborted/.test(m)) return 'none';
        return 'error';
    }

    // Startet das Zuhören. callbacks: onPartial(text), onEnd(finalText, errKind|null).
    // Gibt { stop() } zurück; stop() beendet die Aufnahme, onEnd folgt danach genau einmal.
    async function listen(lang, cb) {
        const locale = LOCALES[lang] || LOCALES.en;
        let last = '', ended = false;
        const finish = (err) => { if (ended) return; ended = true; cb.onEnd && cb.onEnd(last.trim(), err || null); };
        const part = (t) => { last = String(t || ''); cb.onPartial && cb.onPartial(last); };

        const plugin = nativePlugin();
        if (plugin) {
            try {
                let perm = await plugin.checkPermissions();
                if (perm.speechRecognition !== 'granted') perm = await plugin.requestPermissions();
                if (perm.speechRecognition !== 'granted') { finish('denied'); return { stop() {} }; }
                const h1 = await plugin.addListener('partialResults', (d) => part(d && d.matches && d.matches[0]));
                const h2 = await plugin.addListener('listeningState', (d) => {
                    if (d && (d.status === 'stopped' || d.state === 'stopped')) { cleanup(); finish(last ? null : 'none'); }
                });
                const h3 = await plugin.addListener('error', (d) => { cleanup(); finish(last ? null : kind(d)); });
                const cleanup = () => { try { h1.remove(); h2.remove(); h3.remove(); } catch (e) { /* egal */ } };
                try {
                    await plugin.start({ language: locale, maxResults: 1, partialResults: true, popup: false });
                } catch (e) { cleanup(); finish(kind(e)); return { stop() {} }; }
                return { stop() { plugin.stop().catch(() => {}); /* Ende kommt über listeningState; Sicherung: */ setTimeout(() => { cleanup(); finish(last ? null : 'none'); }, 1500); } };
            } catch (e) { finish(kind(e)); return { stop() {} }; }
        }

        const Ctor = webCtor();
        if (!Ctor) { finish('unsupported'); return { stop() {} }; }
        const rec = new Ctor();
        rec.lang = locale; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        rec.onresult = (ev) => {
            let text = '';
            for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
            part(text);
        };
        rec.onerror = (ev) => finish(kind(ev && ev.error));
        rec.onend = () => finish(last ? null : 'none');
        try { rec.start(); } catch (e) { finish(kind(e)); }
        return { stop() { try { rec.stop(); } catch (e) { finish(null); } } };
    }

    const Stt = { LOCALES, available, listen, kind };
    if (typeof module !== 'undefined' && module.exports) module.exports = Stt;
    else root.Stt = Stt;
})(typeof window !== 'undefined' ? window : globalThis);
