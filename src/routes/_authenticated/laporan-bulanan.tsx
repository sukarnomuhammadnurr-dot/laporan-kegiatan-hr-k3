import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  ImageIcon,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/useAuth";
import {
  fetchReports,
  hapusLaporanPermanent,
  type ReportWithTrainer,
} from "@/lib/queries";
import {
  getReportPhotos,
  getReportPhotosBatch,
  type ReportPhoto,
} from "@/lib/report-photos";
import { cn } from "@/lib/utils";
import { useBrandingUrl } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/laporan-bulanan")({
  head: () => ({
    meta: [
      { title: "Laporan Bulanan · Laporan Kegiatan Trainer K3 PT IWIP" },
      {
        name: "description",
        content:
          "Lihat dan download laporan bulanan kegiatan trainer K3 PT IWIP.",
      },
    ],
  }),
  component: LaporanBulananPage,
});

const DEPARTEMEN_LABEL = "HR K3";
const PER_HALAMAN = 10;

type FilterStatus =
  | "semua"
  | "terkirim"
  | "menunggu_verifikasi"
  | "terverifikasi"
  | "perlu_revisi";

/* =========================================================
   HELPER BULAN
========================================================= */

function bulanIni() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function awalBulan(yyyymm: string) {
  return `${yyyymm}-01`;
}

function akhirBulan(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return `${yyyymm}-${String(last).padStart(2, "0")}`;
}

