import { getBudgetStatus } from "@/lib/admin/queries";

// The monthly-budget notification for the admin (SPEC section 2).
export async function BudgetBanner() {
  const { spendUsd, budgetUsd, level } = await getBudgetStatus();
  if (level === "ok") return null;

  const spent = `$${spendUsd.toFixed(2)} из $${budgetUsd}`;
  return level === "exceeded" ? (
    <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <strong>Месячный бюджет на ИИ исчерпан ({spent}).</strong> Чат с наставником и проверка ответов
      отключены до начала следующего месяца или до увеличения бюджета в <code>src/config/ai.ts</code>.
    </p>
  ) : (
    <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>Израсходовано больше 80% месячного бюджета на ИИ ({spent}).</strong> При исчерпании чат и
      проверка ответов отключатся.
    </p>
  );
}
