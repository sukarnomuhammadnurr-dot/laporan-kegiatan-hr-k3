import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FilePlus2,
  FileText,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useBrandingUrl, type BrandingKey } from "@/lib/branding";
import { cn } from "@/lib/utils";

type NavItem = {
  to?:
    | "/dashboard"
    | "/buat-laporan"
    | "/laporan"
    | "/monitoring-laporan"
    | "/master-trainer"
    | "/master-materi"
    | "/master-jadwal"
    | "/pesan-whatsapp"
    | "/ubah-password"
    | "/pengaturan-sistem";
  label: string;
  icon: LucideIcon;
};

const NAV_TRAINER: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/buat-laporan", label: "Buat Laporan", icon: FilePlus2 },
  { to: "/laporan", label: "Laporan Saya", icon: FileText },
  { to: "/monitoring-laporan", label: "Laporan Bulanan", icon: BarChart3 },
];

const NAV_STAFF: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/laporan", label: "Semua Laporan", icon: FileText },
  { to: "/buat-laporan", label: "Buat Laporan", icon: FilePlus2 },
  { to: "/monitoring-laporan", label: "Monitoring Laporan", icon: ListChecks },
  { label: "Laporan Bulanan & Export", icon: BarChart3 },
];

const NAV_MASTER: NavItem[] = [
  { to: "/master-trainer", label: "Master Trainer", icon: Users },
  { to: "/master-materi", label: "Master Materi", icon: BookOpen },
  { to: "/master-jadwal", label: "Master Jadwal", icon: CalendarDays },
  { to: "/pesan-whatsapp", label: "Pesan WhatsApp", icon: MessageCircle },
  { to: "/pengaturan-sistem", label: "Pengaturan Sistem", icon: Settings },
];

export function BrandLogo({ className }: { className?: string }) {
  const logo = useBrandingUrl("logo");

  return (
    <div
      className={cn(
        "num grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-xs font-bold text-[#0a1f44]",
        className,
      )}
    >
      {logo ? (
        <img
          src={logo}
          alt="Logo perusahaan"
          className="size-full object-contain p-1"
        />
      ) : (
        "K3"
      )}
    </div>
  );
}