function labelBulan(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function labelBulanPendek(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("id-ID", {
    month: "short",
    year: "numeric",
  });
}

function listBulan(startYear = 2026, endYear = 2040) {
  const result: string[] = [];
  for (let y = endYear; y >= startYear; y--) {
    for (let m = 12; m >= 1; m--) {
      result.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return result;
}

function formatTanggal(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTanggalPanjang(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function namaBulan(value: string) {
  if (!value) return "";
  return new Date(`${value}-01T00:00:00`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   STATUS PILL
========================================================= */

function StatusPill({ status }: { status: string | null | undefined }) {
  const config =
    status === "terverifikasi"
      ? {
          label: "Terverifikasi",
          className:
            "bg-status-verified/15 text-status-verified border-status-verified/20",
          dot: "bg-status-verified",
        }
      : status === "perlu_revisi"
        ? {
            label: "Perlu Revisi",
            className: "bg-destructive/10 text-destructive border-destructive/20",
            dot: "bg-destructive",
          }
        : status === "menunggu_verifikasi"
          ? {
              label: "Menunggu Verifikasi",
              className:
                "bg-status-warning/15 text-status-warning border-status-warning/20",
              dot: "bg-status-warning",
            }
          : status === "terkirim"
            ? {
                label: "Terkirim",
                className: "bg-primary/10 text-primary border-primary/20",
                dot: "bg-primary",
              }
            : {
                label: status || "—",
                className: "bg-muted text-muted-foreground border-border",
                dot: "bg-muted-foreground",
              };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        config.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

type StatTone = "blue" | "yellow" | "green" | "red" | "violet";

const STAT_TONE: Record<
  StatTone,
  { iconBg: string; iconFg: string; cardBg: string; cardBorder: string }
> = {
  blue: {
    iconBg: "bg-[#dbeafe]",
    iconFg: "text-[#1d4ed8]",
    cardBg: "bg-[#f4f8ff]",
    cardBorder: "border-[#d6e4fb]",
  },
  yellow: {
    iconBg: "bg-[#fef3c7]",
    iconFg: "text-[#b45309]",
    cardBg: "bg-[#fffbeb]",
    cardBorder: "border-[#fde68a]",
  },
  green: {
    iconBg: "bg-[#d1fae5]",
    iconFg: "text-[#047857]",
    cardBg: "bg-[#f0fdf6]",
    cardBorder: "border-[#a7f3d0]",
  },
  red: {
    iconBg: "bg-[#fee2e2]",
    iconFg: "text-[#b91c1c]",
    cardBg: "bg-[#fef2f2]",
    cardBorder: "border-[#fecaca]",
  },
  violet: {
    iconBg: "bg-[#ede9fe]",
    iconFg: "text-[#6d28d9]",
    cardBg: "bg-[#f7f5ff]",
    cardBorder: "border-[#ddd6fe]",
  },
};

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof FileText;
  tone: StatTone;
}) {
  const t = STAT_TONE[tone];

  return (
    <div
      className={cn(
        "group relative flex min-h-[104px] items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-lg",
        t.cardBg,
        t.cardBorder,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            t.iconBg,
            t.iconFg,
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            {title}
          </p>
          <p className="num mt-1 text-3xl font-bold text-foreground">
            {value.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <ChevronRight
        className={cn(
          "mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5",
          t.iconFg,
        )}
      />
    </div>
  );
}

/* =========================================================
   BAR CHART
========================================================= */

function BarChart({ reports }: { reports: ReportWithTrainer[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      const t = r.tanggal_kegiatan;
      if (!t) continue;
      const key = t.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
  }, [reports]);

  const max = Math.max(...data.map(([, v]) => v), 1);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  const W = 100;
  const H = 100;
  const padX = 8;
  const padTop = 14;
  const padBottom = 8;
  const chartH = H - padTop - padBottom;

  const totalSlots = Math.max(data.length, 4);
  const slotW = (W - padX * 2) / totalSlots;
  const barW = Math.min(slotW * 0.55, 10);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[240px] w-full"
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const y = padTop + (chartH / 4) * i;
          return (
            <line
              key={i}
              x1={padX}
              x2={W - padX}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth="0.15"
              strokeDasharray="0.8 1.2"
              className="text-border"
            />
          );
        })}

        {data.map(([key, value], i) => {
          const x = padX + slotW * i + (slotW - barW) / 2;
          const barH = (value / max) * chartH;
          const y = padTop + chartH - barH;

          return (
            <g key={key}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="0.8"
                fill="url(#barGrad)"
              />
              <text
                x={x + barW / 2}
                y={y - 1.8}
                textAnchor="middle"
                fontSize="3"
                fontWeight="700"
                fill="currentColor"
                className="text-foreground"
              >
                {value}
              </text>
            </g>
          );
        })}

        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      </svg>

      <div className="mt-2 flex gap-1">
        {data.map(([key]) => (
          <div
            key={key}
            className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground"
          >
            {labelBulanPendek(key)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   DONUT CHART
========================================================= */

function DonutChart({
  total,
  terverifikasi,
  menunggu,
  revisi,
  terkirim,
}: {
  total: number;
  terverifikasi: number;
  menunggu: number;
  revisi: number;
  terkirim: number;
}) {
  const items = [
    { label: "Terverifikasi", value: terverifikasi, color: "#10b981" },
    { label: "Menunggu Verifikasi", value: menunggu, color: "#f59e0b" },
    { label: "Perlu Revisi", value: revisi, color: "#ef4444" },
    { label: "Terkirim", value: terkirim, color: "#3b82f6" },
  ];

  const R = 42;
  const stroke = 16;
  const C = 2 * Math.PI * R;
  const gap = 3;

  let offset = 0;
  const segments = items
    .filter((it) => it.value > 0)
    .map((it) => {
      const frac = total ? it.value / total : 0;
      const len = Math.max(0, frac * C - gap);
      const seg = { ...it, len, offset };
      offset += frac * C;
      return seg;
    });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg viewBox="0 0 100 100" className="size-44 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
          />

          {segments.map((s) => (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${s.len} ${C - s.len}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="num text-3xl font-bold text-foreground">
            {total.toLocaleString("id-ID")}
          </p>
          <p className="text-[11px] text-muted-foreground">Laporan</p>
        </div>
      </div>

      <div className="w-full space-y-2.5">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: it.color }}
              />
              <span className="truncate text-xs text-muted-foreground">
                {it.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="num text-sm font-semibold">
                {it.value.toLocaleString("id-ID")}
              </span>
              <span className="num w-10 text-right text-xs text-muted-foreground">
                {total ? Math.round((it.value / total) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   HORIZONTAL BAR
========================================================= */

function HorizontalBarChart({ reports }: { reports: ReportWithTrainer[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      const k = r.jenis_kegiatan?.trim() || "Lainnya";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 6);
  }, [reports]);

  const max = Math.max(...data.map(([, v]) => v), 1);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {data.map(([label, value]) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-xs font-medium text-foreground">
              {label}
            </span>
            <span className="num text-xs font-semibold text-foreground">
              {value}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(6, (value / max) * 100)}%`,
                background: "linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   RINGKASAN STATUS
========================================================= */

function RingkasanStatus({
  total,
  terverifikasi,
  menunggu,
  revisi,
  terkirim,
}: {
  total: number;
  terverifikasi: number;
  menunggu: number;
  revisi: number;
  terkirim: number;
}) {
  const items = [
    { label: "Terverifikasi", value: terverifikasi, dot: "bg-status-verified" },
    { label: "Menunggu Verifikasi", value: menunggu, dot: "bg-status-warning" },
    { label: "Perlu Revisi", value: revisi, dot: "bg-destructive" },
    { label: "Terkirim", value: terkirim, dot: "bg-primary" },
  ];

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", it.dot)} />
            <span className="truncate text-xs text-muted-foreground">
              {it.label}
            </span>
          </div>
          <span className="num text-sm font-semibold">
            {it.value.toLocaleString("id-ID")}
          </span>
        </div>
      ))}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="num text-lg font-bold">{total}</span>
      </div>
    </div>
  );
}

/* =========================================================
   PAGINATION
========================================================= */

function Pagination({
  halaman,
  totalHalaman,
  onPindah,
}: {
  halaman: number;
  totalHalaman: number;
  onPindah: (h: number) => void;
}) {
  if (totalHalaman <= 1) return null;

  const halamanList: (number | "...")[] = [];
  const maxTampil = 5;

  if (totalHalaman <= maxTampil) {
    for (let i = 1; i <= totalHalaman; i++) halamanList.push(i);
  } else {
    halamanList.push(1);
    const start = Math.max(2, halaman - 1);
    const end = Math.min(totalHalaman - 1, halaman + 1);
    if (start > 2) halamanList.push("...");
    for (let i = start; i <= end; i++) halamanList.push(i);
    if (end < totalHalaman - 1) halamanList.push("...");
    halamanList.push(totalHalaman);
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Halaman <strong>{halaman}</strong> dari <strong>{totalHalaman}</strong>
      </p>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          disabled={halaman <= 1}
          onClick={() => onPindah(halaman - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>

        {halamanList.map((h, i) =>
          h === "..." ? (
            <span
              key={`dots-${i}`}
              className="px-2 text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={h}
              size="sm"
              variant={h === halaman ? "default" : "outline"}
              onClick={() => onPindah(h)}
              className="min-w-9"
            >
              {h}
            </Button>
          ),
        )}

        <Button
          size="icon"
          variant="outline"
          disabled={halaman >= totalHalaman}
          onClick={() => onPindah(halaman + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   Helper: fetch gambar → data URL (buat PDF)
========================================================= */

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function urlToDataUrlWithTimeout(
  url: string,
  timeoutMs = 8000,
): Promise<string | null> {
  return Promise.race([
    urlToDataUrl(url),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/* =========================================================
   KOMPONEN UTAMA
========================================================= */

function LaporanBulananPage() {
  const { isStaff, isTrainer, trainer, loading } = useCurrentUser();
  const qc = useQueryClient();

  const [bulan, setBulan] = useState<string>(bulanIni());
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [status, setStatus] = useState<FilterStatus>("semua");
  const [jenisKegiatan, setJenisKegiatan] = useState("semua");
  const [cari, setCari] = useState("");
  const [halaman, setHalaman] = useState(1);

  const [pdfHtml, setPdfHtml] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfBuilding, setPdfBuilding] = useState(false);

  const [preview, setPreview] = useState<ReportWithTrainer | null>(null);
  const [previewPhotos, setPreviewPhotos] = useState<ReportPhoto[]>([]);
  const [previewLoadingPhotos, setPreviewLoadingPhotos] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; nama: string } | null>(
    null,
  );

  const [hapusAction, setHapusAction] = useState<ReportWithTrainer | null>(null);
  const [hapusConfirmText, setHapusConfirmText] = useState("");

  const brandingLogo = useBrandingUrl("logo");

  const dariEfektif = dari || awalBulan(bulan);
  const sampaiEfektif = sampai || akhirBulan(bulan);

  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "reports",
      "laporan-bulanan",
      trainer?.id,
      dariEfektif,
      sampaiEfektif,
      status,
      cari,
    ],
    enabled: !loading && (isStaff || isTrainer),
    queryFn: () =>
      fetchReports({
        trainerId: isTrainer && trainer ? trainer.id : null,
        dari: dariEfektif,
        sampai: sampaiEfektif,
        status: status !== "semua" ? status : null,
        cari: cari.trim() || null,
      }),
  });

  const daftarBulan = useMemo(() => listBulan(2026, 2040), []);

  const jenisOptions = useMemo(() => {
    const values = new Set<string>();
    for (const report of reports) {
      if (report.jenis_kegiatan?.trim()) {
        values.add(report.jenis_kegiatan.trim());
      }
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (jenisKegiatan === "semua") return reports;
    return reports.filter(
      (report) => (report.jenis_kegiatan?.trim() || "Lainnya") === jenisKegiatan,
    );
  }, [reports, jenisKegiatan]);

  // Pagination
  const totalHalaman = Math.max(1, Math.ceil(filteredReports.length / PER_HALAMAN));
  const halamanAman = Math.min(halaman, totalHalaman);
  const laporanTampil = useMemo(
    () =>
      filteredReports.slice(
        (halamanAman - 1) * PER_HALAMAN,
        halamanAman * PER_HALAMAN,
      ),
    [filteredReports, halamanAman],
  );

  const stats = useMemo(() => {
    const total = filteredReports.length;

    const terverifikasi = filteredReports.filter(
      (r) => r.status_laporan === "terverifikasi",
    ).length;
    const menunggu = filteredReports.filter(
      (r) => r.status_laporan === "menunggu_verifikasi",
    ).length;
    const revisi = filteredReports.filter(
      (r) => r.status_laporan === "perlu_revisi",
    ).length;
    const terkirim = filteredReports.filter(
      (r) => r.status_laporan === "terkirim",
    ).length;

    const totalHadir = filteredReports.reduce(
      (sum, report) => sum + (report.jumlah_hadir ?? 0),
      0,
    );

    return {
      total,
      terverifikasi,
      menunggu,
      revisi,
      terkirim,
      totalHadir,
    };
  }, [filteredReports]);

  const resetFilter = () => {
    setBulan(bulanIni());
    setDari("");
    setSampai("");
    setStatus("semua");
    setJenisKegiatan("semua");
    setCari("");
    setHalaman(1);
  };

  const hasFilter =
    dari ||
    sampai ||
    status !== "semua" ||
    jenisKegiatan !== "semua" ||
    cari ||
    bulan !== bulanIni();

  /* =========================================================
     HAPUS
  ========================================================= */
  const hapusMutation = useMutation({
    mutationFn: async (report: ReportWithTrainer) => {
      await hapusLaporanPermanent(report.id);
    },
    onSuccess: () => {
      toast.success("Laporan berhasil dihapus permanent.");
      qc.invalidateQueries({ queryKey: ["reports"] });
      setHapusAction(null);
      setHapusConfirmText("");
      setPreview(null);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Gagal menghapus laporan.");
    },
  });

  async function bukaPreview(report: ReportWithTrainer) {
    setPreview(report);
    setPreviewPhotos([]);
    setPreviewLoadingPhotos(true);
    try {
      const photos = await getReportPhotos(report.id);
      setPreviewPhotos(photos);
    } catch (err) {
      console.error("Gagal memuat foto:", err);
    } finally {
      setPreviewLoadingPhotos(false);
    }
  }

  function tutupPreview() {
    setPreview(null);
    setPreviewPhotos([]);
    setLightbox(null);
  }

  /* =========================================================
     BUILD PDF
  ========================================================= */
  async function buildHTML(): Promise<{ html: string; fileName: string } | null> {
    if (filteredReports.length === 0) {
      toast.error("Tidak ada laporan untuk diunduh.");
      return null;
    }

    const bulanFinal = bulan;

    const laporanPeriode = filteredReports
      .filter((r) => r.tanggal_kegiatan?.startsWith(bulanFinal))
      .sort((a, b) => {
        const tA = a.tanggal_kegiatan || "";
        const tB = b.tanggal_kegiatan || "";
        return (
          tA.localeCompare(tB) ||
          (a.jam_mulai || "").localeCompare(b.jam_mulai || "")
        );
      });

    if (laporanPeriode.length === 0) {
      toast.error(`Tidak ada laporan pada periode ${labelBulan(bulanFinal)}.`);
      return null;
    }

    let photosMap = new Map<string, ReportPhoto[]>();
    try {
      photosMap = await getReportPhotosBatch(laporanPeriode.map((r) => r.id));
    } catch (err) {
      console.error("Gagal ambil foto:", err);
    }

    const photoDataMap = new Map<string, string[]>();
    await Promise.all(
      laporanPeriode.map(async (r) => {
        const fotos = (photosMap.get(r.id) ?? []).filter((p) => p.url);
        const dataUrls: string[] = [];
        for (const foto of fotos.slice(0, 5)) {
          if (!foto.url) continue;
          const dataUrl = await urlToDataUrlWithTimeout(foto.url);
          if (dataUrl) dataUrls.push(dataUrl);
        }
        photoDataMap.set(r.id, dataUrls);
      }),
    );

    let logoDataUrl: string | null = null;
    if (brandingLogo) {
      logoDataUrl = await urlToDataUrlWithTimeout(brandingLogo);
    }

    const bulanLabel = namaBulan(bulanFinal);

    const firstReport = laporanPeriode[0];
    const trainerInfo = {
      nama: firstReport?.trainers?.nama_lengkap || trainer?.nama_lengkap || "—",
      nomorId:
        firstReport?.trainers?.nomor_id_trainer ||
        trainer?.nomor_id_trainer ||
        "—",
      jabatan: firstReport?.trainers?.jabatan || trainer?.jabatan || "—",
      departemen: DEPARTEMEN_LABEL,
    };

    const byTanggal = new Map<string, ReportWithTrainer[]>();
    for (const r of laporanPeriode) {
      const key = r.tanggal_kegiatan || "tanpa-tanggal";
      const cur = byTanggal.get(key) ?? [];
      cur.push(r);
      byTanggal.set(key, cur);
    }
    const tanggalList = [...byTanggal.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    let noUrut = 1;
    const tbodyHtml = tanggalList
      .map(([, tglList]) => {
        return tglList
          .map((item, idx) => {
            const fotos = photoDataMap.get(item.id) ?? [];
            const rowSpan = tglList.length;
            const isFirstRow = idx === 0;
            const currentNo = noUrut++;

            const tglSelesai = (item as any).tanggal_selesai as
              | string
              | null
              | undefined;
            const isRange = Boolean(
              tglSelesai && tglSelesai !== item.tanggal_kegiatan,
            );

            let durasiHari = 0;
            if (isRange && item.tanggal_kegiatan && tglSelesai) {
              const s = new Date(`${item.tanggal_kegiatan}T00:00:00`).getTime();
              const e = new Date(`${tglSelesai}T00:00:00`).getTime();
              durasiHari = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
            }

            const tanggalText = isRange
              ? `${formatTanggal(item.tanggal_kegiatan)} - ${formatTanggal(
                  tglSelesai!,
                )}<br><span class="durasi-hari">(${durasiHari} hari)</span>`
              : formatTanggal(item.tanggal_kegiatan);

            const tanggalCell = isFirstRow
              ? `<td class="col-tanggal" rowspan="${rowSpan}">${tanggalText}</td>`
              : "";

            const materiText = [
              escapeHtml(item.materi || "—"),
              item.jenis_kegiatan
                ? `<div class="materi-jenis">${escapeHtml(item.jenis_kegiatan)}</div>`
                : "",
              item.keterangan
                ? `<div class="materi-desc">${escapeHtml(item.keterangan)}</div>`
                : "",
            ].join("");

            const fotoHtml =
              fotos.length === 0
                ? `<div class="no-photo">Tidak ada foto</div>`
                : `<div class="photo-grid">${fotos
                    .map(
                      (src) =>
                        `<img src="${src}" class="photo" alt="Dokumentasi" />`,
                    )
                    .join("")}</div>`;

            return `
              <tr>
                <td class="col-no">${currentNo}</td>
                ${tanggalCell}
                <td class="col-jam">
                  ${escapeHtml(item.jam_mulai?.slice(0, 5) || "-")} - 
                  ${escapeHtml(item.jam_selesai?.slice(0, 5) || "-")}
                </td>
                <td class="col-materi">${materiText}</td>
                <td class="col-kelas">${escapeHtml(item.kelas || "-")}</td>
                <td class="col-lokasi">${escapeHtml(item.lokasi || "-")}</td>
                ${
                  idx === 0
                    ? `<td class="col-hadir" rowspan="${rowSpan}">${
                        item.jumlah_hadir ?? 0
                      }</td>`
                    : ""
                }
                <td class="col-pj">Muhammad Halid (Superintendent)</td>
                <td class="col-foto">${fotoHtml}</td>
              </tr>
            `;
          })
          .join("");
      })
      .join("");

    const tanggalUnik = new Map<string, number>();
    for (const r of laporanPeriode) {
      const tgl = r.tanggal_kegiatan || "tanpa-tanggal";
      if (!tanggalUnik.has(tgl)) {
        tanggalUnik.set(tgl, Number(r.jumlah_hadir || 0));
      }
    }
        // Total durasi seluruh laporan
    const totalMenit = laporanPeriode.reduce(
      (sum, r) => sum + hitungDurasiMenit(r.jam_mulai, r.jam_selesai),
      0,
    );

    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" class="logo" alt="Logo" />`
      : `<div class="logo-fallback">K3</div>`;

    const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Laporan Bulanan K3 — ${escapeHtml(bulanLabel)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #124a82;
      background: #fff;
      font-size: 9px;
    }
    .page { padding: 12mm 8mm; min-height: 100vh; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .logo { width: 56px; height: 46px; object-fit: contain; }
    .logo-fallback {
      width: 56px; height: 46px; display: grid; place-items: center;
      border-radius: 8px; background: #0b5aa5; color: #fff;
      font-size: 18px; font-weight: 900;
    }
    .brand-title {
      font-size: 19px; font-weight: 900; color: #124a82;
      line-height: 1.1; letter-spacing: 0.2px;
    }
    .brand-sub { font-size: 12px; font-weight: 800; color: #124a82; margin-top: 3px; }
    .header-right { text-align: right; }
    .header-right .lbl { font-size: 15px; font-weight: 900; color: #124a82; }
    .header-right .val { font-size: 11px; font-weight: 700; color: #124a82; margin-top: 4px; }
    .divider { height: 3px; background: #0b5aa5; margin: 8px 0 12px; border-radius: 2px; }
    .trainer-card {
      display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr;
      border: 1.5px solid #b8d9f7; border-radius: 6px;
      background: #f5faff; margin-bottom: 10px; overflow: hidden;
    }
    .trainer-cell { padding: 8px 10px; border-right: 1.5px solid #d4e4f2; }
    .trainer-cell:last-child { border-right: none; }
    .trainer-label {
      font-size: 7px; font-weight: 700; color: #3978ab;
      text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px;
    }
    .trainer-value { font-size: 11px; font-weight: 900; color: #124a82; line-height: 1.2; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 8px; }
    thead { background: #0b5aa5; }
    th {
      color: #fff; font-size: 8.5px; font-weight: 800;
      padding: 8px 5px; border: 1.5px solid #0b5aa5;
      text-align: center; vertical-align: middle;
    }
    td {
      border: 1px solid #b9d8f2; padding: 6px;
      color: #124a82; font-size: 8px;
      vertical-align: middle; overflow-wrap: anywhere;
      word-break: break-word;
    }
    .col-no { text-align: center; font-weight: 800; }
    .col-tanggal {
      text-align: center; font-weight: 700;
      vertical-align: middle; background: #f8fbff;
    }
    .col-tanggal .durasi-hari {
      display: block; margin-top: 3px; font-size: 7px;
      font-weight: 600; color: #64748b;
    }
    .col-jam { text-align: center; white-space: nowrap; }
    .col-materi { font-size: 8.5px; }
    .col-kelas { text-align: center; }
    .col-lokasi { text-align: center; }
    .col-hadir { text-align: center; font-weight: 800; font-size: 10px; }
    .col-pj { text-align: center; font-size: 7.5px; }
    .col-foto { text-align: center; padding: 4px; }
    .materi-jenis { font-size: 7px; color: #63809a; margin-top: 3px; font-style: italic; }
    .materi-desc { font-size: 7px; color: #4a5f75; margin-top: 3px; font-style: italic; }
    .photo-grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 4px; width: 100%;
    }
    .photo {
      width: 100%; height: 95px; object-fit: cover;
      border-radius: 3px; border: 1px solid #b9d8f2;
      background: #eef6fc; display: block;
    }
    .photo-grid .photo:only-child,
    .photo-grid .photo:nth-child(5):last-child {
      grid-column: span 2; height: 130px;
    }
    .no-photo { padding: 20px 4px; color: #8ba0b3; font-size: 8px; }
    .summary {
      background: #f0f7ff; border: 1.5px solid #b8d9f7;
      border-radius: 6px; padding: 8px 12px;
      font-size: 9px; color: #124a82; font-weight: 700;
      margin-top: 6px;
    }
    .footer {
      margin-top: 10px; padding-top: 6px;
      border-top: 1px solid #d4e4f2;
      display: flex; justify-content: space-between;
      font-size: 7px; color: #6b8297;
    }
    .footer strong { color: #124a82; }
    @page { size: A4 landscape; margin: 8mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; min-height: auto; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="header">
      <div class="brand">
        ${logoHtml}
        <div>
          <div class="brand-title">LAPORAN KEGIATAN TRAINER K3</div>
          <div class="brand-sub">PT IWIP</div>
        </div>
      </div>
      <div class="header-right">
        <div class="lbl">LAPORAN BULANAN</div>
        <div class="val">${escapeHtml(bulanLabel)}</div>
      </div>
    </div>
    <div class="divider"></div>

    <div class="trainer-card">
      <div class="trainer-cell">
        <div class="trainer-label">NAMA TRAINER</div>
        <div class="trainer-value">${escapeHtml(trainerInfo.nama)}</div>
      </div>
      <div class="trainer-cell">
        <div class="trainer-label">NO. ID TRAINER</div>
        <div class="trainer-value">${escapeHtml(trainerInfo.nomorId)}</div>
      </div>
      <div class="trainer-cell">
        <div class="trainer-label">JABATAN</div>
        <div class="trainer-value">${escapeHtml(trainerInfo.jabatan)}</div>
      </div>
      <div class="trainer-cell">
        <div class="trainer-label">DEPARTEMEN</div>
        <div class="trainer-value">${escapeHtml(trainerInfo.departemen)}</div>
      </div>
    </div>

    <table>
      <colgroup>
        <col style="width:4%">
        <col style="width:8%">
        <col style="width:8%">
        <col style="width:22%">
        <col style="width:5%">
        <col style="width:9%">
        <col style="width:5%">
        <col style="width:9%">
        <col style="width:30%">
      </colgroup>
      <thead>
        <tr>
          <th>No</th>
          <th>Tanggal</th>
          <th>Jam</th>
          <th>Materi / Kegiatan &amp; Deskripsi</th>
          <th>Kelas</th>
          <th>Lokasi</th>
          <th>Hadir</th>
          <th>Penanggung Jawab</th>
          <th>Dokumentasi</th>
        </tr>
      </thead>
      <tbody>
        ${tbodyHtml}
      </tbody>
    </table>

        <div class="summary">
      <span>Total kegiatan: <strong>${laporanPeriode.length}</strong></span>
      <span class="summary-sep">•</span>
      <span>Total peserta hadir: <strong>${totalHadirTrainer.toLocaleString("id-ID")}</strong> orang</span>
      <span class="summary-sep">•</span>
      <span>Total durasi: <strong>${formatDurasi(totalMenit)}</strong></span>
    </div>

    <div class="footer">
      <span>Periode: <strong>${escapeHtml(bulanLabel)}</strong></span>
      <span>Dicetak: <strong>${escapeHtml(
        new Date().toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      )}</strong></span>
    </div>
  </section>
</body>
</html>
    `;

    return {
      html,
      fileName: `Laporan-Bulanan-K3-${bulanFinal}`,
    };
  }

  async function previewPDF() {
    setPdfBuilding(true);
    try {
      const result = await buildHTML();
      if (!result) return;
      setPdfHtml(result.html);
      setPdfFileName(result.fileName);
    } catch (error) {
      console.error("Gagal menyiapkan PDF:", error);
      toast.error(
        error instanceof Error ? error.message : "Gagal menyiapkan PDF.",
      );
    } finally {
      setPdfBuilding(false);
    }
  }

  function confirmDownload() {
    if (!pdfHtml) return;

    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) {
      toast.error("Popup diblokir. Izinkan popup untuk membuka preview.");
      return;
    }

    win.document.open();
    win.document.write(pdfHtml);
    win.document.close();

    const images = Array.from(win.document.images);
    Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    ).then(() => {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
    });

    toast.success("Preview terbuka. Klik 'Save as PDF' di dialog print.");
    closePdfPreview();
  }

  function closePdfPreview() {
    setPdfHtml(null);
    setPdfFileName("");
  }

  if (loading) {
    return (
      <AppShell title="Laporan Bulanan" eyebrow="Laporan Kegiatan Trainer K3">
        <Panel>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Memuat…
          </p>
        </Panel>
      </AppShell>
    );
  }

  if (!isStaff && !isTrainer) {
    return (
      <AppShell title="Laporan Bulanan">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki akses.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Laporan Bulanan Saya"
      eyebrow="LAPORAN KEGIATAN TRAINER K3"
      description="Laporan ini menunjukkan kinerja pelatihan Anda."
      heroVariant="soft"
      actions={
        <Button
          onClick={previewPDF}
          disabled={filteredReports.length === 0 || pdfBuilding}
        >
          <Download className="mr-2 size-4" />
          {pdfBuilding ? "Menyiapkan…" : "Download Laporan"}
        </Button>
      }
    >
      <Panel className="mb-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Filter Laporan</p>
            <p className="text-xs text-muted-foreground">
              Silahkan menggunakan kolom filter di bawah ini untuk melihat data
              yang diinginkan.
            </p>
          </div>
          {hasFilter ? (
            <Button size="sm" variant="outline" onClick={resetFilter}>
              <RefreshCcw className="mr-2 size-3.5" />
              Reset Filter
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Bulan</p>
            <Select value={bulan} onValueChange={(v) => { setBulan(v); setHalaman(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih bulan" />
              </SelectTrigger>
              <SelectContent>
                {daftarBulan.map((b) => (
                  <SelectItem key={b} value={b}>
                    {labelBulan(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Dari tanggal
            </p>
            <Input type="date" value={dari} onChange={(e) => { setDari(e.target.value); setHalaman(1); }} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Sampai tanggal
            </p>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => { setSampai(e.target.value); setHalaman(1); }}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Jenis kegiatan
            </p>
            <Select value={jenisKegiatan} onValueChange={(v) => { setJenisKegiatan(v); setHalaman(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Jenis</SelectItem>
                {jenisOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <Select
              value={status}
              onValueChange={(value) => { setStatus(value as FilterStatus); setHalaman(1); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Status</SelectItem>
                <SelectItem value="terkirim">Terkirim</SelectItem>
                <SelectItem value="menunggu_verifikasi">
                  Menunggu Verifikasi
                </SelectItem>
                <SelectItem value="terverifikasi">Terverifikasi</SelectItem>
                <SelectItem value="perlu_revisi">Perlu Revisi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Cari</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Materi, kegiatan, kelas…"
                value={cari}
                onChange={(e) => { setCari(e.target.value); setHalaman(1); }}
              />
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Menampilkan periode: <strong>{formatTanggal(dariEfektif)}</strong> s/d{" "}
          <strong>{formatTanggal(sampaiEfektif)}</strong>
          {!dari && !sampai ? (
            <span> (bulan {labelBulan(bulan)})</span>
          ) : null}
        </p>
      </Panel>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Laporan"
          value={stats.total}
          description="Laporan masuk bulan ini"
          icon={FileText}
          tone="blue"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value={stats.menunggu}
          description="Pending verifikasi"
          icon={Clock3}
          tone="yellow"
        />
        <StatCard
          title="Terverifikasi"
          value={stats.terverifikasi}
          description="Laporan sudah diverifikasi"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          title="Perlu Revisi"
          value={stats.revisi}
          description="Menunggu perbaikan"
          icon={XCircle}
          tone="red"
        />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1d4ed8]">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Peserta Hadir
              </p>
              <p className="num mt-0.5 text-2xl font-bold">
                {stats.totalHadir.toLocaleString("id-ID")}
              </p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1d4ed8]">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Periode
              </p>
              <p className="mt-0.5 text-sm font-semibold">{labelBulan(bulan)}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <div>
              <p className="font-semibold">Tren Laporan</p>
              <p className="text-xs text-muted-foreground">
                Jumlah laporan per bulan dalam periode ini.
              </p>
            </div>
          </div>
          <BarChart reports={filteredReports} />
        </Panel>
        <Panel>
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <div>
              <p className="font-semibold">Status Laporan</p>
              <p className="text-xs text-muted-foreground">
                Distribusi status laporan pada periode ini.
              </p>
            </div>
          </div>
          <DonutChart
            total={stats.total}
            terverifikasi={stats.terverifikasi}
            menunggu={stats.menunggu}
            revisi={stats.revisi}
            terkirim={stats.terkirim}
          />
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <div className="mb-5 flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <div>
              <p className="font-semibold">Jenis Kegiatan</p>
              <p className="text-xs text-muted-foreground">
                Jumlah laporan berdasarkan jenis kegiatan.
              </p>
            </div>
          </div>
          <HorizontalBarChart reports={filteredReports} />
        </Panel>
        <Panel>
          <div className="mb-5 flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <div>
              <p className="font-semibold">Ringkasan Status</p>
              <p className="text-xs text-muted-foreground">
                Rekapitulasi laporan yang sedang diproses.
              </p>
            </div>
          </div>
          <RingkasanStatus
            total={stats.total}
            terverifikasi={stats.terverifikasi}
            menunggu={stats.menunggu}
            revisi={stats.revisi}
            terkirim={stats.terkirim}
          />
        </Panel>
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <div>
              <p className="font-semibold">Daftar Laporan</p>
              <p className="text-xs text-muted-foreground">
                {filteredReports.length.toLocaleString("id-ID")} laporan pada{" "}
                {labelBulan(bulan)}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={previewPDF}
            disabled={filteredReports.length === 0 || pdfBuilding}
          >
            <Download className="mr-2 size-4" />
            {pdfBuilding ? "Menyiapkan…" : "Download Laporan"}
          </Button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">Memuat…</p>
          </div>
        ) : isError ? (
          <div className="p-10 text-center">
            <p className="font-medium text-destructive">
              Gagal mengambil data laporan.
            </p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-4 font-semibold">Belum ada laporan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tidak ada laporan pada periode {labelBulan(bulan)}.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-left">
                    <th className="eyebrow px-4 py-3 text-muted-foreground">No</th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Tanggal
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Peserta
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Jenis
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Lokasi
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Masa
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Status
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {laporanTampil.map((r, index) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 transition-colors hover:bg-muted/20"
                    >
                      <td className="num px-4 py-3 text-muted-foreground">
                        {(halamanAman - 1) * PER_HALAMAN + index + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatTanggal(r.tanggal_kegiatan)}
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate font-medium">
                          {r.materi || "Tanpa materi"}
                        </p>
                        {r.kelas ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Kelas: {r.kelas}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {r.jenis_kegiatan || "Lainnya"}
                        </span>
                      </td>
                      <td className="max-w-[160px] px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{r.lokasi || "—"}</span>
                      </td>
                      <td className="num px-4 py-3">
                        {r.jumlah_hadir ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status_laporan} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            title="Preview laporan"
                            onClick={() => bukaPreview(r)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {isStaff ? (
                            <Button
                              size="icon"
                              variant="outline"
                              title="Hapus laporan permanent"
                              onClick={() => {
                                setHapusAction(r);
                                setHapusConfirmText("");
                              }}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              halaman={halamanAman}
              totalHalaman={totalHalaman}
              onPindah={(h) => {
                setHalaman(h);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </Panel>

      {pdfHtml ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 bg-background/95 px-5 py-3">
            <div>
              <p className="text-sm font-semibold">Preview Laporan Bulanan</p>
              <p className="text-xs text-muted-foreground">
                {pdfFileName}.pdf
              </p>
            </div>
            <Button size="icon" variant="outline" onClick={closePdfPreview}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto bg-neutral-200 p-4">
            <div className="mx-auto max-w-[1400px] rounded-lg bg-white shadow-2xl">
              <iframe
                srcDoc={pdfHtml}
                title="Preview Laporan"
                className="block h-[80vh] w-full rounded-lg border-0 bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-background/95 px-5 py-3">
            <Button variant="outline" onClick={closePdfPreview}>
              Batal
            </Button>
            <Button onClick={confirmDownload}>
              <Download className="mr-2 size-4" />
              Ya, Download PDF
            </Button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) tutupPreview();
          }}
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-lg font-semibold">Detail Laporan</p>
                <p className="text-xs text-muted-foreground">
                  {formatTanggalPanjang(preview.tanggal_kegiatan)}
                </p>
              </div>
              <Button size="icon" variant="outline" onClick={tutupPreview}>
                <XCircle className="size-4" />
              </Button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  label="Trainer"
                  value={preview.trainers?.nama_lengkap || "—"}
                />
                <DetailItem
                  label="ID Trainer"
                  value={preview.trainers?.nomor_id_trainer || "—"}
                />
                <DetailItem
                  label="Jabatan"
                  value={preview.trainers?.jabatan || "—"}
                />
                <DetailItem label="Departemen" value={DEPARTEMEN_LABEL} />
                <DetailItem
                  label="Tanggal"
                  value={formatTanggalPanjang(preview.tanggal_kegiatan)}
                />
                <DetailItem
                  label="Jam"
                  value={
                    preview.jam_mulai && preview.jam_selesai
                      ? `${preview.jam_mulai.slice(0, 5)} – ${preview.jam_selesai.slice(0, 5)}`
                      : "Belum lengkap"
                  }
                />
                <DetailItem
                  label="Jenis Kegiatan"
                  value={preview.jenis_kegiatan || "—"}
                />
                <DetailItem
                  label="Materi / Kegiatan"
                  value={preview.materi || "—"}
                />
                <DetailItem label="Kelas" value={preview.kelas || "—"} />
                <DetailItem label="Lokasi" value={preview.lokasi || "—"} />
                <DetailItem
                  label="Penanggung Jawab"
                  value={preview.penanggung_jawab || "—"}
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Data Peserta
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DetailNumber label="Peserta" value={preview.jumlah_peserta} />
                  <DetailNumber label="Hadir" value={preview.jumlah_hadir} />
                  <DetailNumber
                    label="Tidak Hadir"
                    value={preview.jumlah_tidak_hadir}
                  />
                  <DetailNumber
                    label="Tambahan"
                    value={preview.jumlah_tambahan}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Dokumentasi Foto
                    </p>
                  </div>
                  {!previewLoadingPhotos && previewPhotos.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {previewPhotos.length} foto
                    </span>
                  )}
                </div>

                {previewLoadingPhotos ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Memuat foto…
                  </p>
                ) : previewPhotos.length === 0 ? (
                  <div className="grid place-items-center rounded-lg border border-dashed border-border py-8">
                    <ImageIcon className="size-6 text-muted-foreground/50" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Belum ada foto dokumentasi
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {previewPhotos
                      .filter((p) => p.url)
                      .map((photo, i) => (
                        <button
                          key={photo.id ?? i}
                          type="button"
                          onClick={() =>
                            setLightbox({
                              url: photo.url!,
                              nama: photo.nama_file || `Foto ${i + 1}`,
                            })
                          }
                          className="group relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-muted"
                        >
                          <img
                            src={photo.url!}
                            alt={photo.nama_file || `Foto ${i + 1}`}
                            className="size-full object-cover transition-transform group-hover:scale-105"
                          />
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {preview.keterangan ? (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Keterangan
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {preview.keterangan}
                  </p>
                </div>
              ) : null}

              {preview.catatan_revisi ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    Catatan Revisi
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {preview.catatan_revisi}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status Laporan
                  </p>
                  <StatusPill status={preview.status_laporan} />
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border px-5 py-4">
              <Button onClick={tutupPreview}>Tutup</Button>
            </div>
          </div>
        </div>
      ) : null}

      {hapusAction ? (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setHapusAction(null);
              setHapusConfirmText("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">
                ⚠️ Hapus Laporan Permanent?
              </DialogTitle>
              <DialogDescription>
                Laporan ini akan <strong>dihapus selamanya</strong> dari
                database, termasuk foto dokumentasi. Tindakan ini{" "}
                <strong>tidak bisa dibatalkan</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">
                  {hapusAction.trainers?.nama_lengkap || "Trainer"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hapusAction.materi || "Tanpa materi"} ·{" "}
                  {formatTanggal(hapusAction.tanggal_kegiatan)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Ketik{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold">
                    HAPUS
                  </code>{" "}
                  untuk konfirmasi:
                </label>
                <Input
                  value={hapusConfirmText}
                  onChange={(e) => setHapusConfirmText(e.target.value)}
                  placeholder="Ketik: HAPUS"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setHapusAction(null);
                  setHapusConfirmText("");
                }}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={
                  hapusConfirmText !== "HAPUS" || hapusMutation.isPending
                }
                onClick={() => hapusMutation.mutate(hapusAction)}
              >
                <Trash2 className="mr-2 size-4" />
                {hapusMutation.isPending ? "Menghapus..." : "Hapus Permanent"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.nama}
              className="max-h-[85vh] rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-white">
              <p className="truncate text-sm">{lightbox.nama}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLightbox(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

/* =========================================================
   SUB-COMPONENTS
========================================================= */

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function DetailNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-xl font-bold">{value ?? 0}</p>
    </div>
  );
}
