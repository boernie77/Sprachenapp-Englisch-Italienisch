// Adapter für die KI-Anbieter. Jeder Adapter bietet dieselben drei Funktionen:
//   generateJson({ apiKey, model, system, prompt, schema }) -> geparstes JSON-Objekt
//   checkModel({ apiKey, model })                           -> wirft bei ungültigem Schlüssel/Modell
//   listModels({ apiKey })                                  -> [{ id, name }]
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

class AiError extends Error {
    constructor(message, status = 502) {
        super(message);
        this.status = status;
    }
}

// Übersetzt SDK-Fehler in verständliche Meldungen für die Oberfläche
const mapSdkError = (err, SdkModule) => {
    if (err instanceof AiError) return err;
    if (err instanceof SdkModule.AuthenticationError) return new AiError('API-Schlüssel ungültig', 400);
    if (err instanceof SdkModule.PermissionDeniedError) return new AiError('Keine Berechtigung für dieses Modell', 400);
    if (err instanceof SdkModule.NotFoundError) return new AiError('Modell nicht gefunden', 400);
    if (err instanceof SdkModule.RateLimitError) return new AiError('Anbieter-Limit erreicht, bitte später erneut versuchen', 429);
    if (err instanceof SdkModule.BadRequestError) return new AiError(`Anfrage abgelehnt: ${err.message}`, 400);
    if (err instanceof SdkModule.APIConnectionError) return new AiError('Anbieter nicht erreichbar', 502);
    if (err instanceof SdkModule.APIError) return new AiError(`Fehler beim Anbieter (${err.status})`, 502);
    return err;
};

// Modelle, die den serverseitigen Fallback bei Ablehnungen unterstützen
const ANTHROPIC_FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

const anthropic = {
    label: 'Claude (Anthropic)',
    defaultModel: 'claude-opus-5-5',
    suggestedModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'],

    async generateJson({ apiKey, model, system, prompt, schema }) {
        const client = new Anthropic({ apiKey, timeout: 120 * 1000, maxRetries: 1 });
        const params = {
            model,
            max_tokens: 16000,
            system,
            messages: [{ role: 'user', content: prompt }],
            output_config: { format: { type: 'json_schema', schema } }
        };
        try {
            const response = ANTHROPIC_FALLBACK_MODELS.has(model)
                ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
                : await client.messages.create(params);

            if (response.stop_reason === 'refusal') throw new AiError('Die KI hat die Anfrage abgelehnt', 422);
            if (response.stop_reason === 'max_tokens') throw new AiError('Antwort der KI war zu lang, bitte weniger Sätze anfordern', 502);
            const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
            return JSON.parse(text);
        } catch (err) {
            if (err instanceof SyntaxError) throw new AiError('Antwort der KI war kein gültiges JSON', 502);
            throw mapSdkError(err, Anthropic);
        }
    },

    async checkModel({ apiKey, model }) {
        try {
            await new Anthropic({ apiKey }).models.retrieve(model);
        } catch (err) {
            throw mapSdkError(err, Anthropic);
        }
    },

    async listModels({ apiKey }) {
        try {
            const models = [];
            for await (const m of new Anthropic({ apiKey }).models.list()) {
                models.push({ id: m.id, name: m.display_name || m.id });
            }
            return models;
        } catch (err) {
            throw mapSdkError(err, Anthropic);
        }
    }
};

// Nur Chat-Modelle anzeigen, keine Audio-, Bild- oder Embedding-Modelle
const OPENAI_CHAT_MODEL = /^(gpt-|o\d|chatgpt-)/;
const OPENAI_EXCLUDED = /(audio|realtime|tts|transcribe|image|embedding|search|instruct|moderation)/;

const openai = {
    label: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-5-mini',
    suggestedModels: ['gpt-5-mini', 'gpt-5'],

    async generateJson({ apiKey, model, system, prompt, schema }) {
        const client = new OpenAI({ apiKey, timeout: 120 * 1000, maxRetries: 1 });
        try {
            const completion = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } }
            });
            const choice = completion.choices[0];
            if (!choice) throw new AiError('Leere Antwort der KI', 502);
            if (choice.message.refusal) throw new AiError('Die KI hat die Anfrage abgelehnt', 422);
            if (choice.finish_reason === 'length') throw new AiError('Antwort der KI war zu lang, bitte weniger Sätze anfordern', 502);
            return JSON.parse(choice.message.content);
        } catch (err) {
            if (err instanceof SyntaxError) throw new AiError('Antwort der KI war kein gültiges JSON', 502);
            throw mapSdkError(err, OpenAI);
        }
    },

    async checkModel({ apiKey, model }) {
        try {
            await new OpenAI({ apiKey }).models.retrieve(model);
        } catch (err) {
            throw mapSdkError(err, OpenAI);
        }
    },

    async listModels({ apiKey }) {
        try {
            const models = [];
            for await (const m of new OpenAI({ apiKey }).models.list()) {
                if (OPENAI_CHAT_MODEL.test(m.id) && !OPENAI_EXCLUDED.test(m.id)) models.push({ id: m.id, name: m.id });
            }
            return models.sort((a, b) => a.id.localeCompare(b.id));
        } catch (err) {
            throw mapSdkError(err, OpenAI);
        }
    }
};

const PROVIDERS = { anthropic, openai };

module.exports = { PROVIDERS, AiError };
