// Kostenvorschau für KI-Aufrufe: gemessene Durchschnittswerte, wenn das Modell schon benutzt wurde, sonst eine Schätzung
const { fn, col } = require('sequelize');
const { AiUsage } = require('../../models');
const { costUsd } = require('./pricing');

const THINKING_MODELS = /^claude-(opus|sonnet|fable|mythos)-5/; // denken immer mit (Denktiefe niedrig eingestellt)
const DEFAULT_INPUT = 500;
const TOKENS_PER_SENTENCE = 70;
const THINKING_TOKENS = 400;

// Token und Kosten eines Aufrufs mit `count` Sätzen. Gemessene Werte gelten nur für das aktuell eingestellte Modell.
async function estimateCall(model, count, currentModel) {
    let input = DEFAULT_INPUT;
    let output = TOKENS_PER_SENTENCE * count + (THINKING_MODELS.test(model) ? THINKING_TOKENS : 0);
    let basis = 'estimated';
    if (model === currentModel) {
        const row = await AiUsage.findOne({
            attributes: [[fn('SUM', col('calls')), 'calls'], [fn('SUM', col('inputTokens')), 'input'], [fn('SUM', col('outputTokens')), 'output']],
            raw: true
        });
        const calls = Number(row && row.calls) || 0;
        if (calls >= 5) {
            input = Number(row.input) / calls;
            output = Number(row.output) / calls;
            basis = 'measured';
        }
    }
    return { input, output, costUsd: costUsd(model, input, output), basis };
}

module.exports = { estimateCall };
