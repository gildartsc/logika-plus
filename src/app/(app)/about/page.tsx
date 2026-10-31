import type { Metadata } from "next";
import { TOPICS_COUNT } from "@/config/app";

export const metadata: Metadata = { title: "О нас" };

export default function AboutPage() {
  return (
    <section className="card p-6">
      <h1 className="text-2xl font-bold text-ink">О нас</h1>
      <p className="mt-4 text-stone-700">
        Платформа создана в рамках исследовательского проекта о развитии критического и
        инженерного мышления у учеников 9 класса. Здесь {TOPICS_COUNT} темы, задачи и
        ИИ-наставник, который учит рассуждать, а не подсказывает готовые ответы.
      </p>
    </section>
  );
}
