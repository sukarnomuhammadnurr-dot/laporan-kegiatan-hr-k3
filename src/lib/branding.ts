import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "branding";

export type BrandingKey =
  | "logo"
  | "hero_dashboard"
  | "hero_laporan"
  | "background"
  | "sidebar_background"
  | "ilustrasi_k3"
  | "login";

export const BRANDING_ITEMS: {
  key: BrandingKey;
  label: string;
  hint: string;
}[] = [
  {
    key: "logo",
    label: "Logo Perusahaan",
    hint: "Tampil di sidebar, header, dan halaman login.",
  },
  {
    key: "hero_dashboard",
    label: "Foto Hero Dashboard",
    hint: "Banner di halaman Dashboard.",
  },
  {
    key: "hero_laporan",
    label: "Foto Hero Laporan",
    hint: "Banner di halaman laporan.",
  },
  {
    key: "sidebar_background",
    label: "Background Sidebar",
    hint: "Gambar di bagian bawah sidebar (opsional, kalau kosong pakai gradient).",
  },
  {
    key: "background",
    label: "Background Sistem",
    hint: "Latar belakang tipis di seluruh aplikasi.",
  },
  {
    key: "ilustrasi_k3",
    label: "Foto/Ilustrasi K3",
    hint: "Banner halaman lain (master, pengaturan, dll).",
  },
  {
    key: "login",
    label: "Foto Login",
    hint: "Gambar samping pada halaman login.",
  },
];

export type Branding = Partial<Record<BrandingKey, string>>;

export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Branding> => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "branding")
        .maybeSingle();
      return (data?.value as Branding) ?? {};
    },
  });
}

export function useSaveBranding() {
  const qc = useQueryClient();
  return async (next: Branding) => {
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "branding", value: next });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["branding"] });
  };
}

/** Mengubah path storage menjadi URL bertanda tangan (bucket privat). */
export function useStorageUrl(path: string | null | undefined) {
  return (
    useQuery({
      queryKey: ["storage-url", path],
      enabled: !!path,
      staleTime: 50 * 60_000,
      queryFn: async () => {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path!, 60 * 60 * 24);
        return data?.signedUrl ?? null;
      },
    }).data ?? null
  );
}

export function useBrandingUrl(key: BrandingKey) {
  const { data } = useBranding();
  return useStorageUrl(data?.[key]);
}

export const TIPE_GAMBAR = ["image/jpeg", "image/png", "image/webp"];

/** Unggah file baru (nama unik, file lama tidak ditimpa). */
export async function uploadGambar(
  file: File,
  folder: "branding" | "trainer",
) {
  if (!TIPE_GAMBAR.includes(file.type))
    throw new Error("Format harus JPG, JPEG, PNG, atau WEBP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran maksimal 5 MB.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",   // ← INI WAJIB (string, bukan number)
    });

  if (error) {
    // Tampilkan error detail biar keliatan
    console.error("Upload error:", error);
    throw new Error(`Gagal mengunggah gambar: ${error.message}`);
  }

  return path;
}

export function inisialNama(nama: string | null | undefined) {
  return (
    (nama ?? "")
      .split(/\s+/)
      .filter((w) => /[a-z]/i.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "??"
  );
}
