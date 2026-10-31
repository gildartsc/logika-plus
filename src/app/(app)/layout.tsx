import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";
import { AppHeader, AppHeaderFallback } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth/guards";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<AppHeaderFallback />}>
        <AppHeader />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<PageFallback />}>
          <UserGate>{children}</UserGate>
        </Suspense>
      </main>
    </>
  );
}

// Every page in this group requires a signed-in, non-blocked user.
async function UserGate({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
