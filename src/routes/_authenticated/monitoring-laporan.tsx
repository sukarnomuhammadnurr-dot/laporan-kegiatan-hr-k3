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
  Send,
  Users,
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
// PART 2 — Komponen utama + verifikasi + PDF
// =============================================================

function MonitoringLaporanPage() {
  const { isStaff, isTrainer, trainer, loading, user, nama } = useCurrentUser();
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
  const [downloading, setDownloading] = useState(false);

  // Aksi verifikasi
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

  // ---------- Util ----------
  function hitungDurasiJam(jamMulai: string | null, jamSelesai: string | null) {
    if (!jamMulai || !jamSelesai) return 0;
    const [h1, m1] = jamMulai.split(":").map(Number);
    const [h2, m2] = jamSelesai.split(":").map(Number);
    if ([h1, m1, h2, m2].some((v) => Number.isNaN(v))) return 0;
    let menit = h2! * 60 + m2! - (h1! * 60 + m1!);
    if (menit < 0) menit += 24 * 60;
    return menit / 60;
  }

  function formatJamTraining(jam: number) {
    if (!jam) return "0 jam";
    const jamBulat = Math.floor(jam);
    const menit = Math.round((jam - jamBulat) * 60);
    if (menit === 0) return `${jamBulat} jam`;
    return `${jamBulat} jam ${menit} menit`;
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

  function statusHarian(reports: ReportWithTrainer[]) {
    if (reports.every((item) => item.status_laporan === "terverifikasi"))
      return "Terverifikasi";
    if (reports.some((item) => item.status_laporan === "perlu_revisi"))
      return "Perlu Revisi";
    if (reports.some((item) => item.status_laporan === "menunggu_verifikasi"))
      return "Menunggu Verifikasi";
    return "Terkirim";
  }

  // ---------- DOWNLOAD PDF ----------
  async function downloadLaporanBulanan() {
    if (filteredReports.length === 0) {
      window.alert("Tidak ada laporan untuk diunduh.");
      return;
    }

    setDownloading(true);

    try {
      const now = new Date();
      const bulan =
        dari && dari.length >= 7
          ? dari.slice(0, 7)
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const laporanPeriode = filteredReports
        .filter((r) => r.tanggal_kegiatan?.startsWith(bulan))
        .sort((a, b) => {
          const tA = a.tanggal_kegiatan || "";
          const tB = b.tanggal_kegiatan || "";
          return (
            tA.localeCompare(tB) || (a.jam_mulai || "").localeCompare(b.jam_mulai || "")
          );
        });

      if (laporanPeriode.length === 0) {
        window.alert(`Tidak ada laporan untuk periode ${namaBulan(bulan)}.`);
        return;
      }

      const photosMap = await getReportPhotosBatch(
        laporanPeriode.map((r) => r.id),
      );

      const byTanggal = new Map<string, ReportWithTrainer[]>();
      for (const r of laporanPeriode) {
        const key = r.tanggal_kegiatan || "tanpa-tanggal";
        const cur = byTanggal.get(key) ?? [];
        cur.push(r);
        byTanggal.set(key, cur);
      }

      const rekapMateri = new Map<string, { kegiatan: number; hadir: number }>();
      for (const r of laporanPeriode) {
        const key = r.materi?.trim() || "Tanpa Materi";
        const cur = rekapMateri.get(key) ?? { kegiatan: 0, hadir: 0 };
        cur.kegiatan += 1;
        cur.hadir += Number(r.jumlah_hadir || 0);
        rekapMateri.set(key, cur);
      }
      const rekapRows = [...rekapMateri.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );

      const totalKegiatan = laporanPeriode.length;
      const totalHadir = laporanPeriode.reduce(
        (s, r) => s + Number(r.jumlah_hadir || 0),
        0,
      );
      const totalJam = laporanPeriode.reduce(
        (s, r) => s + hitungDurasiJam(r.jam_mulai, r.jam_selesai),
        0,
      );

      const tanggalSections = [...byTanggal.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tanggal, list]) => {
          const status = statusHarian(list);

          const trainerMap = new Map<
            string,
            { nama: string; nomor: string; jabatan: string; departemen: string }
          >();
          for (const r of list) {
            const tid = r.trainer_id ?? "unknown";
            if (!trainerMap.has(tid)) {
              trainerMap.set(tid, {
                nama: r.trainers?.nama_lengkap || "—",
                nomor: r.trainers?.nomor_id_trainer || "—",
                jabatan: r.trainers?.jabatan || "—",
                departemen: r.trainers?.departemen || "—",
              });
            }
          }
          const trainersList = [...trainerMap.values()];

          const trainerCards = trainersList
            .map(
              (t) => `
                <div class="trainer-card">
                  <div class="trainer-cell">
                    <div class="trainer-label">NAMA TRAINER</div>
                    <div class="trainer-value">${escapeHtml(t.nama)}</div>
                  </div>
                  <div class="trainer-cell">
                    <div class="trainer-label">NO. ID TRAINER</div>
                    <div class="trainer-value">${escapeHtml(t.nomor)}</div>
                  </div>
                  <div class="trainer-cell">
                    <div class="trainer-label">JABATAN</div>
                    <div class="trainer-value">${escapeHtml(t.jabatan)}</div>
                  </div>
                  <div class="trainer-cell">
                    <div class="trainer-label">DEPARTEMEN</div>
                    <div class="trainer-value">${escapeHtml(t.departemen)}</div>
                  </div>
                </div>
              `,
            )
            .join("");

          const listHtml = list
            .map((item, idx) => {
              const fotos = (photosMap.get(item.id) ?? []).filter((p) => p.url);
              const fotoHtml =
                fotos.length === 0
                  ? `<div class="no-photo">Tidak ada foto</div>`
                  : `<div class="photo-strip">${fotos
                      .map(
                        (p) =>
                          `<img src="${p.url}" class="activity-photo" alt="${escapeHtml(
                            p.nama_file || "Dokumentasi",
                          )}" />`,
                      )
                      .join("")}</div>`;

              return `
                <tr>
                  <td class="center number-cell">${idx + 1}</td>
                  <td class="time-cell">
                    <strong>${escapeHtml(item.jam_mulai?.slice(0, 5) || "—")}</strong>
                    ${
                      item.jam_selesai
                        ? `<span class="time-end">- ${escapeHtml(
                            item.jam_selesai.slice(0, 5),
                          )}</span>`
                        : ""
                    }
                  </td>
                  <td class="activity-cell">
                    <div class="activity-title">${escapeHtml(
                      item.materi || "—",
                    )}</div>
                    ${
                      item.jenis_kegiatan
                        ? `<div class="activity-type">${escapeHtml(
                            item.jenis_kegiatan,
                          )}</div>`
                        : ""
                    }
                    ${
                      item.keterangan
                        ? `<div class="activity-desc">${escapeHtml(
                            item.keterangan,
                          )}</div>`
                        : ""
                    }
                  </td>
                  <td>${escapeHtml(item.kelas || "—")}</td>
                  <td>${escapeHtml(item.lokasi || "—")}</td>
                  <td class="center participant-cell">
                    <strong>${Number(item.jumlah_hadir || 0).toLocaleString(
                      "id-ID",
                    )}</strong>
                    <div class="small-info">
                      Peserta: ${Number(item.jumlah_peserta || 0).toLocaleString(
                        "id-ID",
                      )}
                    </div>
                  </td>
                  <td class="photo-cell">${fotoHtml}</td>
                </tr>
              `;
            })
            .join("");

          const totalHadirHari = list.reduce(
            (s, r) => s + Number(r.jumlah_hadir || 0),
            0,
          );

          return `
            <section class="page">
              <header class="report-header">
                <div class="brand-block">
                  ${
                    brandingLogo
                      ? `<img src="${brandingLogo}" class="company-logo" alt="Logo" />`
                      : `<div class="logo-fallback">K3</div>`
                  }
                  <div>
                    <div class="brand-title">LAPORAN KEGIATAN TRAINER K3</div>
                    <div class="brand-subtitle">PT IWIP</div>
                  </div>
                </div>
                <div class="month-block">
                  <div class="month-label">LAPORAN BULANAN</div>
                  <div class="month-value">${escapeHtml(namaBulan(bulan))}</div>
                </div>
              </header>
              <div class="header-line"></div>

              <div class="date-header">
                <div class="date-label">HARI / TANGGAL</div>
                <div class="date-value">${escapeHtml(
                  formatTanggalPanjang(tanggal),
                )}</div>
                <div class="date-status status-${status
                  .toLowerCase()
                  .replaceAll(" ", "-")}">✓ ${escapeHtml(status)}</div>
              </div>

              ${trainerCards}

              <div class="activity-wrapper">
                <table>
                  <colgroup>
                    <col style="width: 4%" />
                    <col style="width: 9%" />
                    <col style="width: 24%" />
                    <col style="width: 9%" />
                    <col style="width: 12%" />
                    <col style="width: 8%" />
                    <col style="width: 34%" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Jam</th>
                      <th>Materi / Kegiatan & Deskripsi</th>
                      <th>Kelas</th>
                      <th>Lokasi</th>
                      <th>Hadir</th>
                      <th>Dokumentasi</th>
                    </tr>
                  </thead>
                  <tbody>${listHtml}</tbody>
                </table>
              </div>

              <div class="day-summary">
                Total kegiatan hari ini: <b>${list.length}</b> ·
                Total peserta hadir: <b>${totalHadirHari.toLocaleString(
                  "id-ID",
                )}</b> orang
              </div>
            </section>
          `;
        })
        .join("");

      const rekapHtml = `
        <section class="page recap-page">
          <header class="report-header">
            <div class="brand-block">
              ${
                brandingLogo
                  ? `<img src="${brandingLogo}" class="company-logo" alt="Logo" />`
                  : `<div class="logo-fallback">K3</div>`
              }
              <div>
                <div class="brand-title">REKAPITULASI BULANAN</div>
                <div class="brand-subtitle">PT IWIP</div>
              </div>
            </div>
            <div class="month-block">
              <div class="month-label">PERIODE</div>
              <div class="month-value">${escapeHtml(namaBulan(bulan))}</div>
            </div>
          </header>
          <div class="header-line"></div>

          <div class="activity-wrapper">
            <table>
              <colgroup>
                <col style="width: 55%" />
                <col style="width: 22%" />
                <col style="width: 23%" />
              </colgroup>
              <thead>
                <tr>
                  <th style="text-align:left;padding-left:10px">Materi</th>
                  <th>Jumlah Kegiatan</th>
                  <th>Peserta Hadir</th>
                </tr>
              </thead>
              <tbody>
                ${rekapRows
                  .map(
                    ([materi, v]) => `
                    <tr>
                      <td style="padding-left:10px"><b>${escapeHtml(
                        materi,
                      )}</b></td>
                      <td class="center">${v.kegiatan}</td>
                      <td class="center"><b>${v.hadir.toLocaleString(
                        "id-ID",
                      )}</b></td>
                    </tr>
                  `,
                  )
                  .join("")}
                <tr class="total-row">
                  <td style="padding-left:10px"><b>TOTAL</b></td>
                  <td class="center"><b>${totalKegiatan}</b></td>
                  <td class="center"><b>${totalHadir.toLocaleString(
                    "id-ID",
                  )}</b></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="summary-section
