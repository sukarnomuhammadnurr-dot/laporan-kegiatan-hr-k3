import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Daftar halaman yang sudah tersedia. */
type NavItem = {
  to?:
    | "/dashboard"
    | "/buat-laporan"
    | "/master-trainer"
    | "/ubah-password";
  label: string;
};

const NAV_TRAINER: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/buat-laporan", label: "Buat Laporan" },
  { to: "/laporan", label: "Laporan Saya" },
  { label: "Kalender Kegiatan" },
  { label: "Laporan Bulanan" },
];

const NAV_STAFF: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/laporan", label: "Semua Laporan" },
  { to: "/buat-laporan", label: "Buat Laporan" },
  { label: "Monitoring Laporan" },
  { label: "Kalender Kegiatan" },
  { label: "Laporan Bulanan & Export" },
];

const NAV_MASTER: NavItem[] = [
  { to: "/master-trainer", label: "Master Trainer" },
  { to: "/master-materi", label: "Master Materi" },
  { label: "Master Kegiatan" },
  { label: "Master Jadwal" },
  { label: "Pesan WhatsApp" },
  { label: "Riwayat Perubahan" },
  { label: "Pengaturan Sistem" },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { isStaff } = useCurrentUser();
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const main = isStaff ? NAV_STAFF : NAV_TRAINER;

  const render = (items: NavItem[]) =>
    items.map((item) => {
      if (!item.to) {
        return (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground/60"
          >
            <span>{item.label}</span>
            <span className="eyebrow text-muted-foreground/60">
              segera
            </span>
          </div>
        );
      }

      const active =
        pathname === item.to || pathname.startsWith(item.to + "/");

      return (
        <Link
          key={item.label}
          to={item.to}
          onClick={onNavigate}
          className={cn(
            "block rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <nav className="space-y-1">
      <p className="eyebrow px-3 pb-1 text-muted-foreground">
        Menu
      </p>

      {render(main)}

      {isStaff && (
        <>
          <p className="eyebrow px-3 pt-4 pb-1 text-muted-foreground">
            Data & Sistem
          </p>

          {render(NAV_MASTER)}
        </>
      )}

      <p className="eyebrow px-3 pt-4 pb-1 text-muted-foreground">
        Akun
      </p>

      {render([
        {
          to: "/ubah-password",
          label: "Ubah Password",
        },
      ])}
    </nav>
  );
}

export function AppShell({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { nama, roles, user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const wajibGanti =
    !!user?.user_metadata?.["wajib_ganti_password"];

  useEffect(() => {
    if (
      wajibGanti &&
      pathname !== "/ubah-password"
    ) {
      navigate({
        to: "/ubah-password",
        replace: true,
      });
    }
  }, [wajibGanti, pathname, navigate]);

  const inisial =
    nama
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "??";

  async function keluar() {
    await queryClient.cancelQueries();
    queryClient.clear();

    await supabase.auth.signOut();

    navigate({
      to: "/masuk",
      replace: true,
    });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-primary/20 blur-[120px]" />

        <div className="absolute top-1/3 -right-40 size-[460px] rounded-full bg-status-sent/20 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="glass-strong flex items-center justify-between gap-3 rounded-2xl px-3 py-3 ring-1 ring-foreground/5 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet
              open={open}
              onOpenChange={setOpen}
            >
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Buka menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="w-72 p-4"
              >
                <SheetTitle className="mb-4 text-sm">
                  Navigasi
                </SheetTitle>

                <NavList
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <Link
              to="/dashboard"
              className="flex min-w-0 items-center gap-3"
            >
              <div className="num grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                IW
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm leading-none font-semibold">
                  Laporan Kegiatan Trainer K3
                </p>

                <p className="eyebrow mt-1 truncate text-muted-foreground">
                  PT IWIP · Modul Pelatihan Keselamatan
                </p>
              </div>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="eyebrow hidden rounded-full bg-card/60 px-2.5 py-1 text-muted-foreground ring-1 ring-foreground/5 sm:inline-block">
              {roles[0] ?? "—"}
            </span>

            <button
              onClick={keluar}
              className="hidden rounded-lg bg-card/60 px-3 py-2 text-sm font-medium text-muted-foreground ring-1 ring-foreground/5 transition-colors hover:text-foreground sm:block"
            >
              Keluar
            </button>

            <div className="num grid size-9 shrink-0 place-items-center rounded-full bg-foreground/90 text-xs font-semibold text-background">
              {inisial}
            </div>
          </div>
        </header>

        <div className="mt-4 flex gap-5">
          <aside className="glass hidden w-60 shrink-0 self-start rounded-2xl p-3 ring-1 ring-foreground/5 lg:block">
            <NavList />

            <button
              onClick={keluar}
              className="mt-4 w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Keluar
            </button>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                {eyebrow ? (
                  <p className="eyebrow text-primary">
                    {eyebrow}
                  </p>
                ) : null}

                <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
                  {title}
                </h1>
              </div>

              {actions ? (
                <div className="flex flex-wrap gap-2">
                  {actions}
                </div>
              ) : null}
            </div>

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass rounded-2xl p-4 ring-1 ring-foreground/5 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}
