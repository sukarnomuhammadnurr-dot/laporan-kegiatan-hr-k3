import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type ReportWithTrainer = ReportRow & {
  trainers: { id: string; nama_lengkap: string; nomor_id_trainer: string; jabatan: string; departemen: string } | null;
};

export const REPORT_SELECT =
  "*, trainers ( id, nama_lengkap, nomor_id_trainer, jabatan, departemen )";

export type ReportFilters = {
  trainerId?: string | null;
  dari?: string | null;
  sampai?: string | null;
  status?: string | null;
  materi?: string | null;
  kelas?: string | null;
  cari?: string | null;
};

export async function fetchReports(filters: ReportFilters = {}) {
  let q = supabase
    .from("reports")
    .select(REPORT_SELECT)
    .order("tanggal_kegiatan", { ascending: false })
    .order("jam_mulai", { ascending: true, nullsFirst: false });

  if (filters.trainerId) q = q.eq("trainer_id", filters.trainerId);
  if (filters.dari) q = q.gte("tanggal_kegiatan", filters.dari);
  if (filters.sampai) q = q.lte("tanggal_kegiatan", filters.sampai);
  if (filters.status) q = q.eq("status_laporan", filters.status as ReportRow["status_laporan"]);
  if (filters.materi) q = q.ilike("materi", `%${filters.materi}%`);
  if (filters.kelas) q = q.ilike("kelas", `%${filters.kelas}%`);
  if (filters.cari) {
    const s = filters.cari.replace(/,/g, " ");
    q = q.or(
      `materi.ilike.%${s}%,jenis_kegiatan.ilike.%${s}%,kelas.ilike.%${s}%,keterangan.ilike.%${s}%`,
    );
  }

  const { data, error } = await q.limit(1000);
  if (error) throw error;
  return (data ?? []) as ReportWithTrainer[];
}

export async function fetchTrainers() {
  const { data, error } = await supabase
    .from("trainers")
    .select("*")
    .order("nama_lengkap", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMaterials() {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .order("nama", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActivityTypes() {
  const { data, error } = await supabase
    .from("activity_types")
    .select("*")
    .order("nama", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTrainingDays() {
  const { data, error } = await supabase
    .from("training_days")
    .select("*")
    .order("urutan", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSchedules() {
  const { data, error } = await supabase
    .from("schedules")
    .select("*, training_days ( id, nama, urutan )")
    .order("urutan", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type ScheduleRow = Awaited<ReturnType<typeof fetchSchedules>>[number];

/** Jadwal yang jamnya bertabrakan pada hari training yang sama. */
export function jadwalOverlap(rows: ScheduleRow[]) {
  const konflik = new Set<string>();
  const perHari = new Map<string, ScheduleRow[]>();
  for (const r of rows) {
    if (!r.aktif || !r.jam_mulai || !r.jam_selesai) continue;
    const key = r.training_day_id ?? "tanpa-hari";
    perHari.set(key, [...(perHari.get(key) ?? []), r]);
  }
  for (const list of perHari.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.kelas && b.kelas && a.kelas !== b.kelas) continue;
        if (a.jam_mulai! < b.jam_selesai! && b.jam_mulai! < a.jam_selesai!) {
          konflik.add(a.id);
          konflik.add(b.id);
        }
      }
    }
  }
  return konflik;
}