function NavList({
  onNavigate,
  onLogout,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const { isStaff, isAdmin } = useCurrentUser();

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const main = isStaff ? NAV_STAFF : NAV_TRAINER;

  const item = (it: NavItem) => {
    const Icon = it.icon;

    if (!it.to) {
      return (
        <div
          key={it.label}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/40"
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 truncate">{it.label}</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-white/60 uppercase">
            Segera
          </span>
        </div>
      );
    }

    const active = pathname === it.to || pathname.startsWith(it.to + "/");

    return (
      <Link
        key={it.label}
        to={it.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
          active
            ? "bg-[#b91c1c] text-white shadow-lg shadow-red-900/30"
            : "text-white/75 hover:bg-white/10 hover:text-white",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{it.label}</span>
      </Link>
    );
  };

  const heading = (t: string) => (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">
      {t}
    </p>
  );

  return (
    <nav className="space-y-0.5">
      {heading("Menu")}
      {main.map(item)}

      {isStaff && (
        <>
          {heading("Data & Sistem")}
          {(isAdmin
            ? NAV_MASTER
            : NAV_MASTER.filter((n) => n.to !== "/pengaturan-sistem")
          ).map(item)}
        </>
      )}

      {heading("Akun")}

      {item({
        to: "/ubah-password",
        label: "Ubah Password",
        icon: KeyRound,
      })}

      <button
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-white/75 transition-all hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-4" />
        Keluar
      </button>
    </nav>
  );
}

function SidebarInner(props: {
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/dashboard"
        onClick={props.onNavigate}
        className="flex items-center gap-3 px-2 pb-4"
      >
        <BrandLogo />
        <div className="min-w-0">
          <p className="text-sm leading-tight font-semibold text-white">
            Laporan Kegiatan
          </p>
          <p className="text-sm leading-tight font-semibold text-white">
            Trainer K3
          </p>
        </div>
      </Link>

      <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-4">
        <NavList {...props} />
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  superintendent: "Superintendent",
  trainer: "Trainer",
};

export function AppShell({
  title,
  eyebrow,
  description,
  heroKey,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  heroKey?: BrandingKey;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { nama, roles, user, trainer } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const heroImg = useBrandingUrl(heroKey ?? "ilustrasi_k3");
  const bg = useBrandingUrl("background");
  const sidebarBg = useBrandingUrl("sidebar_background");

  const wajibGanti = !!user?.user_metadata?.["wajib_ganti_password"];

  useEffect(() => {
    if (wajibGanti && pathname !== "/ubah-password") {
      navigate({ to: "/ubah-password", replace: true });
    }
  }, [wajibGanti, pathname, navigate]);

  async function keluar() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/masuk", replace: true });
  }

  const role = roles[0] ?? "";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {bg && (
        <div
          className="pointer-events-none fixed inset-0 bg-cover bg-center opacity-[0.06]"
          style={{ backgroundImage: `url(${bg})` }}
        />
      )}

      {/* Sidebar desktop — NAVY GELAP + OPSIONAL BACKGROUND */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden bg-[#0a1f44] px-3 py-5 lg:block">
        {/* Base gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1f44] via-[#0f2a5c] to-[#050f24]" />

        {/* Background image (kalau ada) */}
        {sidebarBg && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-cover bg-center"
            style={{
              backgroundImage: `url(${sidebarBg})`,
              maskImage:
                "linear-gradient(to top, black 0%, black 60%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to top, black 0%, black 60%, transparent 100%)",
              opacity: 0.35,
            }}
          />
        )}

        {/* Overlay biar menu tetap kebaca */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1f44]/70 via-transparent to-[#0a1f44]/85" />

        {/* Decorative blur */}
        <div className="pointer-events-none absolute -bottom-32 -left-32 size-64 rounded-full bg-red-900/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 size-48 rounded-full bg-blue-900/30 blur-3xl" />

        <div className="relative">
          <SidebarInner onLogout={keluar} />
        </div>
      </aside>

      <div className="relative lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  className="grid size-10 place-items-center rounded-lg text-foreground hover:bg-accent lg:hidden"
                  aria-label="Buka menu"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="w-72 overflow-hidden border-none bg-[#0a1f44] p-4"
              >
                <SheetTitle className="sr-only">Navigasi</SheetTitle>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1f44] via-[#0f2a5c] to-[#050f24]" />

                {sidebarBg && (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${sidebarBg})`,
                      maskImage:
                        "linear-gradient(to top, black 0%, black 60%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to top, black 0%, black 60%, transparent 100%)",
                      opacity: 0.35,
                    }}
                  />
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a1f44]/70 via-transparent to-[#0a1f44]/85" />

                <div className="relative">
                  <SidebarInner
                    onNavigate={() => setOpen(false)}
                    onLogout={keluar}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <BrandLogo className="size-9 lg:hidden" />

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-base">
                Laporan Kegiatan Trainer K3
              </p>
              <p className="eyebrow hidden truncate text-[10px] text-muted-foreground sm:block">
                PT IWIP • Modul Pelatihan Keselamatan
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full bg-accent px-3 py-1 text-[11px] font-semibold tracking-wider text-accent-foreground uppercase sm:inline-block">
              {ROLE_LABEL[role] ?? "—"}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-accent">
                <TrainerAvatar nama={nama} foto={trainer?.foto_profil} />

                <span className="hidden max-w-40 truncate text-sm font-medium md:block">
                  {nama}
                </span>

                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate">{nama}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </p>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={() => navigate({ to: "/ubah-password" })}
                >
                  <KeyRound className="size-4" />
                  Ubah Password
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={keluar} className="text-destructive">
                  <LogOut className="size-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={keluar}
              className="hidden items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground xl:flex"
            >
              <LogOut className="size-4" />
              Keluar
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">
          <section className="relative mb-5 overflow-hidden rounded-2xl bg-[#0a1f44] text-white shadow-[var(--shadow-card)]">
            {heroImg && (
              <img
                src={heroImg}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-45"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1f44] via-[#0a1f44]/85 to-transparent" />

            <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 py-7 sm:px-8 sm:py-10">
              <div className="max-w-2xl">
                {eyebrow && (
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-white/80 uppercase">
                    {eyebrow}
                  </p>
                )}

                <h1 className="mt-1.5 text-2xl font-bold sm:text-3xl">
                  {title}
                </h1>

                {description && (
                  <p className="mt-2 text-sm text-white/80 sm:text-base">
                    {description}
                  </p>
                )}
              </div>

              {actions ? (
  <div className="hero-actions flex flex-wrap gap-2">{actions}</div>
) : null}
            </div>
          </section>

          {children}
        </main>
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
        "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
