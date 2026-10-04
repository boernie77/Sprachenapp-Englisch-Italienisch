// Adapter für Cloud-Stimmen. Jeder Anbieter bietet:
//   synthesize({ apiKey, text, lang, voice, fetchImpl }) -> Buffer (MP3)
//   defaultVoices                                         -> Standardstimme je Sprache
// `fetchImpl` ist nur für Tests austauschbar; es gibt keine zusätzliche Abhängigkeit (Node 22 hat fetch).

class TtsError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}

const LOCALES = { it: 'it-IT', en: 'en-GB', es: 'es-ES', de: 'de-DE' };
const TIMEOUT_MS = 20000;

async function request(fetchImpl, url, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
        throw new TtsError('Anbieter nicht erreichbar', 502);
    } finally {
        clearTimeout(timer);
    }
}

function mapStatus(res) {
    if (res.status === 401 || res.status === 403 || res.status === 400) return new TtsError('API-Schlüssel ungültig', 400);
    if (res.status === 429) return new TtsError('Anbieter-Limit erreicht, bitte später erneut versuchen', 429);
    return new TtsError(`Fehler beim Anbieter (${res.status})`, 502);
}

const google = {
    label: 'Google Cloud Text-to-Speech',
    // WaveNet-Klasse; Standard-Stimmen (günstiger) heißen it-IT-Standard-A usw., Chirp3-HD z. B. it-IT-Chirp3-HD-Aoede
    defaultVoices: { it: 'it-IT-Wavenet-A', en: 'en-GB-Wavenet-A', es: 'es-ES-Wavenet-B', de: 'de-DE-Wavenet-B' },
    async synthesize({ apiKey, text, lang, voice, fetchImpl = fetch }) {
        const res = await request(fetchImpl, 'https://texttospeech.googleapis.com/v1/text:synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: LOCALES[lang], name: voice },
                audioConfig: { audioEncoding: 'MP3' }
            })
        });
        if (!res.ok) throw mapStatus(res);
        const data = await res.json();
        if (!data || !data.audioContent) throw new TtsError('Leere Antwort des Anbieters', 502);
        return Buffer.from(data.audioContent, 'base64');
    }
};

const openai = {
    label: 'OpenAI (tts-1)',
    defaultVoices: { it: 'alloy', en: 'alloy', es: 'alloy', de: 'alloy' },
    async synthesize({ apiKey, text, voice, fetchImpl = fetch }) {
        const res = await request(fetchImpl, 'https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'tts-1', voice, input: text, response_format: 'mp3' })
        });
        if (!res.ok) throw mapStatus(res);
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length) throw new TtsError('Leere Antwort des Anbieters', 502);
        return buf;
    }
};

module.exports = { PROVIDERS: { google, openai }, TtsError, LOCALES };
