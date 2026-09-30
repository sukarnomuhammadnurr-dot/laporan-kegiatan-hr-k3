import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileBarChart2,
  FileText,
  Filter,
  RefreshCcw,
  Search,
  Users,
  XCircle,
} from "lucide-react";

import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { useBrandingUrl } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/monitoring-laporan")({
  head: () => ({
    meta: [
      {
        title: "Monitoring Laporan · Laporan Kegiatan Trainer K3 PT IWIP",
      },
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

function StatusPill({
  status,
}: {
  status: string | null | undefined;
}) {
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
    blue: {
      icon: "bg-primary/10 text-primary",
      value: "text-foreground",
    },
    yellow: {
      icon: "bg-status-warning/15 text-status-warning",
      value: "text-foreground",
    },
    green: {
      icon: "bg-status-verified/15 text-status-verified",
      value: "text-foreground",
    },
    red: {
      icon: "bg-destructive/10 text-destructive",
      value: "text-foreground",
    },
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

function TrendChart({
  reports,
}: {
  reports: ReportWithTrainer[];
}) {
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
            <div
              key={item}
              className="border-t border-dashed border-border/50"
            />
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
    {
      label: "Terverifikasi",
      value: terverifikasi,
      className: "bg-status-verified",
    },
    {
      label: "Menunggu Verifikasi",
      value: menunggu,
      className: "bg-status-warning",
    },
    {
      label: "Perlu Revisi",
      value: revisi,
      className: "bg-destructive",
    },
    {
      label: "Terkirim",
      value: terkirim,
      className: "bg-primary",
    },
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
                total
                  ? ((terverifikasi + menunggu) / total) * 100
                  : 0
              }%,
              hsl(var(--destructive)) ${
                total
                  ? ((terverifikasi + menunggu) / total) * 100
                  : 0
              }% ${
                total
                  ? ((terverifikasi + menunggu + revisi) / total) * 100
                  : 0
              }%,
              hsl(var(--primary)) ${
                total
                  ? ((terverifikasi + menunggu + revisi) / total) * 100
                  : 0
              }% 100%
            )`,
            mask: "radial-gradient(circle, transparent 58%, black 59%)",
            WebkitMask:
              "radial-gradient(circle, transparent 58%, black 59%)",
          }}
        />

        <div className="relative z-10 text-center">
          <p className="num text-3xl font-bold">
            {total.toLocaleString("id-ID")}
          </p>
          <p className="text-xs text-muted-foreground">Laporan</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn("size-2.5 rounded-full", item.className)}
              />
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

function ActivityChart({
  reports,
}: {
  reports: ReportWithTrainer[];
}) {
  const data = useMemo(() => {
    const map = new Map<string, number>();

    for (const report of reports) {
      const key = report.jenis_kegiatan?.trim() || "Lainnya";
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
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
            <span className="num text-xs text-muted-foreground">
              {value}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.max(5, (value / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MonitoringLaporanPage() {
  const { isStaff, isTrainer, trainer, loading } = useCurrentUser();

  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("semua");
  const [status, setStatus] = useState<FilterStatus>("semua");
  const [jenisKegiatan, setJenisKegiatan] = useState("semua");
  const [cari, setCari] = useState("");
  const [preview, setPreview] = useState<ReportWithTrainer | null>(null);
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
      (report) =>
        (report.jenis_kegiatan?.trim() || "Lainnya") === jenisKegiatan,
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


  type ReportPhoto = {
    storage_path: string;
    nama_file: string | null;
    url?: string | null;
  };

  async function getReportPhotos(reportId: string) {
    const { data, error } = await supabase
      .from("report_photos")
      .select("storage_path, nama_file")
      .eq("report_id", reportId)
      .order("nama_file", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as ReportPhoto[];

    return Promise.all(
      rows.map(async (photo) => {
        const { data: signed, error: signedError } =
          await supabase.storage
            .from("report-photos")
            .createSignedUrl(photo.storage_path, 60 * 60);

        return {
          ...photo,
          url:
            signedError || !signed?.signedUrl
              ? null
              : signed.signedUrl,
        };
      }),
    );
  }

  function hitungDurasiJam(
    jamMulai: string | null,
    jamSelesai: string | null,
  ) {
    if (!jamMulai || !jamSelesai) return 0;

    const [h1, m1] = jamMulai.split(":").map(Number);
    const [h2, m2] = jamSelesai.split(":").map(Number);

    if (
      Number.isNaN(h1) ||
      Number.isNaN(m1) ||
      Number.isNaN(h2) ||
      Number.isNaN(m2)
    ) {
      return 0;
    }

    let menit = h2 * 60 + m2 - (h1 * 60 + m1);

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
    if (reports.every((item) => item.status_laporan === "terverifikasi")) {
      return "Terverifikasi";
    }

    if (reports.some((item) => item.status_laporan === "perlu_revisi")) {
      return "Perlu Revisi";
    }

    if (
      reports.some(
        (item) => item.status_laporan === "menunggu_verifikasi",
      )
    ) {
      return "Menunggu Verifikasi";
    }

    return "Terkirim";
  }

  async function downloadLaporanBulanan() {
    const now = new Date();
    const bulan =
      dari && dari.length >= 7
        ? dari.slice(0, 7)
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const laporanBulanan = filteredReports
      .filter((report) => report.tanggal_kegiatan?.startsWith(bulan))
      .sort((a, b) => {
        const tanggalA = a.tanggal_kegiatan || "";
        const tanggalB = b.tanggal_kegiatan || "";
        return (
          tanggalA.localeCompare(tanggalB) ||
          (a.jam_mulai || "").localeCompare(b.jam_mulai || "")
        );
      });

    if (laporanBulanan.length === 0) {
      window.alert(`Tidak ada laporan untuk periode ${namaBulan(bulan)}.`);
      return;
    }

    try {
      const grouped = new Map<string, ReportWithTrainer[]>();

      for (const report of laporanBulanan) {
        const trainerKey = report.trainer_id;
        const current = grouped.get(trainerKey) || [];
        current.push(report);
        grouped.set(trainerKey, current);
      }

      const trainerGroups = [...grouped.values()];

      const monthlyData = await Promise.all(
        trainerGroups.map(async (trainerReports) => ({
          reports: trainerReports,
          photos: await Promise.all(
            trainerReports.map(async (report) => ({
              report,
              photos: await getReportPhotos(report.id),
            })),
          ),
        })),
      );

      const pages = monthlyData.map(({ reports, photos }) => {
        const first = reports[0];
        if (!first) return "";

        const namaTrainer = first.trainers?.nama_lengkap || "Trainer";
        const nomorTrainer =
          first.trainers?.nomor_id_trainer || "—";
        const jabatan = first.trainers?.jabatan || "—";
        const departemen = first.trainers?.departemen || "—";

        const totalKegiatan = reports.length;
        const totalPeserta = reports.reduce(
          (sum, item) => sum + Number(item.jumlah_peserta || 0),
          0,
        );
        const totalHadir = reports.reduce(
          (sum, item) => sum + Number(item.jumlah_hadir || 0),
          0,
        );
        const totalJam = reports.reduce(
          (sum, item) =>
            sum + hitungDurasiJam(item.jam_mulai, item.jam_selesai),
          0,
        );

        const status = statusHarian(reports);

        const kegiatanRows = photos
          .map(({ report: item, photos: reportPhotos }, index) => {
            const fotoHtml =
              reportPhotos.filter((photo) => photo.url).length === 0
                ? `<div class="no-photo">Tidak ada foto</div>`
                : `
                    <div class="photo-strip">
                      ${reportPhotos
                        .filter((photo) => photo.url)
                        .map(
                          (photo) => `
                            <img
                              src="${photo.url}"
                              class="activity-photo"
                              alt="${escapeHtml(photo.nama_file || "Dokumentasi")}" 
                            />
                          `,
                        )
                        .join("")}
                    </div>
                  `;

            return `
              <tr>
                <td class="center number-cell">${index + 1}</td>

                <td class="time-cell">
                  <strong>${escapeHtml(item.jam_mulai || "—")}</strong>
                  ${
                    item.jam_selesai
                      ? `<span class="time-end">- ${escapeHtml(item.jam_selesai)}</span>`
                      : ""
                  }
                </td>

                <td class="activity-cell">
                  <div class="activity-title">
                    ${escapeHtml(item.materi || "—")}
                  </div>
                  ${
                    item.jenis_kegiatan
                      ? `<div class="activity-type">${escapeHtml(item.jenis_kegiatan)}</div>`
                      : ""
                  }
                </td>

                <td>${escapeHtml(item.kelas || "—")}</td>
                <td>${escapeHtml(item.lokasi || "—")}</td>

                <td class="center participant-cell">
                  <strong>${Number(item.jumlah_peserta || 0).toLocaleString("id-ID")}</strong>
                  <div class="small-info">
                    Hadir: ${Number(item.jumlah_hadir || 0).toLocaleString("id-ID")}
                  </div>
                </td>

                <td class="photo-cell">${fotoHtml}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <section class="page">
            <header class="report-header">
              <div class="brand-block">
                ${
                  brandingLogo
                    ? `<img src="${brandingLogo}" class="company-logo" alt="Logo perusahaan" />`
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

            <div class="identity">
              <div class="identity-item">
                <div class="identity-label">Nama Trainer</div>
                <div class="identity-value">${escapeHtml(namaTrainer)}</div>
              </div>
              <div class="identity-item">
                <div class="identity-label">No. ID Trainer</div>
                <div class="identity-value">${escapeHtml(nomorTrainer)}</div>
              </div>
              <div class="identity-item">
                <div class="identity-label">Jabatan</div>
                <div class="identity-value">${escapeHtml(jabatan)}</div>
              </div>
              <div class="identity-item">
                <div class="identity-label">Departemen</div>
                <div class="identity-value">${escapeHtml(departemen)}</div>
              </div>
              <div class="identity-item">
                <div class="identity-label">Periode Laporan</div>
                <div class="identity-value">${escapeHtml(namaBulan(bulan))}</div>
              </div>
              <div class="identity-item status-item">
                <div class="identity-label">Status</div>
                <div class="status status-${status.toLowerCase().replaceAll(" ", "-")}">
                  ✓ ${escapeHtml(status)}
                </div>
              </div>
            </div>

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
                    <th>Materi / Kegiatan</th>
                    <th>Kelas</th>
                    <th>Lokasi</th>
                    <th>Jumlah Peserta</th>
                    <th>Dokumentasi</th>
                  </tr>
                </thead>
                <tbody>${kegiatanRows}</tbody>
              </table>
            </div>

            <div class="summary-section">
              <div class="summary-heading">REKAPITULASI BULANAN</div>
              <div class="summary-grid">
                <div class="summary-card">
                  <div class="summary-label">Total Kegiatan</div>
                  <div class="summary-value">${totalKegiatan}</div>
                  <div class="summary-unit">kegiatan</div>
                </div>
                <div class="summary-card">
                  <div class="summary-label">Total Peserta</div>
                  <div class="summary-value">${totalPeserta.toLocaleString("id-ID")}</div>
                  <div class="summary-unit">orang</div>
                </div>
                <div class="summary-card">
                  <div class="summary-label">Total Hadir</div>
                  <div class="summary-value">${totalHadir.toLocaleString("id-ID")}</div>
                  <div class="summary-unit">orang</div>
                </div>
                <div class="summary-card">
                  <div class="summary-label">Total Jam Training</div>
                  <div class="summary-value">${escapeHtml(formatJamTraining(totalJam))}</div>
                  <div class="summary-unit">durasi kegiatan</div>
                </div>
              </div>
            </div>

            <footer class="footer">
              <span>Dicetak pada: ${escapeHtml(new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }))} &nbsp; | &nbsp; PT IWIP</span>
              <span class="document-number">Laporan Bulanan K3 - ${escapeHtml(namaTrainer)}</span>
            </footer>
          </section>
        `;
      });

      const html = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <title>Laporan Bulanan Trainer K3 - ${escapeHtml(namaBulan(bulan))}</title>
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #124a82;
              background: #fff;
              font-size: 9px;
            }
            .page {
              width: 100%;
              min-height: 180mm;
              page-break-after: always;
              padding-bottom: 2mm;
            }
            .page:last-child { page-break-after: auto; }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 20px;
            }
            .brand-block {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .company-logo {
              width: 58px;
              height: 46px;
              object-fit: contain;
            }
            .logo-fallback {
              width: 58px;
              height: 46px;
              display: grid;
              place-items: center;
              border-radius: 10px;
              background: #0b5aa5;
              color: #fff;
              font-size: 17px;
              font-weight: 900;
            }
            .brand-title {
              color: #124a82;
              font-size: 18px;
              font-weight: 900;
              line-height: 1.05;
              letter-spacing: .2px;
            }
            .brand-subtitle {
              margin-top: 3px;
              color: #124a82;
              font-size: 12px;
              font-weight: 700;
            }
            .month-block { text-align: right; }
            .month-label {
              color: #124a82;
              font-size: 15px;
              font-weight: 900;
            }
            .month-value {
              margin-top: 4px;
              color: #124a82;
              font-size: 12px;
              font-weight: 700;
            }
            .header-line {
              height: 2px;
              margin: 8px 0 9px;
              background: #0b5aa5;
              border-radius: 999px;
            }
            .identity {
              display: grid;
              grid-template-columns: 1.35fr 1.1fr 1fr 1fr 1.25fr .95fr;
              border: 1px solid #b8d9f7;
              border-radius: 7px;
              overflow: hidden;
              background: #f7fbff;
            }
            .identity-item {
              min-height: 48px;
              padding: 7px 9px;
              border-right: 1px solid #cfe5f8;
            }
            .identity-item:last-child { border-right: 0; }
            .identity-label {
              color: #1766a6;
              font-size: 7px;
              margin-bottom: 4px;
            }
            .identity-value {
              color: #123f6d;
              font-size: 9px;
              font-weight: 800;
              line-height: 1.2;
            }
            .status {
              display: inline-flex;
              align-items: center;
              padding: 4px 7px;
              border-radius: 999px;
              background: #dcf7e8;
              color: #12834f;
              font-size: 7px;
              font-weight: 800;
            }
            .activity-wrapper { margin-top: 9px; }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th {
              padding: 6px 4px;
              border: 1px solid #0b5aa5;
              background: #0b5aa5;
              color: white;
              text-align: center;
              font-size: 8px;
              font-weight: 800;
            }
            td {
              padding: 4px 5px;
              border: 1px solid #b9d8f2;
              color: #123f6d;
              font-size: 7.7px;
              vertical-align: middle;
              overflow-wrap: anywhere;
            }
            tbody tr:nth-child(even) { background: #f8fbff; }
            .center { text-align: center; }
            .number-cell { font-size: 9px; font-weight: 800; }
            .time-cell { text-align: center; white-space: nowrap; }
            .time-end { display: block; color: #5d7894; font-size: 7px; }
            .activity-title { font-size: 8.4px; font-weight: 800; color: #124a82; }
            .activity-type { margin-top: 2px; color: #63809a; font-size: 6.9px; }
            .participant-cell strong { font-size: 9px; }
            .small-info { margin-top: 2px; color: #63809a; font-size: 6.6px; }
            .photo-cell { padding: 3px; }
            .photo-strip {
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              gap: 3px;
            }
            .activity-photo {
              width: 82px;
              height: 54px;
              object-fit: cover;
              border-radius: 4px;
              border: 1px solid #b9d8f2;
              background: #eef6fc;
            }
            .no-photo {
              min-height: 45px;
              display: grid;
              place-items: center;
              color: #8ba0b3;
              font-size: 7px;
            }
            .summary-section {
              margin-top: 8px;
              border: 1px solid #b8d9f7;
              border-radius: 7px;
              padding: 7px;
              background: #f8fbff;
            }
            .summary-heading {
              margin-bottom: 6px;
              color: #124a82;
              font-size: 9px;
              font-weight: 900;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 6px;
            }
            .summary-card {
              min-height: 53px;
              border: 1px solid #c7e0f6;
              border-radius: 6px;
              padding: 7px 8px;
              background: white;
            }
            .summary-label { color: #3978ab; font-size: 7px; }
            .summary-value {
              margin-top: 2px;
              color: #124a82;
              font-size: 14px;
              font-weight: 900;
            }
            .summary-unit { color: #6d879e; font-size: 6.5px; }
            .footer {
              display: flex;
              justify-content: space-between;
              gap: 15px;
              margin-top: 6px;
              padding-top: 5px;
              border-top: 1px solid #d4e4f2;
              color: #6b8297;
              font-size: 6.7px;
            }
            .document-number { font-weight: 700; color: #124a82; }
            @page { size: A4 landscape; margin: 8mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>${pages.join("")}</body>
        </html>
      `;

      const win = window.open("", "_blank", "width=1400,height=900");

      if (!win) {
        window.alert(
          "Popup diblokir browser. Silakan izinkan popup untuk membuka Preview PDF.",
        );
        return;
      }

      win.document.open();
      win.document.write(html);
      win.document.close();

      const images = Array.from(win.document.images);
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
        ),
      );

      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
    } catch (error) {
      console.error("Gagal menyiapkan laporan bulanan:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Gagal menyiapkan laporan bulanan.",
      );
    }
  }
  if (loading) {
    return (
      <AppShell
        title="Monitoring Laporan"
        eyebrow="Laporan Kegiatan Trainer K3"
      >
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
          onClick={downloadLaporanBulanan}
          disabled={filteredReports.length === 0}
        >
          <Download className="mr-2 size-4" />
          Download Laporan Bulanan
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
                Pantau status, perkembangan, dan aktivitas laporan trainer
                K3 secara terpusat.
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
            <Input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
            />
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

              <Select
                value={trainerFilter}
                onValueChange={setTrainerFilter}
              >
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

            <Select
              value={jenisKegiatan}
              onValueChange={setJenisKegiatan}
            >
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
              onValueChange={(value) =>
                setStatus(value as FilterStatus)
              }
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
                <SelectItem value="terverifikasi">
                  Terverifikasi
                </SelectItem>
                <SelectItem value="perlu_revisi">
                  Perlu Revisi
                </SelectItem>
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
                Total Peserta
              </p>
              <p className="num text-2xl font-bold">
                {stats.totalPeserta.toLocaleString("id-ID")}
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
                <span className="text-sm text-muted-foreground">
                  Total
                </span>
                <span className="num text-lg font-bold">
                  {stats.total}
                </span>
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
              {filteredReports.length.toLocaleString("id-ID")} laporan
              ditemukan sesuai filter.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={downloadLaporanBulanan}
            disabled={filteredReports.length === 0}
          >
            <Download className="mr-2 size-4" />
            Download Bulanan
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

            <p className="mt-4 font-semibold">
              Belum ada laporan
            </p>

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
            {/* DESKTOP */}
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
                      Peserta
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
                        {report.jumlah_peserta ?? 0}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill status={report.status_laporan} />
                      </td>

                      <td className="px-4 py-3">
                        <Button
                          size="icon"
                          variant="outline"
                          title="Preview laporan"
                          onClick={() => setPreview(report)}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="divide-y divide-border md:hidden">
              {filteredReports.map((report, index) => (
                <div key={report.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">
                        No. {index + 1} ·{" "}
                        {formatTanggal(report.tanggal_kegiatan)}
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
                      <p className="text-muted-foreground">Peserta</p>
                      <p className="num mt-0.5 font-medium">
                        {report.jumlah_peserta ?? 0}
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
                    onClick={() => setPreview(report)}
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

      {/* PREVIEW */}
      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreview(null);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-lg font-semibold">
                  Detail Laporan
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTanggalPanjang(preview.tanggal_kegiatan)}
                </p>
              </div>

              <Button
                size="icon"
                variant="outline"
                onClick={() => setPreview(null)}
              >
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

                <DetailItem
                  label="Tanggal"
                  value={formatTanggalPanjang(
                    preview.tanggal_kegiatan,
                  )}
                />

                <DetailItem
                  label="Jam"
                  value={
                    preview.jam_mulai && preview.jam_selesai
                      ? `${preview.jam_mulai.slice(
                          0,
                          5,
                        )} – ${preview.jam_selesai.slice(0, 5)}`
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

                <DetailItem
                  label="Kelas"
                  value={preview.kelas || "—"}
                />

                <DetailItem
                  label="Lokasi"
                  value={preview.lokasi || "—"}
                />

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
                  <DetailNumber
                    label="Peserta"
                    value={preview.jumlah_peserta}
                  />

                  <DetailNumber
                    label="Hadir"
                    value={preview.jumlah_hadir}
                  />

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
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status Laporan
                  </p>

                  <StatusPill status={preview.status_laporan} />
                </div>
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
            </div>

            <div className="flex justify-end border-t border-border px-5 py-4">
              <Button onClick={() => setPreview(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function DetailNumber({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-xl font-bold">
        {value ?? 0}
      </p>
    </div>
  );
}
