// costTracker.js — BridgeMAIde
// Logs token usage and cost for every Claude API call
// Wire into server.js: import { track, summary } from './costTracker.js';

const PRICING = {
  input: 3.00 / 1_000_000,   // Sonnet 4 — $3/M input tokens
  output: 15.00 / 1_000_000, // Sonnet 4 — $15/M output tokens
};

const session = { input: 0, output: 0, calls: 0, cost: 0 };
const WARN_THRESHOLD = parseFloat(process.env.COST_WARN_THRESHOLD || '0.05');

export function track(usage, label = 'API call') {
  const { input_tokens, output_tokens } = usage;
  const cost = (input_tokens * PRICING.input) + (output_tokens * PRICING.output);

  session.input += input_tokens;
  session.output += output_tokens;
  session.calls += 1;
  session.cost += cost;

  console.log(`[cost] ${label} — in:${input_tokens} out:${output_tokens} $${cost.toFixed(5)}`);
  console.log(`[cost] session total — ${session.calls} calls $${session.cost.toFixed(4)}`);

  if (cost > WARN_THRESHOLD) {
    console.warn(`[cost] WARNING: single request exceeded threshold ($${cost.toFixed(5)} > $${WARN_THRESHOLD})`);
  }

  return cost;
}

export function summary() {
  return {
    calls: session.calls,
    inputTokens: session.input,
    outputTokens: session.output,
    totalCost: parseFloat(session.cost.toFixed(4)),
    perSearchAvg: session.calls > 0
      ? parseFloat((session.cost / Math.ceil(session.calls / 8)).toFixed(4))
      : 0, // BridgeMAIde makes ~8 calls per search
  };
}

export function reset() {
  session.input = 0;
  session.output = 0;
  session.calls = 0;
  session.cost = 0;
}
