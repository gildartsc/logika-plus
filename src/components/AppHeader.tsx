import { requireUser } from "@/lib/auth/guards";
import { XpCoin } from "./icons";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

export async function AppHeader() {
  const profile = await requireUser();
  const points = profile.total_points.toLocaleString("ru-RU");

  return (
    <HeaderFrame>
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1.5 rounded-full border-2 border-gold-300 bg-gold-100 py-1 pr-3 pl-1.5 text-sm font-bold text-gold-800"
          title="Твои баллы"
        >
          <XpCoin />
          {points} XP
        </span>
        <UserMenu isAdmin={profile.role === "admin"} />
      </div>
    </HeaderFrame>
  );
}

export function AppHeaderFallback() {
  return (
    <HeaderFrame>
      <div className="h-8 w-28 animate-pulse rounded-full bg-line" />
    </HeaderFrame>
  );
}

function HeaderFrame({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-line bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Logo href="/learn" />
        {children}
      </div>
    </header>
  );
}
