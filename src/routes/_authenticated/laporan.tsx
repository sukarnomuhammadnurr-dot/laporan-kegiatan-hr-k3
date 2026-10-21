import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Image as ImageIcon,
  Pencil,
  RotateCcw,
  Trash2,
  X,
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
  hapusLaporanPermanent,
  type ReportWithTrainer,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useBrandingUrl } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/laporan")({
  head: () => ({
    meta: [{ title: "Laporan Kegiatan · Laporan Trainer K3 PT IWIP" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    bulan: (search.bulan as string) || undefined,
    dari: (search.dari as string) || undefined,
    sampai: (search.sampai as string) || undefined,
    status: (search.status as string) || undefined,
  }),
  component: LaporanPage,
});

const PER_HALAMAN = 10;

type FilterStatus =
  | "semua"
  | "terkirim"
  | "menunggu_verifikasi"
  | "terverifikasi"
  | "perlu_revisi";

type ReportPhoto = {
  storage_path: string;
  nama_file: string | null;
  url?: string | null;
};

function bulanIni() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

function listBulan(startYear = 2026, endYear = 2040) {
  const result: string[] = [];
  for (let y = endYear; y >= startYear; y--) {
    for (let m = 12; m >= 1; m--) {
      result.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return result;
}

function formatTanggal(tanggal: string | null | undefined) {
  if (!tanggal) return "—";
  return new Date(`${tanggal}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTanggalPanjang(tanggal: string | null | undefined) {
  if (!tanggal) return "—";
  return new Date(`${tanggal}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const label =
    status === "terverifikasi"
      ? "Terverifikasi"
      : status === "perlu_revisi"
        ? "Perlu Revisi"
        : status === "menunggu_verifikasi"
          ? "Menunggu Verifikasi"
          : status === "terkirim"
            ? "Terkirim"
            : status || "—";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        status === "terverifikasi" &&
          "bg-status-verified/15 text-status-verified",
        status === "perlu_revisi" && "bg-destructive/10 text-destructive",
        status === "menunggu_verifikasi" &&
          "bg-status-warning/15 text-status-warning",
        status === "terkirim" && "bg-primary/10 text-primary",
        ![
          "terverifikasi",
          "perlu_revisi",
          "menunggu_verifikasi",
          "terkirim",
        ].includes(status ?? "") &&
          "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
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
   FOTO
========================================================= */

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
      const { data: signed, error: signedError } = await supabase.storage
        .from("report-photos")
        .createSignedUrl(photo.storage_path, 60 * 60);

      return {
        ...photo,
        url: signedError || !signed?.signedUrl ? null : signed.signedUrl,
      };
    }),
  );
}

async function getDailyReportPhotos(reports: ReportWithTrainer[]) {
  return Promise.all(
    reports.map(async (report) => ({
      report,
      photos: await getReportPhotos(report.id),
    })),
  );
}

/* =========================================================
   VERIFIKASI
========================================================= */

async function verifikasiLaporan(
  report: ReportWithTrainer,
  userId: string,
) {
  if (report.status_laporan !== "menunggu_verifikasi") {
    throw new Error("Laporan ini tidak sedang menunggu verifikasi.");
  }

  const { error: updateError } = await supabase
    .from("reports")
    .update({
      status_laporan: "terverifikasi",
      verified_by: userId,
      verified_at: new Date().toISOString(),
      catatan_revisi: null,
    })
    .eq("id", report.id);

  if (updateError) throw updateError;

  const { error: verificationError } = await supabase
    .from("report_verifications")
    .insert({
      report_id: report.id,
      verifier_id: userId,
      hasil: "terverifikasi",
      catatan: "Laporan diverifikasi.",
    });

  if (verificationError) throw verificationError;
}

async function mintaRevisiLaporan(
  report: ReportWithTrainer,
  userId: string,
  catatan: string,
) {
  const trimmed = catatan.trim();
  if (!trimmed) throw new Error("Catatan revisi wajib diisi.");

  if (report.status_laporan !== "menunggu_verifikasi") {
    throw new Error("Laporan ini tidak sedang menunggu verifikasi.");
  }

  const { error: updateError } = await supabase
    .from("reports")
    .update({
      status_laporan: "perlu_revisi",
      catatan_revisi: trimmed,
      verified_by: null,
      verified_at: null,
    })
    .eq("id", report.id);

  if (updateError) throw updateError;

  const { error: verificationError } = await supabase
    .from("report_verifications")
    .insert({
      report_id: report.id,
      verifier_id: userId,
      hasil: "perlu_revisi",
      catatan: trimmed,
    });

  if (verificationError) throw verificationError;
}

async function kembalikanKeRevisiLaporan(
  report: ReportWithTrainer,
  userId: string,
  catatan: string,
) {
  const trimmed = catatan.trim();
  if (!trimmed) throw new Error("Catatan revisi wajib diisi.");

  if (report.status_laporan !== "terverifikasi") {
    throw new Error("Laporan ini tidak sedang berstatus terverifikasi.");
  }

  const { error: updateError } = await supabase
    .from("reports")
    .update({
      status_laporan: "perlu_revisi",
      catatan_revisi: trimmed,
      verified_by: null,
      verified_at: null,
    })
    .eq("id", report.id);

  if (updateError) throw updateError;

  const { error: verificationError } = await supabase
    .from("report_verifications")
    .insert({
      report_id: report.id,
      verifier_id: userId,
      hasil: "perlu_revisi",
      catatan: trimmed,
    });

  if (verificationError) throw verificationError;
}

