import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { BudgetBanner } from "@/components/admin/BudgetBanner";
import { PageFallback } from "@/components/PageFallback";
import { requireAdmin } from "@/lib/auth/guards";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AdminGate>
        <AdminNav />
        <Suspense fallback={null}>
          <BudgetBanner />
        </Suspense>
        {children}
      </AdminGate>
    </Suspense>
  );
}

// Entry gate only. Every admin page, action and export calls requireAdmin()
// itself, because this layout does not re-run on navigation between them.
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
