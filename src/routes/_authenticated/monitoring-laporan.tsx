import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileBarChart2,
  FileText,
  ImageIcon,
  RefreshCcw,
  RotateCcw,
  Search,
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
import { supabase } from "@/integrations/supabase/client";
import {
  fetchReports,
  fetchTrainers,
  type ReportWithTrainer,
} from "@/lib/queries";
import {
  getReportPhotos,
  getReportPhotosBatch,
  type ReportPhoto,
} from "@/lib/report-photos";
import { cn } from "@/lib/utils";
import { useBrandingUrl } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/monitoring-laporan")({
  head: () => ({
    meta: [
      { title: "Monitoring Laporan · Laporan Kegiatan Trainer K3 PT IWIP" },
      {
        name: "description",
        content:
          "Monitoring status dan perkembangan laporan kegiatan trainer K3 PT IWIP.",
      },
    ],
  }),
  component: MonitoringLaporanPage,
});

const DEPARTEMEN_LABEL = "HR K3";

type FilterStatus =
  | "semua"
  | "terkirim"
  | "menunggu_verifikasi"
  | "terverifikasi"
  | "perlu_revisi";

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
  tone: "blue" | "yellow" | "green" | "red";
}) {
  const toneClass = {
    blue: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
    yellow: {
      icon: "bg-status-warning/15 text-status-warning",
      value: "text-foreground",
    },
    green: {
      icon: "bg-status-verified/15 text-status-verified",
      value: "text-foreground",
    },
    red: { icon: "bg-destructive/10 text-destructive", value: "text-foreground" },
  }[tone];

  return (
    <Panel className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className={cn("num mt-2 text-3xl font-bold", toneClass.value)}>
            {value.toLocaleString("id-ID")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            toneClass.icon,
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </Panel>
  );
}

function MiniLegend({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full", className)} />
        <span className="truncate text-muted-foreground">{label}</span>
      </div>
      <span className="num font-semibold">{value}</span>
    </div>
  );
}

function TrendChart({ reports }: { reports: ReportWithTrainer[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const report of reports) {
      const tanggal = report.tanggal_kegiatan;
      if (!tanggal) continue;
      map.set(tanggal, (map.get(tanggal) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
  }, [reports]);

  const max = Math.max(...data.map(([, value]) => value), 1);

  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="h-[250px]">
      <div className="relative flex h-[190px] items-end gap-2 border-b border-border/70 px-2 pb-0">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
          {[4, 3, 2, 1, 0].map((item) => (
            <div key={item} className="border-t border-dashed border-border/50" />
          ))}
        </div>
        {data.map(([tanggal, value]) => {
          const height = Math.max(8, (value / max) * 165);
          return (
            <div
              key={tanggal}
              className="group relative z-10 flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div className="relative flex justify-center">
                <div
                  className="w-full max-w-10 rounded-t-lg bg-primary/80 transition-all duration-200 group-hover:bg-primary"
                  style={{ height }}
                  title={`${value} laporan`}
                />
                <span className="pointer-events-none absolute -top-7 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100">
                  {value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 px-2">
        {data.map(([tanggal]) => (
          <div
            key={tanggal}
            className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground"
          >
            {new Date(`${tanggal}T00:00:00`).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChart({
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
    { label: "Terverifikasi", value: terverifikasi, className: "bg-status-verified" },
    { label: "Menunggu Verifikasi", value: menunggu, className: "bg-status-warning" },
    { label: "Perlu Revisi", value: revisi, className: "bg-destructive" },
    { label: "Terkirim", value: terkirim, className: "bg-primary" },
  ];

  return (
    <div className="space-y-4">
      <div className="relative mx-auto flex size-44 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-[18px] border-muted" />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(
              hsl(var(--status-verified)) 0% ${
                total ? (terverifikasi / total) * 100 : 0
              }%,
              hsl(var(--status-warning)) ${
                total ? (terverifikasi / total) * 100 : 0
              }% ${
                total ? ((terverifikasi + menunggu) / total) * 100 : 0
              }%,
              hsl(var(--destructive)) ${
                total ? ((terverifikasi + menunggu) / total) * 100 : 0
              }% ${
                total ? ((terverifikasi + menunggu + revisi) / total) * 100 : 0
              }%,
              hsl(var(--primary)) ${
                total ? ((terverifikasi + menunggu + revisi) / total) * 100 : 0
              }% 100%
            )`,
            mask: "radial-gradient(circle, transparent 58%, black 59%)",
            WebkitMask: "radial-gradient(circle, transparent 58%, black 59%)",
          }}
        />
        <div className="relative z-10 text-center">
          <p className="num text-3xl font-bold">{total.toLocaleString("id-ID")}</p>
          <p className="text-xs text-muted-foreground">Laporan</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2.5 rounded-full", item.className)} />
              <span className="truncate text-xs text-muted-foreground">
                {item.label}
              </span>
            </div>
            <span className="num text-sm font-semibold">
              {item.value.toLocaleString("id-ID")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityChart({ reports }: { reports: ReportWithTrainer[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const report of reports) {
      const key = report.jenis_kegiatan?.trim() || "Lainnya";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 6);
  }, [reports]);

  const max = Math.max(...data.map(([, value]) => value), 1);

  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="truncate text-xs font-medium">{label}</span>
            <span className="num text-xs text-muted-foreground">{value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(5, (value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================
// Helper: fetch gambar → data URL (base64)
// =============================================================

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

// =============================================================
// Komponen utama
// =============================================================

function MonitoringLaporanPage() {
  const { isStaff, isTrainer, trainer, loading, user } = useCurrentUser();
  const qc = useQueryClient();

  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("semua");
  const [status, setStatus] = useState<FilterStatus>("semua");
  const [jenisKegiatan, setJenisKegiatan] = useState("semua");
  const [cari, setCari] = useState("");
  const [preview, setPreview] = useState<ReportWithTrainer | null>(null);
  const [previewPhotos, setPreviewPhotos] = useState<ReportPhoto[]>([]);
  const [previewLoadingPhotos, setPreviewLoadingPhotos] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; nama: string } | null>(null);

  const [pdfHtml, setPdfHtml] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfBuilding, setPdfBuilding] = useState(false);

  const [verifAction, setVerifAction] = useState<{
    report: ReportWithTrainer;
    action: "verifikasi" | "revisi" | "batalkan";
  } | null>(null);
  const [catatanInput, setCatatanInput] = useState("");

  const brandingLogo = useBrandingUrl("logo");

  const { data: trainers = [] } = useQuery({
    queryKey: ["trainers", "monitoring-laporan"],
    enabled: isStaff,
    queryFn: fetchTrainers,
  });

  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "reports",
      "monitoring-laporan",
      trainer?.id,
      dari,
      sampai,
      trainerFilter,
      status,
      jenisKegiatan,
      cari,
    ],
    enabled: !loading && (isStaff || isTrainer),
    queryFn: () =>
      fetchReports({
        trainerId:
          isTrainer && trainer
            ? trainer.id
            : trainerFilter !== "semua"
              ? trainerFilter
              : null,
        dari: dari || null,
        sampai: sampai || null,
        status: status !== "semua" ? status : null,
        cari: cari.trim() || null,
      }),
  });

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
    const totalPeserta = filteredReports.reduce(
      (sum, report) => sum + (report.jumlah_peserta ?? 0),
      0,
    );

    return {
      total,
      terverifikasi,
      menunggu,
      revisi,
      terkirim,
      totalHadir,
      totalPeserta,
    };
  }, [filteredReports]);

  const resetFilter = () => {
    setDari("");
    setSampai("");
    setTrainerFilter("semua");
    setStatus("semua");
    setJenisKegiatan("semua");
    setCari("");
  };

  const hasFilter =
    dari ||
    sampai ||
    trainerFilter !== "semua" ||
    status !== "semua" ||
    jenisKegiatan !== "semua" ||
    cari;

  // ---------- Aksi verifikasi ----------
  const verifikasiMutation = useMutation({
    mutationFn: async ({
      report,
      action,
      catatan,
    }: {
      report: ReportWithTrainer;
      action: "verifikasi" | "revisi" | "batalkan";
      catatan: string;
    }) => {
      if (!user?.id) throw new Error("User tidak terdeteksi.");

      const now = new Date().toISOString();

      if (action === "verifikasi") {
        const { error } = await supabase
          .from("reports")
          .update({
            status_laporan: "terverifikasi",
            verified_by: user.id,
            verified_at: now,
            catatan_revisi: null,
          })
          .eq("id", report.id);
        if (error) throw error;
      } else if (action === "revisi") {
        if (!catatan.trim()) throw new Error("Catatan wajib diisi.");
        const { error } = await supabase
          .from("reports")
          .update({
            status_laporan: "perlu_revisi",
            catatan_revisi: catatan.trim(),
          })
          .eq("id", report.id);
        if (error) throw error;
      } else if (action === "batalkan") {
        if (!catatan.trim()) throw new Error("Catatan wajib diisi.");
        const { error } = await supabase
          .from("reports")
          .update({
            status_laporan: "perlu_revisi",
            catatan_revisi: catatan.trim(),
            verified_by: null,
            verified_at: null,
          })
          .eq("id", report.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      const msg =
        variables.action === "verifikasi"
          ? "Laporan berhasil diverifikasi."
          : variables.action === "revisi"
            ? "Laporan dikembalikan untuk revisi."
            : "Verifikasi dibatalkan, laporan perlu revisi.";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["reports"] });
      setVerifAction(null);
      setCatatanInput("");
      setPreview(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function bukaVerifAction(
    report: ReportWithTrainer,
    action: "verifikasi" | "revisi" | "batalkan",
  ) {
    setVerifAction({ report, action });
    setCatatanInput("");
  }

  // ---------- Preview foto ----------
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

  // =============================================================
  // BUILD HTML PDF — Group per Trainer ID
  // =============================================================

  async function buildHTML(): Promise<{ html: string; fileName: string } | null> {
    if (filteredReports.length === 0) {
      toast.error("Tidak ada laporan untuk diunduh.");
      return null;
    }

    // Tentukan bulan
    const now = new Date();
    let bulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (dari && /^\d{4}-\d{2}/.test(dari)) {
      bulan = dari.slice(0, 7);
    } else {
      const firstWithDate = filteredReports.find(
        (r) => r.tanggal_kegiatan && r.tanggal_kegiatan.length >= 7,
      );
      if (firstWithDate?.tanggal_kegiatan) {
        bulan = firstWithDate.tanggal_kegiatan.slice(0, 7);
      }
    }

    let laporanPeriode = filteredReports
      .filter((r) => r.tanggal_kegiatan?.startsWith(bulan))
      .sort((a, b) => {
        const tA = a.tanggal_kegiatan || "";
        const tB = b.tanggal_kegiatan || "";
        return (
          tA.localeCompare(tB) ||
          (a.jam_mulai || "").localeCompare(b.jam_mulai || "")
        );
      });

    if (laporanPeriode.length === 0) {
      laporanPeriode = [...filteredReports].sort((a, b) => {
        const tA = a.tanggal_kegiatan || "";
        const tB = b.tanggal_kegiatan || "";
        return tA.localeCompare(tB);
      });
    }

    // Fetch foto
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
        // MAX 5 FOTO per kegiatan
        for (const foto of fotos.slice(0, 5)) {
          if (!foto.url) continue;
          const dataUrl = await urlToDataUrlWithTimeout(foto.url);
          if (dataUrl) dataUrls.push(dataUrl);
        }
        photoDataMap.set(r.id, dataUrls);
      }),
    );

    // Logo
    let logoDataUrl: string | null = null;
    if (brandingLogo) {
      logoDataUrl = await urlToDataUrlWithTimeout(brandingLogo);
    }

    const bulanLabel = namaBulan(bulan);

    // ========== GROUP BY TRAINER_ID ==========
    const byTrainer = new Map<string, ReportWithTrainer[]>();
    for (const r of laporanPeriode) {
      const key = r.trainer_id || "tanpa-trainer";
      const cur = byTrainer.get(key) ?? [];
      cur.push(r);
      byTrainer.set(key, cur);
    }

    // Urutkan trainer berdasarkan nama
    const trainerSections = [...byTrainer.entries()].sort(([, a], [, b]) => {
      const nA = a[0]?.trainers?.nama_lengkap || "";
      const nB = b[0]?.trainers?.nama_lengkap || "";
      return nA.localeCompare(nB);
    });

    const totalTrainer = trainerSections.length;

    // ========== RENDER SECTION PER TRAINER ==========
    const sections = trainerSections
      .map(([trainerId, list], trainerIdx) => {
        // Info trainer (dari record pertama)
        const firstReport = list[0];
        const trainerInfo = {
          nama: firstReport?.trainers?.nama_lengkap || "—",
          nomorId: firstReport?.trainers?.nomor_id_trainer || "—",
          jabatan: firstReport?.trainers?.jabatan || "—",
          departemen: DEPARTEMEN_LABEL,
        };

        // Group by tanggal (untuk rowspan)
        const byTanggal = new Map<string, ReportWithTrainer[]>();
        for (const r of list) {
          const key = r.tanggal_kegiatan || "tanpa-tanggal";
          const cur = byTanggal.get(key) ?? [];
          cur.push(r);
          byTanggal.set(key, cur);
        }
        const tanggalList = [...byTanggal.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        );

        // Bangun row tabel
        let noUrut = 1;
        const tbodyHtml = tanggalList
          .map(([tanggal, tglList]) => {
            return tglList
              .map((item, idx) => {
                const fotos = photoDataMap.get(item.id) ?? [];
                const rowSpan = tglList.length;
                const isFirstRow = idx === 0;
                const currentNo = noUrut++;

                const tanggalCell = isFirstRow
                  ? `<td class="col-tanggal" rowspan="${rowSpan}">${escapeHtml(
                      formatTanggal(tanggal),
                    )}</td>`
                  : "";

                const materiText = [
                  escapeHtml(item.materi || "—"),
                  item.jenis_kegiatan
                    ? `<div class="materi-jenis">${escapeHtml(
                        item.jenis_kegiatan,
                      )}</div>`
                    : "",
                  item.keterangan
                    ? `<div class="materi-desc">${escapeHtml(
                        item.keterangan,
                      )}</div>`
                    : "",
                ].join("");

                // FOTO GRID — MAX 5, layout 2x3
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
                    <td class="col-lokasi">${escapeHtml(
                      item.lokasi || "-",
                    )}</td>
                    <td class="col-hadir">${item.jumlah_hadir ?? 0}</td>
                   <td class="col-pj">Muhammad Halid (Superintendent)</td>
                    <td class="col-foto">${fotoHtml}</td>
                  </tr>
                `;
              })
              .join("");
          })
          .join("");

        const totalHadirTrainer = list.reduce(
          (s, r) => s + Number(r.jumlah_hadir || 0),
          0,
        );

        const isFirst = trainerIdx === 0;

        const logoHtml = logoDataUrl
          ? `<img src="${logoDataUrl}" class="logo" alt="Logo" />`
          : `<div class="logo-fallback">K3</div>`;

        return `
          <section class="page ${isFirst ? "" : "page-break"}">
            <!-- HEADER -->
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

            <!-- KARTU IDENTITAS TRAINER -->
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
                <div class="trainer-value">${escapeHtml(
                  trainerInfo.departemen,
                )}</div>
              </div>
            </div>

            <!-- TABEL KEGIATAN -->
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

            <!-- SUMMARY PER TRAINER -->
            <div class="summary">
              Total kegiatan: ${list.length} &nbsp;•&nbsp; 
              Total peserta hadir: ${totalHadirTrainer.toLocaleString("id-ID")} orang
            </div>

            <!-- FOOTER -->
            <div class="footer">
              <span>Trainer ${trainerIdx + 1} dari ${totalTrainer} &nbsp;|&nbsp; Periode: <strong>${escapeHtml(
                bulanLabel,
              )}</strong></span>
              <span>Dicetak: <strong>${escapeHtml(
                new Date().toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }),
              )}</strong></span>
            </div>
          </section>
        `;
      })
      .join("");

    // HTML lengkap
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

    .page {
      padding: 12mm 8mm;
      min-height: 100vh;
    }
    .page-break {
      page-break-before: always;
    }

    /* ============ HEADER ============ */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
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
    .brand-sub {
      font-size: 12px; font-weight: 800; color: #124a82; margin-top: 3px;
    }
    .header-right { text-align: right; }
    .header-right .lbl { font-size: 15px; font-weight: 900; color: #124a82; }
    .header-right .val {
      font-size: 11px; font-weight: 700; color: #124a82; margin-top: 4px;
    }

    /* ============ DIVIDER ============ */
    .divider {
      height: 3px; background: #0b5aa5; margin: 8px 0 12px; border-radius: 2px;
    }

    /* ============ KARTU TRAINER ============ */
    .trainer-card {
      display: grid;
      grid-template-columns: 1.3fr 1fr 1fr 1fr;
      border: 1.5px solid #b8d9f7;
      border-radius: 6px;
      background: #f5faff;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .trainer-cell {
      padding: 8px 10px;
      border-right: 1.5px solid #d4e4f2;
    }
    .trainer-cell:last-child { border-right: none; }
    .trainer-label {
      font-size: 7px; font-weight: 700; color: #3978ab;
      text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px;
    }
    .trainer-value {
      font-size: 11px; font-weight: 900; color: #124a82; line-height: 1.2;
    }

    /* ============ TABEL ============ */
    table {
      width: 100%; border-collapse: collapse; table-layout: fixed;
      margin-bottom: 8px;
    }
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
    .col-jam { text-align: center; white-space: nowrap; }
    .col-materi { font-size: 8.5px; }
    .col-kelas { text-align: center; }
    .col-lokasi { text-align: center; }
    .col-hadir { text-align: center; font-weight: 800; font-size: 10px; }
    .col-pj { text-align: center; font-size: 7.5px; }
    .col-foto { text-align: center; padding: 4px; }

    .materi-jenis {
      font-size: 7px; color: #63809a; margin-top: 3px; font-style: italic;
    }
    .materi-desc {
      font-size: 7px; color: #4a5f75; margin-top: 3px; font-style: italic;
    }

    /* ============ FOTO GRID — MAX 5, GEDE ============ */
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
      width: 100%;
    }
    .photo {
      width: 100%;
      height: 95px;
      object-fit: cover;
      border-radius: 3px;
      border: 1px solid #b9d8f2;
      background: #eef6fc;
      display: block;
    }
    /* Foto ke-5 (index 4) tampil lebih besar full width */
    .photo-grid .photo:only-child,
    .photo-grid .photo:nth-child(5):last-child {
      grid-column: span 2;
      height: 130px;
    }
    .no-photo {
      padding: 20px 4px; color: #8ba0b3; font-size: 8px;
    }

    /* ============ SUMMARY ============ */
    .summary {
      background: #f0f7ff;
      border: 1.5px solid #b8d9f7;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 9px;
      color: #124a82;
      font-weight: 700;
      margin-top: 6px;
    }

    /* ============ FOOTER ============ */
    .footer {
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #d4e4f2;
      display: flex;
      justify-content: space-between;
      font-size: 7px;
      color: #6b8297;
    }
    .footer strong { color: #124a82; }

    /* ============ PRINT ============ */
    @page {
      size: A4 landscape;
      margin: 8mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; min-height: auto; }
      .page-break { page-break-before: always; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${sections}
</body>
</html>
    `;

    return {
      html,
      fileName: `Laporan-Bulanan-K3-${bulan}`,
    };
  }

  // Preview PDF (HTML)
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

  // Download PDF via print dialog
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
      <AppShell title="Monitoring Laporan" eyebrow="Laporan Kegiatan Trainer K3">
        <Panel>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Memuat monitoring laporan…
          </p>
        </Panel>
      </AppShell>
    );
  }

  if (!isStaff && !isTrainer) {
    return (
      <AppShell title="Monitoring Laporan">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki akses ke halaman monitoring laporan.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Monitoring Laporan"
      eyebrow="Laporan Kegiatan Trainer K3"
      actions={
        <Button
          variant="outline"
          onClick={previewPDF}
          disabled={filteredReports.length === 0 || pdfBuilding}
        >
          <Download className="mr-2 size-4" />
          {pdfBuilding ? "Menyiapkan…" : "Download Laporan Bulanan"}
        </Button>
      }
    >
      {/* HERO */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <BarChart3 className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Monitoring Laporan
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Pantau status, perkembangan, dan aktivitas laporan trainer K3
                secara terpusat.
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 md:block">
            <FileBarChart2 className="size-20 text-primary/15" />
          </div>
        </div>
      </div>

      {/* FILTER */}
      <Panel className="mb-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Filter Monitoring</p>
            <p className="text-xs text-muted-foreground">
              Gunakan filter untuk melihat laporan sesuai kebutuhan.
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
            <p className="text-xs font-medium text-muted-foreground">
              Dari tanggal
            </p>
            <Input type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Sampai tanggal
            </p>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </div>

          {isStaff ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Trainer
              </p>
              <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Trainer</SelectItem>
                  {trainers.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nama_lengkap}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Trainer
              </p>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                {trainer?.nama_lengkap || "Trainer"}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Jenis kegiatan
            </p>
            <Select value={jenisKegiatan} onValueChange={setJenisKegiatan}>
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
            <p className="text-xs font-medium text-muted-foreground">
              Status
            </p>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as FilterStatus)}
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
            <p className="text-xs font-medium text-muted-foreground">
              Cari
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Materi, kegiatan, kelas…"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Panel>

      {/* STATISTICS */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Laporan"
          value={stats.total}
          description="Laporan sesuai filter"
          icon={FileText}
          tone="blue"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value={stats.menunggu}
          description="Perlu diperiksa staff"
          icon={Clock3}
          tone="yellow"
        />
        <StatCard
          title="Terverifikasi"
          value={stats.terverifikasi}
          description="Laporan sudah selesai"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          title="Perlu Revisi"
          value={stats.revisi}
          description="Menunggu perbaikan trainer"
          icon={XCircle}
          tone="red"
        />
      </div>

      {/* QUICK SUMMARY */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Total Peserta Hadir
              </p>
              <p className="num text-2xl font-bold">
                {stats.totalHadir.toLocaleString("id-ID")}
              </p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Periode Monitoring
              </p>
              <p className="text-sm font-semibold">
                {dari || sampai
                  ? `${dari ? formatTanggal(dari) : "Awal"} – ${
                      sampai ? formatTanggal(sampai) : "Sekarang"
                    }`
                  : "Semua periode"}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* CHARTS */}
      <div className="mb-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <div className="mb-5">
            <p className="font-semibold">Tren Laporan</p>
            <p className="text-xs text-muted-foreground">
              Perkembangan jumlah laporan berdasarkan tanggal kegiatan.
            </p>
          </div>
          <TrendChart reports={filteredReports} />
        </Panel>
        <Panel>
          <div className="mb-5">
            <p className="font-semibold">Status Laporan</p>
            <p className="text-xs text-muted-foreground">
              Distribusi status laporan pada periode yang dipilih.
            </p>
          </div>
          <StatusChart
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
          <div className="mb-5">
            <p className="font-semibold">Jenis Kegiatan</p>
            <p className="text-xs text-muted-foreground">
              Jumlah laporan berdasarkan jenis kegiatan.
            </p>
          </div>
          <ActivityChart reports={filteredReports} />
        </Panel>
        <Panel>
          <div className="mb-5">
            <p className="font-semibold">Ringkasan Status</p>
            <p className="text-xs text-muted-foreground">
              Kondisi laporan yang sedang dipantau.
            </p>
          </div>
          <div className="space-y-4">
            <MiniLegend
              label="Terverifikasi"
              value={stats.terverifikasi}
              className="bg-status-verified"
            />
            <MiniLegend
              label="Menunggu Verifikasi"
              value={stats.menunggu}
              className="bg-status-warning"
            />
            <MiniLegend
              label="Perlu Revisi"
              value={stats.revisi}
              className="bg-destructive"
            />
            <MiniLegend
              label="Terkirim"
              value={stats.terkirim}
              className="bg-primary"
            />
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="num text-lg font-bold">{stats.total}</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* REPORT TABLE */}
      <Panel className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Daftar Laporan</p>
            <p className="text-xs text-muted-foreground">
              {filteredReports.length.toLocaleString("id-ID")} laporan ditemukan
              sesuai filter.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={previewPDF}
            disabled={filteredReports.length === 0 || pdfBuilding}
          >
            <Download className="mr-2 size-4" />
            {pdfBuilding ? "Menyiapkan…" : "Download Bulanan"}
          </Button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Memuat data monitoring…
            </p>
          </div>
        ) : isError ? (
          <div className="p-10 text-center">
            <p className="font-medium text-destructive">
              Gagal mengambil data laporan.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Coba refresh halaman atau ubah filter.
            </p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-4 font-semibold">Belum ada laporan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tidak ada laporan yang sesuai dengan filter saat ini.
            </p>
            {hasFilter ? (
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                onClick={resetFilter}
              >
                <RefreshCcw className="mr-2 size-4" />
                Reset Filter
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-left">
                    <th className="eyebrow whitespace-nowrap px-4 py-3 text-muted-foreground">
                      No
                    </th>
                    <th className="eyebrow whitespace-nowrap px-4 py-3 text-muted-foreground">
                      Tanggal
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Trainer
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Materi / Kegiatan
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Jenis
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Lokasi
                    </th>
                    <th className="eyebrow whitespace-nowrap px-4 py-3 text-muted-foreground">
                      Hadir
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
                  {filteredReports.map((report, index) => (
                    <tr
                      key={report.id}
                      className="border-b border-border/60 transition-colors hover:bg-muted/20"
                    >
                      <td className="num px-4 py-3 text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatTanggal(report.tanggal_kegiatan)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[140px]">
                          <p className="font-medium">
                            {report.trainers?.nama_lengkap || "—"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {report.trainers?.nomor_id_trainer || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate font-medium">
                          {report.materi || "Tanpa materi"}
                        </p>
                        {report.kelas ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Kelas: {report.kelas}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {report.jenis_kegiatan || "Lainnya"}
                        </span>
                      </td>
                      <td className="max-w-[150px] px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">
                          {report.lokasi || "—"}
                        </span>
                      </td>
                      <td className="num px-4 py-3">
                        {report.jumlah_hadir ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={report.status_laporan} />
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="icon"
                          variant="outline"
                          title="Preview laporan"
                          onClick={() => bukaPreview(report)}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {filteredReports.map((report, index) => (
                <div key={report.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        No. {index + 1} · {formatTanggal(report.tanggal_kegiatan)}
                      </p>
                      <p className="mt-1 truncate font-semibold">
                        {report.materi || "Tanpa materi"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {report.trainers?.nama_lengkap || "—"}
                      </p>
                    </div>
                    <StatusPill status={report.status_laporan} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Jenis</p>
                      <p className="mt-0.5 font-medium">
                        {report.jenis_kegiatan || "Lainnya"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hadir</p>
                      <p className="num mt-0.5 font-medium">
                        {report.jumlah_hadir ?? 0}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Lokasi</p>
                      <p className="mt-0.5 font-medium">
                        {report.lokasi || "—"}
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    onClick={() => bukaPreview(report)}
                  >
                    <Eye className="mr-2 size-4" />
                    Lihat Detail
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* PDF PREVIEW MODAL (HTML) */}
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

      {/* PREVIEW DETAIL MODAL */}
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

              {isStaff ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Aksi Verifikasi
                  </p>

                  {preview.status_laporan === "terkirim" ||
                  preview.status_laporan === "menunggu_verifikasi" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => bukaVerifAction(preview, "verifikasi")}
                        className="bg-status-verified text-white hover:bg-status-verified/90"
                      >
                        <CheckCircle2 className="mr-2 size-4" />
                        Verifikasi
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => bukaVerifAction(preview, "revisi")}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <RotateCcw className="mr-2 size-4" />
                        Minta Revisi
                      </Button>
                    </div>
                  ) : preview.status_laporan === "terverifikasi" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => bukaVerifAction(preview, "batalkan")}
                      >
                        <RotateCcw className="mr-2 size-4" />
                        Kembalikan ke Revisi
                      </Button>
                    </div>
                  ) : preview.status_laporan === "perlu_revisi" ? (
                    <p className="text-sm text-muted-foreground">
                      Laporan ini sedang menunggu perbaikan dari trainer.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada aksi untuk status ini.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end border-t border-border px-5 py-4">
              <Button onClick={tutupPreview}>Tutup</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL KONFIRMASI VERIFIKASI */}
      {verifAction ? (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setVerifAction(null);
              setCatatanInput("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {verifAction.action === "verifikasi"
                  ? "Verifikasi Laporan?"
                  : verifAction.action === "revisi"
                    ? "Minta Revisi Laporan?"
                    : "Kembalikan Laporan ke Revisi?"}
              </DialogTitle>
              <DialogDescription>
                {verifAction.action === "verifikasi"
                  ? "Laporan akan ditandai sebagai terverifikasi. Tindakan ini bisa dibatalkan nanti."
                  : verifAction.action === "revisi"
                    ? "Laporan akan dikembalikan ke trainer untuk diperbaiki. Wajib isi catatan."
                    : "Verifikasi akan dibatalkan dan laporan dikembalikan ke trainer untuk revisi. Wajib isi catatan."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">
                  {verifAction.report.trainers?.nama_lengkap || "Trainer"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {verifAction.report.materi || "Tanpa materi"} ·{" "}
                  {formatTanggal(verifAction.report.tanggal_kegiatan)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Catatan{" "}
                  {verifAction.action !== "verifikasi" ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground">(opsional)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={catatanInput}
                  onChange={(e) => setCatatanInput(e.target.value)}
                  placeholder={
                    verifAction.action === "verifikasi"
                      ? "Catatan tambahan (opsional)…"
                      : "Tulis catatan untuk trainer…"
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setVerifAction(null);
                  setCatatanInput("");
                }}
              >
                Batal
              </Button>
              <Button
                disabled={
                  verifikasiMutation.isPending ||
                  (verifAction.action !== "verifikasi" &&
                    !catatanInput.trim())
                }
                onClick={() =>
                  verifikasiMutation.mutate({
                    report: verifAction.report,
                    action: verifAction.action,
                    catatan: catatanInput,
                  })
                }
                className={
                  verifAction.action === "verifikasi"
                    ? "bg-status-verified text-white hover:bg-status-verified/90"
                    : "bg-destructive text-white hover:bg-destructive/90"
                }
              >
                {verifikasiMutation.isPending
                  ? "Memproses…"
                  : verifAction.action === "verifikasi"
                    ? "Ya, Verifikasi"
                    : verifAction.action === "revisi"
                      ? "Kirim ke Revisi"
                      : "Kembalikan ke Revisi"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* LIGHTBOX */}
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