/* =========================================================
   JAM TRAINING
========================================================= */

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

function buatNomorDokumen(
  report: ReportWithTrainer,
  reports: ReportWithTrainer[],
) {
  const tanggal = report.tanggal_kegiatan || "";
  const tahun = tanggal.slice(0, 4) || "0000";
  const bulan = tanggal.slice(5, 7) || "00";
  const nomorTrainer =
    report.trainers?.nomor_id_trainer ||
    report.trainer_id.slice(0, 8).toUpperCase();
  const angkaTrainer =
    nomorTrainer.match(/\d+/)?.[0] ||
    String(
      Math.abs(
        reports.reduce((sum, item) => sum + item.id.charCodeAt(0), 0),
      ),
    ).padStart(5, "0");

  return `LAP-K3/${tahun}/${bulan}/${angkaTrainer}`;
}

/* =========================================================
   DOWNLOAD DAILY TRAINING ACTIVITY REPORT
========================================================= */

async function downloadLaporan(
  report: ReportWithTrainer,
  brandingLogoUrl?: string | null,
) {
  const namaTrainer = report.trainers?.nama_lengkap || "Trainer";

  try {
    const dailyReports = await fetchReports({
      trainerId: report.trainer_id,
      dari: report.tanggal_kegiatan,
      sampai: report.tanggal_kegiatan,
    });

    if (dailyReports.length === 0) {
      throw new Error("Tidak ditemukan kegiatan pada tanggal tersebut.");
    }

    const dailyPhotos = await getDailyReportPhotos(dailyReports);
    const totalKegiatan = dailyReports.length;

    const nilaiHadirPertama = Number(dailyReports[0]?.jumlah_hadir || 0);
    const nilaiPesertaPertama = Number(dailyReports[0]?.jumlah_peserta || 0);

    const totalPeserta = nilaiPesertaPertama;
    const totalHadir = nilaiHadirPertama;

    const totalTambahan = dailyReports.reduce(
      (sum, item) => sum + Number(item.jumlah_tambahan || 0),
      0,
    );

    const totalJam = dailyReports.reduce(
      (sum, item) =>
        sum + hitungDurasiJam(item.jam_mulai, item.jam_selesai),
      0,
    );

    const statusHarian = dailyReports.every(
      (item) => item.status_laporan === "terverifikasi",
    )
      ? "Terverifikasi"
      : dailyReports.some((item) => item.status_laporan === "perlu_revisi")
        ? "Perlu Revisi"
        : dailyReports.some(
              (item) => item.status_laporan === "menunggu_verifikasi",
            )
          ? "Menunggu Verifikasi"
          : "Terkirim";

    const nomorDokumen = buatNomorDokumen(report, dailyReports);
    const rowSpanHadir = dailyReports.length;

    const kegiatanRows = dailyPhotos
      .map(({ report: item, photos }, index) => {
        const fotoHtml =
          photos.length === 0
            ? `<div class="no-photo">Tidak ada foto</div>`
            : `<div class="photo-strip">${photos
                .map((photo) =>
                  photo.url
                    ? `<img src="${photo.url}" class="activity-photo" alt="${escapeHtml(
                        photo.nama_file || "Dokumentasi",
                      )}" />`
                    : "",
                )
                .join("")}</div>`;

        const isFirstRow = index === 0;
        const hadirCell = isFirstRow
          ? `<td class="center participant-cell" rowspan="${rowSpanHadir}">
               <strong>${item.jumlah_peserta ?? 0}</strong>
               ${
                 item.jumlah_hadir !== null
                   ? `<div class="small-info">Hadir: ${item.jumlah_hadir}</div>`
                   : ""
               }
             </td>`
          : "";

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
              <div class="activity-title">${escapeHtml(item.materi || "—")}</div>
              ${
                item.jenis_kegiatan
                  ? `<div class="activity-type">${escapeHtml(item.jenis_kegiatan)}</div>`
                  : ""
              }
            </td>
            <td>${escapeHtml(item.kelas || "—")}</td>
            <td>${escapeHtml(item.lokasi || "—")}</td>
            ${hadirCell}
            <td class="photo-cell">${fotoHtml}</td>
            <td>${escapeHtml(item.keterangan || "Selesai")}</td>
          </tr>
        `;
      })
      .join("");

    const logoHtml = brandingLogoUrl
      ? `<img src="${brandingLogoUrl}" class="iwip-logo" alt="IWIP" />`
      : `<div class="iwip-mark">IWIP</div>`;

    const html = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Daily Training Activity Report - ${escapeHtml(namaTrainer)}</title>
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #17385f;
            background: white;
            font-size: 9px;
          }
          .page { width: 100%; }

          .company-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 8px;
            border-bottom: 3px solid #173f70;
          }
          .company-left { display: flex; align-items: center; gap: 10px; }
          .iwip-logo {
            width: 65px;
            height: 42px;
            object-fit: contain;
          }
          .iwip-mark {
            width: 55px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 900;
            color: #173f70;
            font-style: italic;
          }
          .company-name {
            font-size: 13px;
            font-weight: 800;
            color: #173f70;
          }
          .company-tagline {
            margin-top: 2px;
            font-size: 7px;
            color: #6b7280;
            letter-spacing: 0.4px;
          }
          .report-title {
            margin-top: 10px;
            margin-bottom: 9px;
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #17385f;
          }
          .title-line { height: 3px; background: #173f70; width: 100%; }

          .identity {
            display: grid;
            grid-template-columns: 1.25fr 1.05fr 1fr 1fr 1.1fr 0.9fr;
            margin-top: 10px;
            border: 1px solid #d8e1ec;
            border-radius: 8px;
            overflow: hidden;
            background: #f8fbff;
          }
          .identity-item {
            padding: 8px 10px;
            border-right: 1px solid #d8e1ec;
          }
          .identity-item:last-child { border-right: none; }
          .identity-label {
            font-size: 7px;
            color: #64748b;
            margin-bottom: 3px;
          }
          .identity-value {
            font-size: 10px;
            font-weight: 800;
            color: #17385f;
          }
          .status {
            display: inline-block;
            padding: 3px 7px;
            border-radius: 10px;
            font-size: 7px;
            font-weight: 800;
            background: #dff5e8;
            color: #168044;
          }

          .activity-wrapper { margin-top: 10px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th {
            padding: 6px 5px;
            background: #173f70;
            color: white;
            border: 1px solid #173f70;
            font-size: 8px;
            font-weight: 800;
            text-align: center;
          }
          td {
            padding: 5px;
            border: 1px solid #d7e0ea;
            vertical-align: middle;
            color: #17385f;
            font-size: 8px;
            overflow-wrap: anywhere;
          }
          tbody tr:nth-child(even) { background: #f8fbff; }
          .number-cell { font-weight: 800; }
          .center { text-align: center; }
          .time-cell { text-align: center; white-space: nowrap; }
          .time-end { display: block; font-weight: 600; color: #64748b; }
          .activity-title { font-size: 9px; font-weight: 800; color: #17385f; }
          .activity-type { margin-top: 2px; font-size: 7px; color: #64748b; }
          .small-info { margin-top: 2px; font-size: 6.5px; color: #64748b; }
          .participant-cell strong { font-size: 11px; }

          .photo-cell {
            width: 30%;
            padding: 5px;
            vertical-align: middle;
          }
          .photo-strip {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px;
          }
          .activity-photo {
            width: 100%;
            height: 105px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid #cbd5e1;
            background: #f1f5f9;
            display: block;
          }
          .photo-strip .activity-photo:only-child {
            grid-column: span 2;
            height: 140px;
          }
          .no-photo {
            color: #94a3b8;
            font-size: 7px;
            text-align: center;
            padding: 20px 2px;
          }

          .bottom-grid {
            display: grid;
            grid-template-columns: 1.2fr 1.8fr;
            gap: 8px;
            margin-top: 9px;
          }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
          .summary-card {
            border: 1px solid #d7e0ea;
            border-radius: 7px;
            padding: 8px;
            background: #f8fbff;
          }
          .summary-label { font-size: 7px; color: #64748b; }
          .summary-value {
            margin-top: 3px;
            font-size: 15px;
            font-weight: 900;
            color: #17385f;
          }
          .notes {
            border: 1px solid #d7e0ea;
            border-radius: 7px;
            padding: 8px;
          }
          .notes-title { font-size: 8px; font-weight: 800; margin-bottom: 4px; }
          .notes-text { color: #475569; font-size: 7px; line-height: 1.4; }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 9px;
            padding-top: 7px;
            border-top: 1px solid #d7e0ea;
            color: #64748b;
            font-size: 7px;
          }
          .document-number { font-weight: 800; color: #17385f; }

          @page { size: A4 landscape; margin: 8mm; }
          @media print {
            body { padding: 0; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="company-header">
            <div class="company-left">
              ${logoHtml}
              <div>
                <div class="company-name">
                  PT INDONESIA WEDA BAY INDUSTRIAL PARK (IWIP)
                </div>
                <div class="company-tagline">
                  SUSTAINABLE INDUSTRY FOR A BETTER TOMORROW
                </div>
              </div>
            </div>
          </div>

          <div class="report-title">DAILY TRAINING ACTIVITY REPORT</div>
          <div class="title-line"></div>

          <div class="identity">
            <div class="identity-item">
              <div class="identity-label">Nama Trainer</div>
              <div class="identity-value">${escapeHtml(namaTrainer)}</div>
            </div>
            <div class="identity-item">
              <div class="identity-label">No. ID Trainer</div>
              <div class="identity-value">${escapeHtml(
                report.trainers?.nomor_id_trainer || "—",
              )}</div>
            </div>
            <div class="identity-item">
              <div class="identity-label">Jabatan</div>
              <div class="identity-value">${escapeHtml(
                report.trainers?.jabatan || "—",
              )}</div>
            </div>
            <div class="identity-item">
              <div class="identity-label">Departemen</div>
              <div class="identity-value">${escapeHtml(
                report.trainers?.departemen || "—",
              )}</div>
            </div>
            <div class="identity-item">
              <div class="identity-label">Tanggal</div>
              <div class="identity-value">${escapeHtml(
                formatTanggalPanjang(report.tanggal_kegiatan),
              )}</div>
            </div>
            <div class="identity-item">
              <div class="identity-label">Status</div>
              <div class="status">✓ ${escapeHtml(statusHarian)}</div>
            </div>
          </div>

          <div class="activity-wrapper">
            <table>
              <colgroup>
                <col style="width: 3.5%" />
                <col style="width: 8%" />
                <col style="width: 20%" />
                <col style="width: 7%" />
                <col style="width: 9%" />
                <col style="width: 7%" />
                <col style="width: 30%" />
                <col style="width: 15.5%" />
              </colgroup>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Jam</th>
                  <th>Materi / Kegiatan</th>
                  <th>Kelas</th>
                  <th>Lokasi</th>
                  <th>Peserta</th>
                  <th>Dokumentasi</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                ${kegiatanRows}
              </tbody>
            </table>
          </div>

          <div class="bottom-grid">
            <div class="summary">
              <div class="summary-card">
                <div class="summary-label">Total Kegiatan</div>
                <div class="summary-value">${totalKegiatan}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Total Peserta</div>
                <div class="summary-value">${totalPeserta}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Total Hadir</div>
                <div class="summary-value">${totalHadir}</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Total Jam Training</div>
                <div class="summary-value">${formatJamTraining(totalJam)}</div>
              </div>
            </div>

            <div class="notes">
              <div class="notes-title">Catatan / Informasi Tambahan</div>
              <div class="notes-text">
                ${
                  dailyReports
                    .filter((item) => item.keterangan)
                    .map((item) => `• ${escapeHtml(item.keterangan!)}`)
                    .join("<br />") || "Tidak ada catatan tambahan."
                }
              </div>
            </div>
          </div>

          <div class="footer">
            <div>Generated from Trainer Activity Reporting System</div>
            <div class="document-number">
              No. Dokumen: ${escapeHtml(nomorDokumen)}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) {
      alert(
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
    console.error("Gagal menyiapkan Daily Training Activity Report:", error);
    alert(
      error instanceof Error
        ? error.message
        : "Gagal menyiapkan laporan harian.",
    );
  }
}

/* =========================================================
   ESCAPE HTML
========================================================= */

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
   HALAMAN LAPORAN
========================================================= */

function LaporanPage() {
  const { isStaff, isTrainer, trainer, user, loading } = useCurrentUser();
  const queryClient = useQueryClient();
  const searchParams = Route.useSearch();

  const [bulan, setBulan] = useState<string>(
    searchParams.bulan || bulanIni()
  );
  const [dari, setDari] = useState(searchParams.dari || "");
  const [sampai, setSampai] = useState(searchParams.sampai || "");
  const [trainerFilter, setTrainerFilter] = useState("semua");
  const [status, setStatus] = useState<FilterStatus>(
    (searchParams.status as FilterStatus) || "semua"
  );
  const [cari, setCari] = useState("");
  const [halaman, setHalaman] = useState(1);

  const [preview, setPreview] = useState<ReportWithTrainer | null>(null);
  const [revisiReport, setRevisiReport] = useState<ReportWithTrainer | null>(
    null,
  );
  const [kembalikanReport, setKembalikanReport] =
    useState<ReportWithTrainer | null>(null);
  const [catatanRevisi, setCatatanRevisi] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [hapusAction, setHapusAction] = useState<ReportWithTrainer | null>(null);
  const [hapusConfirmText, setHapusConfirmText] = useState("");

  const brandingLogo = useBrandingUrl("logo");

  const { data: trainers = [] } = useQuery({
    queryKey: ["trainers", "laporan-filter"],
    enabled: isStaff,
    queryFn: fetchTrainers,
  });

  const dariEfektif = dari || awalBulan(bulan);
  const sampaiEfektif = sampai || akhirBulan(bulan);

  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "reports",
      "laporan",
      trainer?.id,
      dariEfektif,
      sampaiEfektif,
      trainerFilter,
      status,
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
        dari: dariEfektif,
        sampai: sampaiEfektif,
        status: status !== "semua" ? status : null,
        cari: cari.trim() ? cari.trim() : null,
      }),
  });

  const daftarBulan = useMemo(() => listBulan(2026, 2040), []);

  // Pagination
  const totalHalaman = Math.max(1, Math.ceil(reports.length / PER_HALAMAN));
  const halamanAman = Math.min(halaman, totalHalaman);
  const laporanTampil = useMemo(
    () =>
      reports.slice(
        (halamanAman - 1) * PER_HALAMAN,
        halamanAman * PER_HALAMAN,
      ),
    [reports, halamanAman],
  );

  async function refreshReports() {
    await queryClient.invalidateQueries({ queryKey: ["reports", "laporan"] });
    await queryClient.invalidateQueries({ queryKey: ["report-photos"] });
  }

  function handleEditLaporan(report: ReportWithTrainer) {
    if (!isTrainer) return;
    if (report.status_laporan !== "perlu_revisi") return;
    window.location.href = `/buat-laporan?edit=${encodeURIComponent(report.id)}`;
  }

  async function handleVerifikasi(report: ReportWithTrainer) {
    if (!user?.id) {
      alert("User tidak ditemukan.");
      return;
    }

    const yakin = window.confirm(
      `Verifikasi laporan ${report.materi || "ini"}?`,
    );
    if (!yakin) return;

    try {
      setProcessingId(report.id);
      await verifikasiLaporan(report, user.id);
      alert("Laporan berhasil diverifikasi.");
      setPreview(null);
      await refreshReports();
    } catch (error) {
      console.error("Gagal verifikasi:", error);
      alert(
        error instanceof Error ? error.message : "Gagal memverifikasi laporan.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleMintaRevisi() {
    if (!revisiReport) return;
    if (!user?.id) {
      alert("User tidak ditemukan.");
      return;
    }
    if (!catatanRevisi.trim()) {
      alert("Catatan revisi wajib diisi.");
      return;
    }

    try {
      setProcessingId(revisiReport.id);
      await mintaRevisiLaporan(revisiReport, user.id, catatanRevisi);
      alert("Laporan dikembalikan untuk revisi.");
      setRevisiReport(null);
      setCatatanRevisi("");
      setPreview(null);
      await refreshReports();
    } catch (error) {
      console.error("Gagal meminta revisi:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengirim permintaan revisi.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleKembalikanKeRevisi() {
    if (!kembalikanReport) return;
    if (!user?.id) {
      alert("User tidak ditemukan.");
      return;
    }
    if (!catatanRevisi.trim()) {
      alert("Catatan revisi wajib diisi.");
      return;
    }

    try {
      setProcessingId(kembalikanReport.id);
      await kembalikanKeRevisiLaporan(kembalikanReport, user.id, catatanRevisi);
      alert("Laporan berhasil dikembalikan ke status revisi.");
      setKembalikanReport(null);
      setCatatanRevisi("");
      setPreview(null);
      await refreshReports();
    } catch (error) {
      console.error("Gagal mengembalikan laporan:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengembalikan laporan ke revisi.",
      );
    } finally {
      setProcessingId(null);
    }
  }

   async function handleHapus() {
    if (!hapusAction) return;
    try {
      await hapusLaporanPermanent(hapusAction.id);
      alert("Laporan berhasil dihapus permanent.");
      setHapusAction(null);
      setHapusConfirmText("");
      setPreview(null);
      await refreshReports();
    } catch (error) {
      console.error("Gagal hapus:", error);
      const msg =
        error instanceof Error ? error.message : "Gagal menghapus laporan.";
      // Tampilin error detail biar keliatan penyebabnya
      alert(`GAGAL HAPUS: ${msg}`);
    }
  }

  function resetFilter() {
    setBulan(bulanIni());
    setDari("");
    setSampai("");
    setTrainerFilter("semua");
    setStatus("semua");
    setCari("");
    setHalaman(1);
  }

  const hasFilter =
    dari ||
    sampai ||
    trainerFilter !== "semua" ||
    status !== "semua" ||
    cari ||
    bulan !== bulanIni();

  if (!loading && !isStaff && !isTrainer) {
    return (
      <AppShell title="Laporan">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki akses ke halaman laporan.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Laporan Kegiatan"
      title={isTrainer ? "Laporan Saya" : "Semua Laporan"}
    >
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        {isTrainer
          ? "Lihat, preview, edit laporan yang perlu revisi, dan download laporan kegiatan Anda."
          : "Lihat, preview, verifikasi, minta revisi, dan download laporan seluruh trainer."}
      </p>

      <Panel className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Bulan
            </p>
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

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Dari tanggal
            </p>
            <Input
              type="date"
              value={dari}
              onChange={(e) => { setDari(e.target.value); setHalaman(1); }}
              placeholder={awalBulan(bulan)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Sampai tanggal
            </p>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => { setSampai(e.target.value); setHalaman(1); }}
              placeholder={akhirBulan(bulan)}
            />
          </div>

          {!isTrainer && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Trainer
              </p>
              <Select value={trainerFilter} onValueChange={(v) => { setTrainerFilter(v); setHalaman(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Trainer</SelectItem>
                  {trainers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nama_lengkap}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Status
            </p>
            <Select
              value={status}
              onValueChange={(value) => { setStatus(value as FilterStatus); setHalaman(1); }}
            >
              <SelectTrigger>
                <SelectValue />
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

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Cari
            </p>
            <Input
              value={cari}
              onChange={(e) => { setCari(e.target.value); setHalaman(1); }}
              placeholder="Materi, kegiatan, kelas..."
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Menampilkan periode:{" "}
          <strong>{formatTanggal(dariEfektif)}</strong> s/d{" "}
          <strong>{formatTanggal(sampaiEfektif)}</strong>
          {!dari && !sampai ? (
            <span> (bulan {labelBulan(bulan)})</span>
          ) : null}
        </p>
      </Panel>

      <Panel className="p-0 sm:p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Daftar Laporan</p>
            <p className="text-xs text-muted-foreground">
              {reports.length} laporan ditemukan
            </p>
          </div>

          {hasFilter && (
            <Button size="sm" variant="outline" onClick={resetFilter}>
              Reset Filter
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Memuat laporan…</p>
        ) : isError ? (
          <p className="p-5 text-sm text-destructive">
            Gagal mengambil data laporan.
          </p>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium">Belum ada laporan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tidak ada laporan pada periode {labelBulan(bulan)}.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      No
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Tanggal
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Jam
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Trainer
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Materi
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Kelas
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
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
                  {laporanTampil.map((r, index) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="num px-4 py-3 text-muted-foreground">
                        {(halamanAman - 1) * PER_HALAMAN + index + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatTanggal(r.tanggal_kegiatan)}
                      </td>
                      <td className="num whitespace-nowrap px-4 py-3">
                        {r.jam_mulai || "—"}
                        {r.jam_selesai ? ` - ${r.jam_selesai}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.trainers?.nama_lengkap || "—"}
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="font-medium">{r.materi || "—"}</p>
                        {r.jenis_kegiatan && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.jenis_kegiatan}
                          </p>
                        )}
                        {r.status_laporan === "perlu_revisi" &&
                          r.catatan_revisi && (
                            <p className="mt-1 line-clamp-2 text-xs text-destructive">
                              Revisi: {r.catatan_revisi}
                            </p>
                          )}
                      </td>
                      <td className="px-4 py-3">{r.kelas || "—"}</td>
                      <td className="num px-4 py-3">{r.jumlah_peserta ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status_laporan} />
                      </td>
                                            <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            title="Preview laporan harian"
                            onClick={() => setPreview(r)}
                          >
                            <Eye className="size-4" />
                          </Button>

                          {isStaff &&
                            r.status_laporan === "menunggu_verifikasi" && (
                              <>
                                <Button
                                  size="icon"
                                  title="Verifikasi laporan"
                                  disabled={processingId === r.id}
                                  onClick={() => handleVerifikasi(r)}
                                >
                                  <Check className="size-4" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="outline"
                                  title="Minta revisi"
                                  disabled={processingId === r.id}
                                  onClick={() => {
                                    setRevisiReport(r);
                                    setCatatanRevisi("");
                                  }}
                                >
                                  <RotateCcw className="size-4" />
                                </Button>
                              </>
                            )}

                          {isStaff && r.status_laporan === "terverifikasi" && (
                            <Button
                              size="icon"
                              variant="outline"
                              title="Kembalikan ke revisi"
                              disabled={processingId === r.id}
                              onClick={() => {
                                setKembalikanReport(r);
                                setCatatanRevisi("");
                              }}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          )}

                          {isTrainer &&
                            r.status_laporan === "perlu_revisi" && (
                              <Button
                                size="icon"
                                variant="outline"
                                title="Edit dan kirim ulang laporan"
                                onClick={() => handleEditLaporan(r)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}

                          {(isStaff ||
                            (isTrainer &&
                              (r.status_laporan === "menunggu_verifikasi" ||
                                r.status_laporan === "perlu_revisi"))) && (
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
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {laporanTampil.map((r, index) => (
                <div key={r.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        No. {(halamanAman - 1) * PER_HALAMAN + index + 1}
                      </p>
                      <p className="mt-1 font-semibold">
                        {r.materi || "Tanpa materi"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.trainers?.nama_lengkap || "—"}
                      </p>
                    </div>
                    <StatusPill status={r.status_laporan} />
                  </div>

                  {r.status_laporan === "perlu_revisi" && r.catatan_revisi && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-xs font-medium text-destructive">
                        Catatan Revisi
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs">
                        {r.catatan_revisi}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Tanggal</p>
                      <p>{formatTanggal(r.tanggal_kegiatan)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Jam</p>
                      <p>
                        {r.jam_mulai || "—"}
                        {r.jam_selesai ? ` - ${r.jam_selesai}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kelas</p>
                      <p>{r.kelas || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Peserta</p>
                      <p>{r.jumlah_peserta ?? "—"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreview(r)}
                    >
                      <Eye className="mr-2 size-4" />
                      Preview
                    </Button>

                    {isStaff &&
                      r.status_laporan === "menunggu_verifikasi" && (
                        <>
                          <Button
                            size="sm"
                            disabled={processingId === r.id}
                            onClick={() => handleVerifikasi(r)}
                          >
                            <Check className="mr-2 size-4" />
                            Verifikasi
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === r.id}
                            onClick={() => {
                              setRevisiReport(r);
                              setCatatanRevisi("");
                            }}
                          >
                            <RotateCcw className="mr-2 size-4" />
                            Minta Revisi
                          </Button>
                        </>
                      )}

                    {isStaff && r.status_laporan === "terverifikasi" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === r.id}
                        onClick={() => {
                          setKembalikanReport(r);
                          setCatatanRevisi("");
                        }}
                      >
                        <RotateCcw className="mr-2 size-4" />
                        Kembalikan ke Revisi
                      </Button>
                    )}

                                        {isTrainer && r.status_laporan === "perlu_revisi" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditLaporan(r)}
                      >
                        <Pencil className="mr-2 size-4" />
                        Edit & Kirim Ulang
                      </Button>
                    )}

                    {(isStaff ||
                      (isTrainer &&
                        (r.status_laporan === "menunggu_verifikasi" ||
                          r.status_laporan === "perlu_revisi"))) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setHapusAction(r);
                          setHapusConfirmText("");
                        }}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Hapus
                      </Button>
                    )}
                  </div>
                </div>
              ))}
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

      {preview && (
        <PreviewLaporan
          report={preview}
          isStaff={isStaff}
          isTrainer={isTrainer}
          processingId={processingId}
          brandingLogoUrl={brandingLogo}
          onClose={() => setPreview(null)}
          onVerifikasi={() => handleVerifikasi(preview)}
          onMintaRevisi={() => {
            setRevisiReport(preview);
            setCatatanRevisi("");
          }}
          onKembalikanKeRevisi={() => {
            setKembalikanReport(preview);
            setCatatanRevisi("");
          }}
          onEdit={() => handleEditLaporan(preview)}
        />
      )}

      {revisiReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="font-semibold">Minta Revisi Laporan</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tuliskan bagian yang perlu diperbaiki oleh trainer.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setRevisiReport(null);
                  setCatatanRevisi("");
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Trainer</p>
                <p className="font-medium">
                  {revisiReport.trainers?.nama_lengkap || "—"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Materi</p>
                <p className="font-medium">{revisiReport.materi || "—"}</p>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">Catatan Revisi</p>
                <textarea
                  value={catatanRevisi}
                  onChange={(e) => setCatatanRevisi(e.target.value)}
                  placeholder="Contoh: Mohon perbaiki jumlah peserta hadir dan lengkapi foto dokumentasi."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Catatan ini akan tersimpan pada laporan dan dapat dilihat
                  trainer.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t bg-muted/20 px-5 py-4">
              <Button
                variant="outline"
                disabled={processingId === revisiReport.id}
                onClick={() => {
                  setRevisiReport(null);
                  setCatatanRevisi("");
                }}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={processingId === revisiReport.id || !catatanRevisi.trim()}
                onClick={handleMintaRevisi}
              >
                <RotateCcw className="mr-2 size-4" />
                {processingId === revisiReport.id ? "Menyimpan..." : "Kirim Revisi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {kembalikanReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="font-semibold">Kembalikan ke Revisi</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gunakan jika laporan terlanjur diverifikasi dan ternyata masih
                  perlu diperbaiki.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setKembalikanReport(null);
                  setCatatanRevisi("");
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">Perhatian</p>
                <p className="mt-1 text-xs text-amber-700">
                  Status laporan akan berubah dari Terverifikasi menjadi Perlu
                  Revisi. Trainer dapat melihat catatan ini dan mengirim ulang
                  laporan.
                </p>
              </div>

              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Trainer</p>
                <p className="font-medium">
                  {kembalikanReport.trainers?.nama_lengkap || "—"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Materi</p>
                <p className="font-medium">{kembalikanReport.materi || "—"}</p>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">Catatan Revisi *</p>
                <textarea
                  value={catatanRevisi}
                  onChange={(e) => setCatatanRevisi(e.target.value)}
                  placeholder="Contoh: Laporan sudah terverifikasi secara tidak sengaja. Mohon lengkapi dokumentasi dan koreksi jumlah peserta."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Catatan wajib diisi dan akan tersimpan sebagai riwayat
                  verifikasi.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t bg-muted/20 px-5 py-4">
              <Button
                variant="outline"
                disabled={processingId === kembalikanReport.id}
                onClick={() => {
                  setKembalikanReport(null);
                  setCatatanRevisi("");
                }}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={
                  processingId === kembalikanReport.id || !catatanRevisi.trim()
                }
                onClick={handleKembalikanKeRevisi}
              >
                <RotateCcw className="mr-2 size-4" />
                {processingId === kembalikanReport.id
                  ? "Menyimpan..."
                  : "Kembalikan ke Revisi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {hapusAction && (
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
                disabled={hapusConfirmText !== "HAPUS"}
                onClick={handleHapus}
              >
                <Trash2 className="mr-2 size-4" />
                Hapus Permanent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}

/* =========================================================
   PREVIEW
========================================================= */

function PreviewLaporan({
  report,
  isStaff,
  isTrainer,
  processingId,
  brandingLogoUrl,
  onClose,
  onVerifikasi,
  onMintaRevisi,
  onKembalikanKeRevisi,
  onEdit,
}: {
  report: ReportWithTrainer;
  isStaff: boolean;
  isTrainer: boolean;
  processingId: string | null;
  brandingLogoUrl?: string | null;
  onClose: () => void;
  onVerifikasi: () => void;
  onMintaRevisi: () => void;
  onKembalikanKeRevisi: () => void;
  onEdit: () => void;
}) {
  const {
    data: photos = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["report-photos", report.id],
    queryFn: () => getReportPhotos(report.id),
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-8 max-w-4xl rounded-xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-lg font-semibold">Preview Laporan Harian</p>
            <p className="text-xs text-muted-foreground">
              Download akan menggabungkan seluruh kegiatan trainer pada tanggal
              yang sama.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info
              label="Tanggal Kegiatan"
              value={formatTanggalPanjang(report.tanggal_kegiatan)}
            />
            <Info
              label="Trainer"
              value={report.trainers?.nama_lengkap || "—"}
            />
            <Info
              label="Nomor ID Trainer"
              value={report.trainers?.nomor_id_trainer || "—"}
            />
            <Info label="Jabatan" value={report.trainers?.jabatan || "—"} />
            <Info label="Departemen" value={report.trainers?.departemen || "—"} />
            <Info label="Status" value={report.status_laporan} />
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Materi / Kegiatan Terpilih
            </p>
            <p className="mt-1 whitespace-pre-wrap text-base font-semibold">
              {report.materi || "—"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              PDF akan memuat seluruh kegiatan pada tanggal{" "}
              <strong>{formatTanggal(report.tanggal_kegiatan)}</strong>.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Peserta" value={report.jumlah_peserta} />
            <Stat label="Hadir" value={report.jumlah_hadir} />
            <Stat label="Tidak Hadir" value={report.jumlah_tidak_hadir} />
            <Stat label="Tambahan" value={report.jumlah_tambahan} />
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Status Laporan
            </p>
            <div className="mt-2">
              <StatusPill status={report.status_laporan} />
            </div>
            {report.catatan_revisi && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive">
                  Catatan Revisi
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {report.catatan_revisi}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <div className="mb-4 flex items-center gap-2">
              <ImageIcon className="size-5 text-primary" />
              <div>
                <p className="font-semibold">Dokumentasi Foto</p>
                <p className="text-xs text-muted-foreground">
                  Foto tersimpan pada kegiatan yang sedang dipreview.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Memuat foto dokumentasi…
                </p>
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-8 text-center">
                <p className="text-sm font-medium text-destructive">
                  Foto tidak dapat dimuat.
                </p>
              </div>
            ) : photos.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <ImageIcon className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  Belum ada foto dokumentasi.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {photos.map((photo, index) => (
                  <div
                    key={`${photo.storage_path}-${index}`}
                    className="overflow-hidden rounded-xl border bg-muted/10"
                  >
                    <div className="border-b bg-muted/20 px-4 py-2">
                      <p className="text-xs font-medium">
                        Dokumentasi {index + 1}
                      </p>
                    </div>
                    {photo.url ? (
                      <div className="flex justify-center bg-background p-3">
                        <img
                          src={photo.url}
                          alt={photo.nama_file || `Dokumentasi ${index + 1}`}
                          className="block h-auto max-h-[400px] w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-sm text-destructive">
                          Foto gagal dimuat.
                        </p>
                      </div>
                    )}
                    {photo.nama_file && (
                      <div className="border-t px-4 py-2">
                        <p className="break-all text-xs text-muted-foreground">
                          {photo.nama_file}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isStaff && report.status_laporan === "menunggu_verifikasi" && (
              <p className="text-xs text-muted-foreground">
                Pastikan data dan dokumentasi sudah sesuai sebelum menentukan
                hasil verifikasi.
              </p>
            )}
            {isStaff && report.status_laporan === "terverifikasi" && (
              <p className="text-xs text-amber-600">
                Jika verifikasi dilakukan secara tidak sengaja, laporan dapat
                dikembalikan ke revisi.
              </p>
            )}
            {isTrainer && report.status_laporan === "perlu_revisi" && (
              <p className="text-xs text-destructive">
                Laporan ini perlu diperbaiki berdasarkan catatan revisi.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>

            {isTrainer && report.status_laporan === "perlu_revisi" && (
              <Button variant="outline" onClick={onEdit}>
                <Pencil className="mr-2 size-4" />
                Edit & Kirim Ulang
              </Button>
            )}

            {isStaff && report.status_laporan === "menunggu_verifikasi" && (
              <>
                <Button
                  variant="outline"
                  disabled={processingId === report.id}
                  onClick={onMintaRevisi}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Minta Revisi
                </Button>
                <Button
                  disabled={processingId === report.id}
                  onClick={onVerifikasi}
                >
                  <Check className="mr-2 size-4" />
                  Verifikasi
                </Button>
              </>
            )}

            {isStaff && report.status_laporan === "terverifikasi" && (
              <Button
                variant="outline"
                disabled={processingId === report.id}
                onClick={onKembalikanKeRevisi}
              >
                <RotateCcw className="mr-2 size-4" />
                Kembalikan ke Revisi
              </Button>
            )}

            <Button
              onClick={() => downloadLaporan(report, brandingLogoUrl)}
            >
              <Download className="mr-2 size-4" />
              Download PDF Harian
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INFO & STAT
========================================================= */

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value ?? "—"}</p>
    </div>
  );
}
