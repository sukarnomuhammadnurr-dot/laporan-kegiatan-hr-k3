import { supabase } from "@/integrations/supabase/client";

export type ReportPhoto = {
  id?: string;
  storage_path: string;
  nama_file: string | null;
  url: string | null;
};

const BUCKET = "report-photos";

/**
 * Ambil semua foto dokumentasi untuk 1 laporan.
 * URL di-generate pakai signed URL (1 jam).
 */
export async function getReportPhotos(
  reportId: string,
): Promise<ReportPhoto[]> {
  const { data, error } = await supabase
    .from("report_photos")
    .select("id, storage_path, nama_file")
    .eq("report_id", reportId)
    .order("uploaded_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    storage_path: string;
    nama_file: string | null;
  }>;

  // Sequential biar gak rate limit
  const results: ReportPhoto[] = [];
  for (const photo of rows) {
    try {
      const { data: signed, error: signedError } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(photo.storage_path, 60 * 60);

      results.push({
        id: photo.id,
        storage_path: photo.storage_path,
        nama_file: photo.nama_file,
        url:
          signedError || !signed?.signedUrl
            ? null
            : signed.signedUrl,
      });
    } catch (err) {
      console.warn("Gagal sign URL:", photo.storage_path, err);
      results.push({
        id: photo.id,
        storage_path: photo.storage_path,
        nama_file: photo.nama_file,
        url: null,
      });
    }
  }

  return results;
}

/**
 * Ambil foto untuk banyak report sekaligus.
 * Return: Map<reportId, ReportPhoto[]>
 *
 * Strategi: chunk 10 per batch — sequential dalam batch,
 * delay antar batch biar gak rate limit.
 */
export async function getReportPhotosBatch(
  reportIds: string[],
): Promise<Map<string, ReportPhoto[]>> {
  const result = new Map<string, ReportPhoto[]>();
  if (reportIds.length === 0) return result;

  const { data, error } = await supabase
    .from("report_photos")
    .select("id, report_id, storage_path, nama_file")
    .in("report_id", reportIds)
    .order("uploaded_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    report_id: string;
    storage_path: string;
    nama_file: string | null;
  }>;

  // Process sequential (biar aman & stabil)
  for (const photo of rows) {
    try {
      const { data: signed, error: signedError } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(photo.storage_path, 60 * 60);

      const list = result.get(photo.report_id) ?? [];
      list.push({
        id: photo.id,
        storage_path: photo.storage_path,
        nama_file: photo.nama_file,
        url:
          signedError || !signed?.signedUrl
            ? null
            : signed.signedUrl,
      });
      result.set(photo.report_id, list);
    } catch (err) {
      console.warn("Gagal sign URL batch:", photo.storage_path, err);
      const list = result.get(photo.report_id) ?? [];
      list.push({
        id: photo.id,
        storage_path: photo.storage_path,
        nama_file: photo.nama_file,
        url: null,
      });
      result.set(photo.report_id, list);
    }
  }

  return result;
}

/**
 * Re-sign URL untuk foto (buat retry kalau URL expired).
 */
export async function resignPhotoUrl(
  storagePath: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
