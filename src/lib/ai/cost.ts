import { MODEL_PRICES, type ModelPrice } from "../../config/ai.ts";
import type { AiUsage } from "./types.ts";

// Unknown models (e.g. a new fallback target) are charged at the highest
// known price so the budget check stays on the safe side.
function priceFor(model: string): ModelPrice {
  const known = MODEL_PRICES[model];
  if (known) return known;
  const all = Object.values(MODEL_PRICES);
  return {
    input: Math.max(...all.map((p) => p.input)),
    output: Math.max(...all.map((p) => p.output)),
    cacheRead: Math.max(...all.map((p) => p.cacheRead)),
    cacheWrite: Math.max(...all.map((p) => p.cacheWrite)),
  };
}

export function computeCostUsd(usage: AiUsage): number {
  const price = priceFor(usage.model);
  const cost =
    usage.input_tokens * price.input +
    usage.output_tokens * price.output +
    usage.cache_read_tokens * price.cacheRead +
    usage.cache_write_tokens * price.cacheWrite;
  return Math.round(cost) / 1_000_000;
}
