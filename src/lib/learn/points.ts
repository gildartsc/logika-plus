import { POINTS_TIERS } from "@/config/points";

export function pointsForSolve(aiMessages: number): number {
  const count = Math.max(0, Math.trunc(aiMessages));
  const tier = POINTS_TIERS.find((t) => count <= t.maxAiMessages);
  return tier?.points ?? 0;
}
