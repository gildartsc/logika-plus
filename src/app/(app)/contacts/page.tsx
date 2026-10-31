import type { Metadata } from "next";

export const metadata: Metadata = { title: "Контакты" };

export default function ContactsPage() {
  return (
    <section className="card p-6">
      <h1 className="text-2xl font-bold text-ink">Контакты</h1>
      <p className="mt-4 text-stone-700">
        По вопросам о платформе обращайтесь к своему учителю.
      </p>
    </section>
  );
}
