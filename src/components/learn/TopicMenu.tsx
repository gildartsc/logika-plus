"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckIcon, CloseIcon, LockIcon, MapIcon } from "@/components/icons";
import { splitIntoBlocks, type TopicStatus } from "@/lib/learn/progress";
import type { MenuTopic } from "./types";

const STATUS_LABELS: Record<TopicStatus, string> = {
  completed: "пройдена",
  current: "открыта",
  locked: "закрыта",
};

// Level node on the topic map: the status is shown by an icon and a label,
// not by color alone.
function LevelNode({ topic }: { topic: MenuTopic }) {
  if (topic.status === "completed") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_3px_0_var(--color-emerald-700)]">
        <CheckIcon className="h-5 w-5" />
      </span>
    );
  }
  if (topic.status === "current") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400 font-extrabold text-ink shadow-[0_3px_0_var(--color-gold-600)] ring-4 ring-gold-100">
        {topic.order}
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-paper text-stone-400">
      <LockIcon className="h-4 w-4" />
    </span>
  );
}

export function TopicMenu({ topics, activeOrder }: { topics: MenuTopic[]; activeOrder: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="btn-secondary px-3 py-2 text-sm"
      >
        <MapIcon className="h-4 w-4" /> Карта тем
      </button>

      {open && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Темы курса">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r-2 border-line bg-paper shadow-xl">
            <div className="flex items-center justify-between border-b-2 border-line px-4 py-3">
              <h2 className="font-extrabold text-ink">Карта тем</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg p-1.5 text-stone-500 hover:bg-white"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
              {splitIntoBlocks(topics.map((t) => ({ ...t, order_number: t.order }))).map((block, blockIndex) => (
                <section key={blockIndex} className="mb-3" aria-labelledby={`topic-block-${blockIndex}`}>
                  <h3
                    id={`topic-block-${blockIndex}`}
                    className="px-2.5 pt-1 pb-2 text-xs font-bold tracking-wide text-stone-500 uppercase"
                  >
                    {blockIndex + 1} четверть · темы {block[0].order}–{block.at(-1)?.order}
                  </h3>
                  <ol>
                    {block.map((topic, index) => (
                      <li key={topic.order} className="relative">
                        {/* Path segment down to the next level of the same block. */}
                        {index < block.length - 1 && (
                          <span aria-hidden className="absolute top-9 left-[30px] h-full w-1 rounded-full bg-line" />
                        )}
                        <TopicItem
                          topic={topic}
                          active={topic.order === activeOrder}
                          onNavigate={() => setOpen(false)}
                        />
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function TopicItem({
  topic,
  active,
  onNavigate,
}: {
  topic: MenuTopic;
  active: boolean;
  onNavigate: () => void;
}) {
  const body = (
    <>
      <span className="relative z-10">
        <LevelNode topic={topic} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{topic.title}</span>
        <span className="block text-xs text-stone-500">
          Тема {topic.order} · {STATUS_LABELS[topic.status]}
        </span>
      </span>
    </>
  );
  const base = "flex items-center gap-3 rounded-xl px-2.5 py-2";

  if (topic.status === "locked") {
    return (
      <span className={`${base} cursor-not-allowed text-stone-400`} aria-disabled="true">
        {body}
      </span>
    );
  }
  return (
    <Link
      href={`/learn/${topic.order}`}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${base} text-ink hover:bg-white ${active ? "bg-white ring-2 ring-brand-200" : ""}`}
    >
      {body}
    </Link>
  );
}
