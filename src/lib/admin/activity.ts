// Students with any activity at or after `since`.
export function countActiveSince(
  activity: { user_id: string; last_activity: string }[],
  studentIds: ReadonlySet<string>,
  since: Date,
): number {
  return activity.filter(
    (row) => studentIds.has(row.user_id) && Date.parse(row.last_activity) >= since.getTime(),
  ).length;
}

export function budgetLevel(spendUsd: number, budgetUsd: number): "ok" | "warning" | "exceeded" {
  if (spendUsd >= budgetUsd) return "exceeded";
  if (spendUsd >= budgetUsd * 0.8) return "warning";
  return "ok";
}
