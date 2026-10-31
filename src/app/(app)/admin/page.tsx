import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";
import { getDashboard } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Админ-панель" };

export default function AdminDashboardPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold text-ink">Дашборд</h1>
      <Suspense fallback={<PageFallback />}>
        <Dashboard />
      </Suspense>
    </section>
  );
}

async function Dashboard() {
  const { studentsTotal, activeToday, budget } = await getDashboard();
  return (
    <dl className="mt-4 grid gap-4 sm:grid-cols-3">
      <Tile label="Учеников зарегистрировано" value={String(studentsTotal)} />
      <Tile label="Активны сегодня" value={String(activeToday)} hint="писали наставнику или отправляли ответ" />
      <Tile
        label="Расход на ИИ в этом месяце"
        value={`$${budget.spendUsd.toFixed(2)}`}
        hint={`из $${budget.budgetUsd}`}
      />
    </dl>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="mt-1 text-3xl font-bold text-ink">{value}</dd>
      {hint && <dd className="text-xs text-stone-500">{hint}</dd>}
    </div>
  );
}
