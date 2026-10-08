// Zugriff auf KI- und Stimmenanbieter direkt aus der App (lokaler Betrieb, eigener API-Schlüssel).
// Entspricht server/utils/ai/providers.js und server/utils/tts/providers.js, aber über die REST-Schnittstellen statt der SDKs.
// Die HTTP-Funktion wird übergeben (Gerät: natives HTTP ohne CORS, Browser/Test: fetch):
//   http(url, { method, headers, body }) -> Promise<{ status, json(), arrayBuffer() }>
(function (root) {
    'use strict';

    const core = (typeof module !== 'undefined' && module.exports) ? require('./ai-core') : root.AiCore;

    class AiError extends Error {
        constructor(message, status = 502) { super(message); this.status = status; }
    }

    // Modelle, die den serverseitigen Fallback bei Ablehnungen unterstützen
    const ANTHROPIC_FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);
    const TIMEOUT_MS = 120 * 1000;

    async function errorText(res) {
        try { const j = await res.json(); return (j && (j.error && (j.error.message || j.error))) || ''; } catch (e) { return ''; }
    }

    // Übersetzt Fehlerantworten in verständliche Meldungen für die Oberfläche
    async function mapHttpError(res) {
        if (res.status === 401) return new AiError('API-Schlüssel ungültig', 400);
        if (res.status === 403) return new AiError('Keine Berechtigung für dieses Modell', 400);
        if (res.status === 404) return new AiError('Modell nicht gefunden', 400);
        if (res.status === 429) return new AiError('Anbieter-Limit erreicht, bitte später erneut versuchen', 429);
        if (res.status === 400) return new AiError(`Anfrage abgelehnt: ${await errorText(res)}`, 400);
        return new AiError(`Fehler beim Anbieter (${res.status})`, 502);
    }

    async function call(http, url, init) {
        try { return await http(url, { timeoutMs: TIMEOUT_MS, ...init }); } catch (err) {
            if (err instanceof AiError) throw err;
            throw new AiError('Anbieter nicht erreichbar', 502);
        }
    }

    function create(http) {
        const anthropicHeaders = (apiKey, extra) => ({
            'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true', ...extra
        });

        const anthropic = {
            label: 'Claude (Anthropic)',
            defaultModel: 'claude-opus-5-5',
            suggestedModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'],

            async generateJson({ apiKey, model, system, prompt, schema }) {
                const body = {
                    model, max_tokens: 16000, system,
                    messages: [{ role: 'user', content: prompt }],
                    output_config: { format: { type: 'json_schema', schema }, ...(core.THINKING_MODELS.test(model) ? { effort: 'low' } : {}) }
                };
                const fallback = ANTHROPIC_FALLBACK_MODELS.has(model);
                if (fallback) body.fallbacks = 'default';
                const res = await call(http, 'https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: anthropicHeaders(apiKey, fallback ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
                    body: JSON.stringify(body)
                });
                if (res.status < 200 || res.status >= 300) throw await mapHttpError(res);
                const response = await res.json();
                if (response.stop_reason === 'refusal') throw new AiError('Die KI hat die Anfrage abgelehnt', 422);
                if (response.stop_reason === 'max_tokens') throw new AiError('Antwort der KI war zu lang, bitte weniger Sätze anfordern', 502);
                const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
                try {
                    return { data: JSON.parse(text), usage: { input: (response.usage && response.usage.input_tokens) || 0, output: (response.usage && response.usage.output_tokens) || 0 } };
                } catch (err) {
                    throw new AiError('Antwort der KI war kein gültiges JSON', 502);
                }
            },

            async checkModel({ apiKey, model }) {
                const res = await call(http, `https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, { method: 'GET', headers: anthropicHeaders(apiKey) });
                if (res.status < 200 || res.status >= 300) throw await mapHttpError(res);
            },

            async listModels({ apiKey }) {
                const res = await call(http, 'https://api.anthropic.com/v1/models?limit=1000', { method: 'GET', headers: anthropicHeaders(apiKey) });
                if (res.status < 200 || res.status >= 300) throw await mapHttpError(res);
                const j = await res.json();
                return (j.data || []).map(m => ({ id: m.id, name: m.display_name || m.id }));
            }
        };

        // Nur Chat-Modelle anzeigen, keine Audio-, Bild- oder Embedding-Modelle
        const OPENAI_CHAT_MODEL = /^(gpt-|o\d|chatgpt-)/;
        const OPENAI_EXCLUDED = /(audio|realtime|tts|transcribe|image|embedding|search|instruct|moderation)/;
        const openaiHeaders = (apiKey) => ({ 'content-type': 'application/json', authorization: `Bearer ${apiKey}` });

        const openai = {
            label: 'OpenAI (ChatGPT)',
            defaultModel: 'gpt-5-mini',
            suggestedModels: ['gpt-5-mini', 'gpt-5'],

            async generateJson({ apiKey, model, system, prompt, schema }) {
                const res = await call(http, 'https://api.openai.com/v1/chat/completions', {
                    method: 'POST', headers: openaiHeaders(apiKey),
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
                        response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } }
                    })
                });
                if (res.status < 200 || res.status >= 300) throw await mapHttpError(res);
                const completion = await res.json();
                const choice = completion.choices && completion.choices[0];
                if (!choice) throw new AiError('Leere Antwort der KI', 502);
                if (choice.message && choice.message.refusal) throw new AiError('Die KI hat die Anfrage abgelehnt', 422);
                if (choice.finish_reason === 'length') throw new AiError('Antwort der KI war zu lang, bitte weniger Sätze anfordern', 502);
                try {
                    return { data: JSON.parse(choice.message.content), usage: { input: (completion.usage && completion.usage.prompt_tokens) || 0, output: (completion.usage && completion.usage.completion_tokens) || 0 } };
                } catch (err) {
                    throw new AiError('Antwort der KI war kein gültiges JSON', 502);
                }
            },

            async checkModel({ apiKey, model }) {
                const res = await call(http, `https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { method: 'GET', headers: openaiHeaders(apiKey) });
                if (res.status < 200 || res.status >= 300) throw await mapHttpError(res);
            },

            async listModels({ apiKey }) {
                const res = await call(http, 'https://api.openai.com/v1/models', { method: 'GET', headers: openaiHeaders(apiKey) });
                if (res.status < 200 || res.status >= 300) throw await mapHttpError(res);
                const j = await res.json();
                return (j.data || []).filter(m => OPENAI_CHAT_MODEL.test(m.id) && !OPENAI_EXCLUDED.test(m.id))
                    .map(m => ({ id: m.id, name: m.id })).sort((a, b) => a.id.localeCompare(b.id));
            }
        };

        // ---- Cloudstimmen (wie server/utils/tts/providers.js) ----
        const LOCALES = { it: 'it-IT', en: 'en-GB', es: 'es-ES', de: 'de-DE' };
        const TTS_TIMEOUT_MS = 20000;
        async function ttsCall(url, init) {
            try { return await http(url, { timeoutMs: TTS_TIMEOUT_MS, ...init }); } catch (err) { throw new AiError('Anbieter nicht erreichbar', 502); }
        }
        const ttsStatus = (res) => {
            if (res.status === 401 || res.status === 403 || res.status === 400) return new AiError('API-Schlüssel ungültig', 400);
            if (res.status === 429) return new AiError('Anbieter-Limit erreicht, bitte später erneut versuchen', 429);
            return new AiError(`Fehler beim Anbieter (${res.status})`, 502);
        };
        const b64ToBuffer = (b64) => {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return bytes.buffer;
        };

        const googleTts = {
            label: 'Google Cloud Text-to-Speech',
            defaultVoices: { it: 'it-IT-Wavenet-A', en: 'en-GB-Wavenet-A', es: 'es-ES-Wavenet-B', de: 'de-DE-Wavenet-B' },
            async synthesize({ apiKey, text, lang, voice }) {
                const res = await ttsCall('https://texttospeech.googleapis.com/v1/text:synthesize', {
                    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify({ input: { text }, voice: { languageCode: LOCALES[lang], name: voice }, audioConfig: { audioEncoding: 'MP3' } })
                });
                if (res.status < 200 || res.status >= 300) throw ttsStatus(res);
                const data = await res.json();
                if (!data || !data.audioContent) throw new AiError('Leere Antwort des Anbieters', 502);
                return b64ToBuffer(data.audioContent);
            }
        };

        // gpt-4o-mini-tts nimmt eine Anweisung mit, die die Sprache festlegt (tts-1 riet sie aus dem Text)
        const OPENAI_LANG_NAMES = { it: 'Italian', en: 'British English', es: 'Spanish (Spain)', de: 'German' };
        const openaiInstructions = (lang) => `The text is in ${OPENAI_LANG_NAMES[lang] || lang}, possibly a single word or a short phrase. Pronounce it clearly like a native ${OPENAI_LANG_NAMES[lang] || lang} speaker, with a neutral calm tone, and do not add anything.`;
        const openaiTts = {
            label: 'OpenAI (gpt-4o-mini-tts)',
            cacheVersion: 'mini-tts-1',
            defaultVoices: { it: 'alloy', en: 'alloy', es: 'alloy', de: 'alloy' },
            async synthesize({ apiKey, text, lang, voice }) {
                const res = await ttsCall('https://api.openai.com/v1/audio/speech', {
                    method: 'POST', headers: openaiHeaders(apiKey), binary: true,
                    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: text, instructions: openaiInstructions(lang), response_format: 'mp3' })
                });
                if (res.status < 200 || res.status >= 300) throw ttsStatus(res);
                const buf = await res.arrayBuffer();
                if (!buf || !buf.byteLength) throw new AiError('Leere Antwort des Anbieters', 502);
                return buf;
            }
        };

        return { AI: { anthropic, openai }, TTS: { google: googleTts, openai: openaiTts } };
    }

    const api = { create, AiError };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.AiProviders = api;
})(typeof window !== 'undefined' ? window : globalThis);
