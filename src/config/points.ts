// XP for a solved task by the number of mentor messages before the correct
// answer (SPEC section 6). Tiers are checked in order.
export const POINTS_TIERS = [
  { maxAiMessages: 2, points: 100 },
  { maxAiMessages: 5, points: 70 },
  { maxAiMessages: Number.POSITIVE_INFINITY, points: 40 },
] as const;
