import { PublicHeader } from "@/components/PublicHeader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="card w-full max-w-sm overflow-hidden">
          <div aria-hidden className="h-2 bg-brand-500" />
          <div className="p-6">{children}</div>
        </div>
      </main>
    </>
  );
}
