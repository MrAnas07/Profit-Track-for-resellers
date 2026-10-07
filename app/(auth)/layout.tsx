import { BrandMark } from "@/components/layout/sidebar";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(16,185,129,0.16), transparent)",
        }}
      />
      <div className="relative flex items-center gap-2.5">
        <BrandMark className="h-9 w-9" />
        <div>
          <p className="text-base font-bold tracking-tight">ProfitTrack</p>
          <p className="text-[11px] text-muted-foreground">
            Reseller profit book
          </p>
        </div>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
