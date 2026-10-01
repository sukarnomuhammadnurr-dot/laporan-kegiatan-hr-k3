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

  return Promise.all(
    rows.map(async (photo) => {
      const { data: signed, error: signedError } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(photo.storage_path, 60 * 60);

      return {
        id: photo.id,
        storage_path: photo.storage_path,
        nama_file: photo.nama_file,
        url:
          signedError || !signed?.signedUrl
            ? null
            : signed.signedUrl,
      };
    }),
  );
}

/**
 * Ambil foto untuk banyak report sekaligus.
 * Return: Map<reportId, ReportPhoto[]>
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

  const withUrls = await Promise.all(
    rows.map(async (photo) => {
      const { data: signed, error: signedError } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(photo.storage_path, 60 * 60);

      return {
        report_id: photo.report_id,
        photo: {
          id: photo.id,
          storage_path: photo.storage_path,
          nama_file: photo.nama_file,
          url:
            signedError || !signed?.signedUrl
              ? null
              : signed.signedUrl,
        } satisfies ReportPhoto,
      };
    }),
  );

  for (const { report_id, photo } of withUrls) {
    const list = result.get(report_id) ?? [];
    list.push(photo);
    result.set(report_id, list);
  }

  return result;
}
