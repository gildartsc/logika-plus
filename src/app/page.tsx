import Link from "next/link";
import { ArrowIcon, ChatIcon, CheckIcon, MapIcon, SearchIcon } from "@/components/icons";
import { LogoMark } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";
import { APP_NAME, TOPICS_COUNT } from "@/config/app";

const FEATURES = [
  {
    icon: MapIcon,
    title: `${TOPICS_COUNT} темы`,
    text: "Темы открываются блоками по четвертям: реши все темы блока, и откроется следующий.",
    tone: "bg-brand-100 text-brand-700",
  },
  {
    icon: SearchIcon,
    title: "Два вида задач",
    text: "В каждой теме задача на критическое и задача на инженерное мышление.",
    tone: "bg-gold-100 text-gold-800",
  },
  {
    icon: ChatIcon,
    title: "ИИ-наставник",
    text: "Не даёт готовый ответ, а задаёт вопросы, которые помогают думать.",
    tone: "bg-emerald-100 text-emerald-800",
  },
];

const STEPS = [
  "Прочитай задачу и попробуй решить её сам.",
  "Застрял? Открой одну из трёх подсказок.",
  "Спроси наставника. Он укажет на ошибку в рассуждении или задаст наводящий вопрос.",
  "Напиши ответ своими словами, объясни ход мысли и нажми «Отправить».",
];

// The hero illustration repeats what students actually do: sort claims
// into facts, opinions and claims that need checking.
function ClaimCards() {
  const cards = [
    { chip: "факт", tone: "bg-brand-100 text-brand-700", claim: "«В банке 250 мл»", note: "можно проверить по этикетке", place: "-rotate-2 sm:mr-16" },
    { chip: "мнение", tone: "bg-gold-100 text-gold-800", claim: "«Самый вкусный напиток года»", note: "у каждого свой вкус", place: "rotate-1 sm:ml-16" },
    { chip: "нужно проверить", tone: "bg-red-50 text-red-700", claim: "«Учёные доказали…»", note: "какие учёные? где исследование?", place: "-rotate-1 sm:mr-8" },
  ];
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-sm flex-col gap-3 select-none">
      {cards.map((card) => (
        <div key={card.chip} className={`card p-4 ${card.place}`}>
          <span className={`chip ${card.tone}`}>
            {card.chip === "факт" && <CheckIcon className="h-3.5 w-3.5" />}
            {card.chip}
          </span>
          <p className="mt-2 font-semibold text-ink">{card.claim}</p>
          <p className="mt-0.5 text-sm text-stone-500">{card.note}</p>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <PublicHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="chip bg-white text-stone-600 ring-2 ring-line">для 9 класса</span>
            <h1 className="mt-4 text-4xl leading-[1.1] font-extrabold tracking-tight text-ink sm:text-5xl">
              Прокачай <span className="text-brand-500">критическое</span> и{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">инженерное</span>
                <span aria-hidden className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded bg-gold-300/70" />
              </span>{" "}
              мышление
            </h1>
            <p className="mt-5 max-w-xl text-lg text-stone-600">
              {TOPICS_COUNT} темы и ИИ-наставник, который не подсказывает ответ, а помогает дойти до него самому.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3 text-base">
                Начать <ArrowIcon className="h-5 w-5" />
              </Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">
                У меня есть аккаунт
              </Link>
            </div>
          </div>
          <ClaimCards />
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-14 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, tone }) => (
            <div key={title} className="card p-5">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
              <p className="mt-1.5 text-stone-600">{text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="card p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold text-ink">Как работать с наставником</h2>
            <ol className="relative mt-6 space-y-5">
              <span aria-hidden className="absolute top-2 bottom-2 left-[17px] w-0.5 bg-line" />
              {STEPS.map((step, index) => (
                <li key={step} className="relative flex gap-4">
                  <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400 font-extrabold text-ink shadow-[0_3px_0_var(--color-gold-600)]">
                    {index + 1}
                  </span>
                  <span className="pt-1.5 text-stone-700">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 rounded-xl bg-paper px-4 py-3 text-sm text-stone-600">
              Не пиши в чат личные данные: фамилию, телефон, адрес.
            </p>
          </div>
        </section>
      </main>
      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-6 text-sm text-stone-500">
          <LogoMark />
          <span>{APP_NAME} — платформа для развития мышления. Исследовательский проект.</span>
        </div>
      </footer>
    </>
  );
}
