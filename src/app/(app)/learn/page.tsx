import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";
import { getCourse } from "@/lib/learn/data";
import { pickLandingTopic } from "@/lib/learn/progress";

// The (app) layout boundary does not cover client navigations between its
// pages, so every page that reads the session needs its own <Suspense>.
export default function LearnPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <RedirectToCurrentTopic />
    </Suspense>
  );
}

async function RedirectToCurrentTopic() {
  const { topics, statuses } = await getCourse();
  const target = pickLandingTopic(topics, statuses);
  if (!target) {
    return (
      <section className="card p-6">
        <h1 className="text-2xl font-bold text-ink">Темы пока не добавлены</h1>
        <p className="mt-2 text-stone-600">Загляни позже: учитель скоро добавит задания.</p>
      </section>
    );
  }
  redirect(`/learn/${target.order_number}`);
}
