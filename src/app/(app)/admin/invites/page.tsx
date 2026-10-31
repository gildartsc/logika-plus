import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { InviteGenerator } from "@/components/admin/InviteGenerator";
import { PageFallback } from "@/components/PageFallback";
import { APP_TIME_ZONE } from "@/config/ai";
import { deleteInvite } from "@/lib/admin/actions";
import { listInvitesAdmin } from "@/lib/admin/queries";
import { formatInviteCode } from "@/lib/invites/code";

export const metadata: Metadata = { title: "Коды приглашения" };

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function AdminInvitesPage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Коды приглашения</h1>
        <p className="mt-1 text-sm text-stone-600">
          Ученик вводит код при регистрации. Каждый код работает один раз, потом становится недействительным.
        </p>
      </div>
      <InviteGenerator />
      <Suspense fallback={<PageFallback />}>
        <InvitesTable />
      </Suspense>
    </section>
  );
}

async function InvitesTable() {
  const invites = await listInvitesAdmin();
  if (invites.length === 0) return <p className="text-stone-600">Кодов пока нет.</p>;
  const free = invites.filter((invite) => !invite.usedAt).length;
  return (
    <div>
      <p className="mb-2 text-sm text-stone-600">
        Свободных кодов: {free} из {invites.length}
      </p>
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-4 py-2 font-medium">Код</th>
              <th className="px-4 py-2 font-medium">Подпись</th>
              <th className="px-4 py-2 font-medium">Создан</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {invites.map((invite) => (
              <tr key={invite.code}>
                <td className="px-4 py-2 font-mono font-semibold whitespace-nowrap">{formatInviteCode(invite.code)}</td>
                <td className="px-4 py-2 text-stone-600">{invite.note || "—"}</td>
                <td className="px-4 py-2 whitespace-nowrap text-stone-600">{dateFormat.format(new Date(invite.createdAt))}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {!invite.usedAt ? (
                    <span className="text-emerald-700">свободен</span>
                  ) : invite.usedBy && invite.student ? (
                    <span className="text-stone-600">
                      использован:{" "}
                      <Link href={`/admin/students/${invite.usedBy}`} className="text-brand-700 hover:underline">
                        {invite.student.name}
                        {invite.student.class && `, ${invite.student.class}`}
                      </Link>
                      , {dateFormat.format(new Date(invite.usedAt))}
                    </span>
                  ) : (
                    <span className="text-stone-500">использован, {dateFormat.format(new Date(invite.usedAt))}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {!invite.usedAt && (
                    <ConfirmButton
                      label="Удалить"
                      confirmLabel="Да, удалить"
                      warning="Ученик с этим кодом не сможет зарегистрироваться."
                      action={deleteInvite.bind(null, invite.code)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
