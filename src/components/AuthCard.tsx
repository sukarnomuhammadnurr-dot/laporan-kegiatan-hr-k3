import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 size-[460px] rounded-full bg-status-sent/25 blur-[120px]" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="glass-strong rounded-2xl p-6 ring-1 ring-foreground/5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="num grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">IW</div>
            <div>
              <p className="text-sm leading-tight font-semibold">Laporan Kegiatan Trainer K3</p>
              <p className="eyebrow text-muted-foreground">PT IWIP</p>
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
