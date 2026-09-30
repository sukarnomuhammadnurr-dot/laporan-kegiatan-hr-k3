import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell, Panel } from "@/components/AppShell";
import { ImageUploadField } from "@/components/ImageUploadField";
import { useCurrentUser } from "@/hooks/useAuth";
import { BRANDING_ITEMS, uploadGambar, useBranding, useSaveBranding, type BrandingKey } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/pengaturan-sistem")({
  head: () => ({
    meta: [
      { title: "Pengaturan Sistem · Laporan Kegiatan Trainer K3" },
      { name: "description", content: "Atur branding dan tampilan sistem laporan kegiatan Trainer K3 PT IWIP." },
      { property: "og:title", content: "Pengaturan Sistem · Laporan Kegiatan Trainer K3" },
      { property: "og:description", content: "Branding & tampilan: logo, foto hero, background, dan foto login." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pengaturan,
});

function Pengaturan() {
  const { isAdmin } = useCurrentUser();
  const { data: branding = {}, isLoading } = useBranding();
  const simpan = useSaveBranding();

  if (!isAdmin) {
    return (
      <AppShell eyebrow="Data & Sistem" title="Pengaturan Sistem">
        <Panel>
          <p className="text-sm text-muted-foreground">Halaman ini hanya untuk Admin.</p>
        </Panel>
      </AppShell>
    );
  }

  async function ganti(key: BrandingKey, file: File) {
    const path = await uploadGambar(file, "branding");
    await simpan({ ...branding, [key]: path });
    toast.success("Gambar berhasil disimpan.");
  }

  async function hapus(key: BrandingKey) {
    const next = { ...branding };
    delete next[key];
    await simpan(next);
    toast.success("Gambar dihapus. Tampilan kembali ke default.");
  }

  return (
    <AppShell
      eyebrow="Data & Sistem"
      title="Pengaturan Sistem"
      description="Kelola branding dan gambar yang tampil di seluruh aplikasi."
      heroKey="ilustrasi_k3"
    >
      <Panel>
        <h2 className="text-base font-semibold">Branding & Tampilan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Format JPG, JPEG, PNG, atau WEBP (maks. 5 MB). Perubahan langsung dipakai halaman terkait.
        </p>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {BRANDING_ITEMS.map((it) => (
              <ImageUploadField
                key={it.key}
                label={it.label}
                hint={it.hint}
                path={branding[it.key]}
                aspect={it.key === "logo" ? "aspect-[3/2]" : "aspect-video"}
                onSave={(f) => ganti(it.key, f)}
                onRemove={() => hapus(it.key)}
              />
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
