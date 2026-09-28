import type { Database } from "@/integrations/supabase/types";

export type ReportStatus = Database["public"]["Enums"]["report_status"];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  menunggu_konfirmasi: "Menunggu Konfirmasi",
  terkirim: "Terkirim",
  menunggu_verifikasi: "Menunggu Verifikasi",
  terverifikasi: "Terverifikasi",
  perlu_revisi: "Perlu Revisi",
};

export const STATUS_ORDER: ReportStatus[] = [
  "draft",
  "menunggu_konfirmasi",
  "terkirim",
  "menunggu_verifikasi",
  "terverifikasi",
  "perlu_revisi",
];

/** Kelas warna status — hanya memakai token desain. */
export const STATUS_CLASS: Record<ReportStatus, string> = {
  draft: "bg-status-none/10 text-status-none ring-status-none/25",
  menunggu_konfirmasi: "bg-status-waiting/10 text-status-waiting ring-status-waiting/25",
  terkirim: "bg-status-sent/10 text-status-sent ring-status-sent/25",
  menunggu_verifikasi: "bg-status-review/10 text-status-review ring-status-review/25",
  terverifikasi: "bg-status-verified/10 text-status-verified ring-status-verified/25",
  perlu_revisi: "bg-status-revision/10 text-status-revision ring-status-revision/25",
};

export const STATUS_DOT: Record<ReportStatus, string> = {
  draft: "bg-status-none",
  menunggu_konfirmasi: "bg-status-waiting",
  terkirim: "bg-status-sent",
  menunggu_verifikasi: "bg-status-review",
  terverifikasi: "bg-status-verified",
  perlu_revisi: "bg-status-revision",
};

export const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatTanggal(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTanggalPendek(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")} ${BULAN[d.getMonth()]!.slice(0, 3)}`;
}

export function formatJam(t: string | null | undefined) {
  if (!t) return "-";
  return t.slice(0, 5).replace(":", ".");
}

export function rentangJam(mulai?: string | null, selesai?: string | null) {
  if (!mulai && !selesai) return "-";
  return `${formatJam(mulai)} - ${formatJam(selesai)}`;
}

/** "-" ditampilkan untuk tambahan bernilai 0, sesuai format laporan. */
export function tampilTambahan(n: number | null | undefined) {
  return !n ? "-" : String(n);
}

export function periodeLabel(bulan: number, tahun: number) {
  return `${BULAN[bulan - 1]} ${tahun}`;
}

export function rentangBulan(bulan: number, tahun: number) {
  const awal = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const akhirDate = new Date(tahun, bulan, 0);
  const akhir = `${tahun}-${String(bulan).padStart(2, "0")}-${String(akhirDate.getDate()).padStart(2, "0")}`;
  return { awal, akhir };
}

export function hariIniISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
