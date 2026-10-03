// Listenpreise in US-Dollar pro 1 Million Token [Eingabe, Ausgabe] (Stand 2026-09, Anthropic-Preisliste).
// Unbekannte Modelle (z.B. OpenAI) haben keinen Preis: dort werden nur Token gezählt.
const PRICES = [
    [/^claude-(fable|mythos)/, 10, 50],
    [/^claude-opus-5-5/, 4, 20],
    [/^claude-opus-(5|4)/, 5, 25],
    [/^claude-sonnet-5/, 2, 10],
    [/^claude-sonnet-4/, 3, 15],
    [/^claude-haiku-4-5/, 1, 5]
];

// Kosten in USD oder null, wenn das Modell nicht in der Preisliste steht
function costUsd(model, inputTokens, outputTokens) {
    const entry = PRICES.find(([pattern]) => pattern.test(model || ''));
    if (!entry) return null;
    return (inputTokens * entry[1] + outputTokens * entry[2]) / 1e6;
}

module.exports = { costUsd };
