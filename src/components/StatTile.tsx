import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

type Tone = "default" | "verified" | "revision" | "review" | "sent" | "purple";

const TONE_CONFIG: Record<
  Tone,
  {
    bg: string;
    border: string;
    iconBg: string;
    iconFg: string;
    valueText: string;
    arrowBg: string;
  }
> = {
  default: {
    bg: "bg-blue-50/70 dark:bg-blue-950/20",
    border: "border-blue-100 dark:border-blue-900/40",
    iconBg: "bg-blue-500",
    iconFg: "text-white",
    valueText: "text-blue-600 dark:text-blue-400",
    arrowBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  },
  purple: {
    bg: "bg-purple-50/70 dark:bg-purple-950/20",
    border: "border-purple-100 dark:border-purple-900/40",
    iconBg: "bg-purple-500",
    iconFg: "text-white",
    valueText: "text-purple-600 dark:text-purple-400",
    arrowBg:
      "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  },
  verified: {
    bg: "bg-emerald-50/70 dark:bg-emerald-950/20",
    border: "border-emerald-100 dark:border-emerald-900/40",
    iconBg: "bg-emerald-500",
    iconFg: "text-white",
    valueText: "text-emerald-600 dark:text-emerald-400",
    arrowBg:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  review: {
    bg: "bg-amber-50/70 dark:bg-amber-950/20",
    border: "border-amber-100 dark:border-amber-900/40",
    iconBg: "bg-amber-500",
    iconFg: "text-white",
    valueText: "text-amber-600 dark:text-amber-400",
    arrowBg:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  },
  revision: {
    bg: "bg-red-50/70 dark:bg-red-950/20",
    border: "border-red-100 dark:border-red-900/40",
    iconBg: "bg-red-500",
    iconFg: "text-white",
    valueText: "text-red-600 dark:text-red-400",
    arrowBg: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  },
  sent: {
    bg: "bg-sky-50/70 dark:bg-sky-950/20",
    border: "border-sky-100 dark:border-sky-900/40",
    iconBg: "bg-sky-500",
    iconFg: "text-white",
    valueText: "text-sky-600 dark:text-sky-400",
    arrowBg: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
  },
};

const ICON_MAP: Record<string, LucideIcon> = {
  default: FileText,
  purple: Calendar,
  verified: CheckCircle2,
  review: Clock3,
  revision: AlertCircle,
  sent: CalendarDays,
};

type StatTileProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
  onClick?: () => void;
  /** Kalau diisi, kartu jadi link ke route ini */
  to?: string;
  /** Query params saat klik (dipakai bareng `to`) */
  search?: Record<string, string | undefined>;
};

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon,
  onClick,
  to,
  search,
}: StatTileProps) {
  const config = TONE_CONFIG[tone];
  const Icon = icon ?? ICON_MAP[tone] ?? FileText;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground/70">{label}</p>

          <p
            className={cn(
              "num mt-2 text-3xl leading-none font-bold",
              config.valueText,
            )}
          >
            {value}
          </p>

          {hint ? (
            <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
          ) : (
            <div className="mt-2 h-4" />
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3">
          <div
            className={cn(
              "grid size-9 place-items-center rounded-full",
              config.iconBg,
              config.iconFg,
            )}
          >
            <Icon className="size-4.5" />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "absolute right-3 bottom-3 grid size-7 place-items-center rounded-full",
          config.arrowBg,
        )}
      >
        <ArrowRight className="size-3.5" />
      </div>
    </>
  );

  const baseClassName = cn(
    "relative overflow-hidden rounded-2xl border p-4 transition-all",
    config.bg,
    config.border,
    (onClick || to) && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
  );

  // Kalau ada `to` → jadi link
  if (to) {
    return (
      <Link
        to={to}
        search={search as any}
        className={baseClassName}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  // Kalau cuma `onClick` → jadi button-like div
  return (
    <div className={baseClassName} onClick={onClick}>
      {content}
    </div>
  );
}
