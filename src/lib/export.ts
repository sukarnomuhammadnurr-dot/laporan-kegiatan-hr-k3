import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, formatTanggal, rentangJam, tampilTambahan } from "@/lib/status";
import type { ReportWithTrainer } from "@/lib/queries";

export type IdentitasTrainer = {
  nama: string;
  nomorId: string;
  jabatan: string;
  departemen: string;
};

const JUDUL = "LAPORAN KEGIATAN K3";
const SUBJUDUL = "TRAINER DEVELOPMENT";

const KOLOM = [
  "No",
  "Tanggal",
  "Jam",
  "Jenis Kegiatan",
  "Materi",
  "Kelas",
  "Penanggung Jawab",
  "Jumlah Peserta",
  "Hadir",
  "Tidak Hadir",
  "Tambahan",
  "Dokumentasi",
  "Status",
];

export type FotoIndex = Record<string, string[]>; // report_id -> storage paths

export async function ambilFotoIndex(reportIds: string[]): Promise<FotoIndex> {
  if (reportIds.length === 0) return {};
  const { data } = await supabase
    .from("report_photos")
    .select("report_id, storage_path")
    .in("report_id", reportIds);
  const index: FotoIndex = {};
  for (const row of data ?? []) {
    index[row.report_id] = [...(index[row.report_id] ?? []), row.storage_path];
  }
  return index;
}

function barisLaporan(reports: ReportWithTrainer[], foto: FotoIndex) {
  return reports.map((r, i) => [
    i + 1,
    formatTanggal(r.tanggal_kegiatan),
    rentangJam(r.jam_mulai, r.jam_selesai),
    r.jenis_kegiatan ?? "-",
    r.materi,
    r.kelas ?? "-",
    r.penanggung_jawab ?? "-",
    r.jumlah_peserta,
    r.jumlah_hadir,
    r.jumlah_tidak_hadir,
    tampilTambahan(r.jumlah_tambahan),
    (foto[r.id]?.length ?? 0) > 0 ? `${foto[r.id]!.length} foto` : "-",
    STATUS_LABEL[r.status_laporan],
  ]);
}

function sheetUntuk(
  reports: ReportWithTrainer[],
  identitas: IdentitasTrainer,
  periode: string,
  foto: FotoIndex,
) {
  const aoa: (string | number)[][] = [
    [JUDUL],
    [SUBJUDUL],
    [],
    ["Nama Trainer", identitas.nama],
    ["ID Trainer", identitas.nomorId],
    ["Jabatan", identitas.jabatan],
    ["Departemen", identitas.departemen],
    ["Periode", periode],
    [],
    KOLOM,
    ...barisLaporan(reports, foto),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 4 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
    { wch: 34 },
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
  ];
  return ws;
}

export async function exportExcelSatuTrainer(
  reports: ReportWithTrainer[],
  identitas: IdentitasTrainer,
  periode: string,
  namaFile: string,
) {
  const foto = await ambilFotoIndex(reports.map((r) => r.id));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetUntuk(reports, identitas, periode, foto), "Laporan");
  XLSX.writeFile(wb, namaFile);
}

export async function exportExcelSemuaTrainer(
  reports: ReportWithTrainer[],
  periode: string,
  namaFile: string,
) {
  const foto = await ambilFotoIndex(reports.map((r) => r.id));
  const wb = XLSX.utils.book_new();
  const perTrainer = new Map<string, ReportWithTrainer[]>();
  for (const r of reports) {
    const key = r.trainers?.nama_lengkap ?? "Tanpa Trainer";
    perTrainer.set(key, [...(perTrainer.get(key) ?? []), r]);
  }
  if (perTrainer.size === 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([[JUDUL], [SUBJUDUL], [], ["Tidak ada laporan pada periode ini."]]),
      "Kosong",
    );
  }
  for (const [nama, list] of perTrainer) {
    const t = list[0]?.trainers;
    const ws = sheetUntuk(
      list,
      {
        nama,
        nomorId: t?.nomor_id_trainer ?? "-",
        jabatan: t?.jabatan ?? "-",
        departemen: t?.departemen ?? "-",
      },
      periode,
      foto,
    );
    XLSX.utils.book_append_sheet(wb, ws, nama.slice(0, 28).replace(/[[\]:*?/\\]/g, " "));
  }
  XLSX.writeFile(wb, namaFile);
}

async function dataUrlFoto(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("report-photos").createSignedUrl(path, 300);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportPdf(
  reports: ReportWithTrainer[],
  identitas: IdentitasTrainer | null,
  periode: string,
  namaFile: string,
) {
  const foto = await ambilFotoIndex(reports.map((r) => r.id));
  const thumbs = new Map<string, string>();
  await Promise.all(
    reports.map(async (r) => {
      const first = foto[r.id]?.[0];
      if (!first) return;
      const url = await dataUrlFoto(first);
      if (url) thumbs.set(r.id, url);
    }),
  );

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(JUDUL, 14, 14);
  doc.setFontSize(11);
  doc.text(SUBJUDUL, 14, 20);
  doc.setFontSize(9);

  let y = 28;
  const identitasBaris = identitas
    ? [
        `Nama Trainer : ${identitas.nama}`,
        `ID Trainer : ${identitas.nomorId}`,
        `Jabatan : ${identitas.jabatan}`,
        `Departemen : ${identitas.departemen}`,
        `Periode : ${periode}`,
      ]
    : [`Cakupan : Semua Trainer`, `Periode : ${periode}`];
  for (const baris of identitasBaris) {
    doc.text(baris, 14, y);
    y += 5;
  }

  const kolom = identitas ? KOLOM : ["Trainer", ...KOLOM];
  const baris = barisLaporan(reports, foto).map((row, i) =>
    identitas ? row : [reports[i]?.trainers?.nama_lengkap ?? "-", ...row],
  );
  const kolomDokumentasi = kolom.indexOf("Dokumentasi");

  autoTable(doc, {
    head: [kolom],
    body: baris,
    startY: y + 2,
    styles: { fontSize: 7, cellPadding: 1.5, valign: "middle" },
    headStyles: { fillColor: [27, 36, 48], textColor: 255 },
    columnStyles: { [kolomDokumentasi]: { cellWidth: 20, minCellHeight: 16 } },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== kolomDokumentasi) return;
      const report = reports[data.row.index];
      const img = report ? thumbs.get(report.id) : undefined;
      if (!img) return;
      try {
        doc.addImage(img, "JPEG", data.cell.x + 1, data.cell.y + 1, 18, 13);
      } catch {
        /* lewati foto yang tidak dapat dibaca */
      }
    },
    willDrawCell: (data) => {
      if (data.section === "body" && data.column.index === kolomDokumentasi) {
        const report = reports[data.row.index];
        if (report && thumbs.has(report.id)) data.cell.text = [];
      }
    },
  });

  doc.save(namaFile);
}
