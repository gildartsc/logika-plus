import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";
import { BulbIcon, ChartIcon, ChatIcon, CheckIcon, SearchIcon, XpCoin } from "@/components/icons";
import { Avatar } from "@/components/profile/Avatar";
import { ProgressRing } from "@/components/profile/ProgressRing";
import { APP_TIME_ZONE } from "@/config/ai";
import { getCourse } from "@/lib/learn/data";
import { computeProfileStats } from "@/lib/learn/stats";

export const metadata: Metadata = { title: "Личный кабинет" };

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Личный кабинет</h1>
      <Suspense fallback={<PageFallback text="Загружаем профиль…" />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

async function ProfileContent() {
  const { profile, topics } = await getCourse();
  const stats = computeProfileStats(topics);
  const solvedTotal = stats.solvedByType.critical + stats.solvedByType.engineering;

  return (
    <>
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar id={profile.id} name={profile.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl font-extrabold text-ink">{profile.name}</p>
          <span className="chip mt-1 bg-paper text-stone-600 ring-2 ring-line">
            {profile.class ? `Класс: ${profile.class}` : "Класс не указан"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border-2 border-gold-300 bg-gold-100 px-4 py-2">
          <XpCoin className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-2xl font-extrabold text-ink">{profile.total_points.toLocaleString("ru-RU")}</p>
            <p className="text-xs font-semibold text-gold-800">XP</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <section className="card flex items-center justify-center p-5">
          <ProgressRing done={stats.completedTopics} total={stats.totalTopics} />
        </section>

        <section className="card p-5">
          <h2 className="font-extrabold text-ink">Статистика</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat icon={CheckIcon} tone="bg-emerald-100 text-emerald-700" label="Решено задач" value={solvedTotal} />
            <Stat icon={SearchIcon} tone="bg-brand-100 text-brand-700" label="Критическое мышление" value={stats.solvedByType.critical} />
            <Stat icon={ChartIcon} tone="bg-brand-100 text-brand-700" label="Инженерное мышление" value={stats.solvedByType.engineering} />
            <Stat icon={BulbIcon} tone="bg-gold-100 text-gold-800" label="Открыто подсказок" value={stats.hintsUsed} />
            <Stat icon={ChatIcon} tone="bg-stone-100 text-stone-700" label="Сообщений наставнику" value={stats.aiMessages} />
          </dl>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-extrabold text-ink">История решений</h2>
        {stats.history.length === 0 ? (
          <p className="mt-3 text-stone-600">
            Пока нет пройденных тем.{" "}
            <Link href="/learn" className="font-semibold text-brand-600 hover:underline">
              Перейти к задачам
            </Link>
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {stats.history.map((entry) => (
              <li key={entry.order}>
                <Link
                  href={`/learn/${entry.order}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_3px_0_var(--color-emerald-700)]">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 font-semibold text-ink">
                    {entry.order}. {entry.title}
                  </span>
                  <time dateTime={entry.completedAt} className="chip bg-paper text-stone-600">
                    {dateFormat.format(new Date(entry.completedAt))}
                  </time>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: (props: { className?: string }) => React.ReactNode;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border-2 border-line bg-paper p-3">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <dd className="mt-2 text-2xl font-extrabold text-ink">{value}</dd>
      <dt className="text-xs text-stone-500">{label}</dt>
    </div>
  );
}
