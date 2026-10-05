import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Lightbulb,
  ListChecks,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";

import { AppShell, Panel } from "@/components/AppShell";
import { StatTile } from "@/components/StatTile";
import { StatusBadge } from "@/components/StatusBadge";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchReports } from "@/lib/queries";
import { formatTanggalPendek, hariIniISO, rentangJam } from "@/lib/status";
import { uploadGambar, useStorageUrl } from "@/lib/branding";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Laporan Kegiatan Trainer K3 PT IWIP" },
      {
        name: "description",
        content:
          "Ringkasan laporan kegiatan trainer K3 PT IWIP: laporan hari ini, bulan ini, terverifikasi, dan yang perlu revisi.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isStaff, nama, trainer, user } = useCurrentUser();
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", "dashboard", trainer?.id ?? "semua", isStaff],
    queryFn: () => fetchReports(isStaff ? {} : { trainerId: trainer?.id ?? "" }),
    enabled: isStaff || Boolean(trainer?.id),
  });

  const hariIni = hariIniISO();
  const bulanIni = hariIni.slice(0, 7);

  const jumlahHariIni = reports.filter((r) => r.tanggal_kegiatan === hariIni).length;
  const jumlahBulanIni = reports.filter((r) => r.tanggal_kegiatan.startsWith(bulanIni)).length;
  const terverifikasiBulanIni = reports.filter(
    (r) =>
      r.status_laporan === "terverifikasi" &&
      r.tanggal_kegiatan.startsWith(bulanIni),
  ).length;
  const perluRevisi = reports.filter((r) => r.status_laporan === "perlu_revisi").length;
  const menungguVerifikasi = reports.filter(
    (r) => r.status_laporan === "menunggu_verifikasi" || r.status_laporan === "terkirim",
  ).length;

  const terbaru = reports.slice(0, 8);

  return (
    <AppShell
      eyebrow={isStaff ? "Ringkasan Seluruh Trainer" : "Ringkasan Laporan Saya"}
      title={`Selamat datang, ${nama}`}
      heroKey="hero_dashboard"
    >
      {/* KARTU PROFIL TRAINER (cuma buat trainer, bukan staff) */}
      {!isStaff && trainer ? (
        <TrainerProfileCard
          trainer={trainer}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["current-user"] })}
        />
      ) : null}

      {/* 5 KARTU STATISTIK */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Laporan Hari Ini"
          value={jumlahHariIni}
          hint={formatTanggalPendek(hariIni)}
        />
        <StatTile label="Laporan Bulan Ini" value={jumlahBulanIni} />
        <StatTile
          label="Terverifikasi"
          value={terverifikasiBulanIni}
          tone="verified"
        />
        <StatTile
          label="Menunggu Verifikasi"
          value={menungguVerifikasi}
          tone="review"
        />
        <StatTile label="Perlu Revisi" value={perluRevisi} tone="revision" />
      </div>

      {/* TABEL LAPORAN TERBARU */}
      <Panel className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Laporan Terbaru</h2>
          <span className="eyebrow text-muted-foreground">
            {reports.length} laporan
          </span>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Memuat data…
          </p>
        ) : terbaru.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada laporan tercatat.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {terbaru.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
              >
                <span className="num w-24 shrink-0 text-xs text-muted-foreground">
                  {formatTanggalPendek(r.tanggal_kegiatan)}
                </span>
                <span className="num w-28 shrink-0 text-xs text-muted-foreground">
                  {rentangJam(r.jam_mulai, r.jam_selesai)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {r.materi}
                </span>
                {isStaff && r.trainers ? (
                  <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">
                    {r.trainers.nama_lengkap}
                  </span>
                ) : null}
                <StatusBadge status={r.status_laporan} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* INFO BOX */}
      <Panel className="mt-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lightbulb className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Tahap pembuatan laporan</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Basis data, hak akses (trainer/admin/supervisor), data master
              trainer, materi, jenis kegiatan, dan jadwal Hari 1 / Hari 2 sudah
              tersimpan.
            </p>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}

/* =============================================================
   KARTU PROFIL TRAINER
============================================================= */

type TrainerRow = {
  id: string;
  nama_lengkap: string;
  nomor_id_trainer: string;
  jabatan: string | null;
  departemen: string | null;
  foto_profil: string | null;
};

function TrainerProfileCard({
  trainer,
  onUpdated,
}: {
  trainer: TrainerRow;
  onUpdated: () => void;
}) {
  const [openUpload, setOpenUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const currentUrl = useStorageUrl(trainer.foto_profil);

  function pilihFile(file: File | null) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format harus JPG, JPEG, PNG, atau WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran maksimal 5 MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function simpanFoto() {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Upload ke bucket branding, folder trainer/
      const path = await uploadGambar(selectedFile, "trainer");

      // Update DB
      const { error } = await supabase
        .from("trainers")
        .update({ foto_profil: path })
        .eq("id", trainer.id);

      if (error) throw error;

      toast.success("Foto profil berhasil diperbarui.");
      setOpenUpload(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      onUpdated();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Gagal mengunggah foto.",
      );
    } finally {
      setUploading(false);
    }
  }

  function tutupModal() {
    if (uploading) return;
    setOpenUpload(false);
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  return (
    <>
      <Panel className="mb-4">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="relative">
            <TrainerAvatar
              nama={trainer.nama_lengkap}
              foto={trainer.foto_profil}
              className="size-20 ring-4 ring-card"
            />
            <button
              type="button"
              onClick={() => setOpenUpload(true)}
              className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110"
              title="Ganti foto"
            >
              <Camera className="size-4" />
            </button>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Profil Trainer
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {trainer.nama_lengkap}
            </h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="num">ID: {trainer.nomor_id_trainer}</span>
              {trainer.jabatan ? (
                <>
                  <span className="text-border">•</span>
                  <span>{trainer.jabatan}</span>
                </>
              ) : null}
              {trainer.departemen ? (
                <>
                  <span className="text-border">•</span>
                  <span>{trainer.departemen}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Action */}
          <Button
            variant="outline"
            onClick={() => setOpenUpload(true)}
            className="shrink-0"
          >
            <Upload className="mr-2 size-4" />
            {trainer.foto_profil ? "Ganti Foto" : "Upload Foto"}
          </Button>
        </div>
      </Panel>

      {/* MODAL UPLOAD */}
      <Dialog open={openUpload} onOpenChange={(o) => !o && tutupModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ganti Foto Profil</DialogTitle>
            <DialogDescription>
              Pilih foto profil Anda. Format JPG, JPEG, PNG, atau WEBP.
              Maksimal 5 MB.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Preview */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="grid size-32 place-items-center overflow-hidden rounded-full border-4 border-border bg-muted">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="size-full object-cover"
                    />
                  ) : currentUrl ? (
                    <img
                      src={currentUrl}
                      alt="Foto sekarang"
                      className="size-full object-cover"
                    />
                  ) : (
                    <UserIcon className="size-12 text-muted-foreground" />
                  )}
                </div>
                {previewUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="absolute -top-1 -right-1 grid size-7 place-items-center rounded-full bg-destructive text-white shadow-lg"
                    title="Batalkan pilihan"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Input file */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                pilihFile(file);
                e.currentTarget.value = "";
              }}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 size-4" />
              {selectedFile ? "Ganti Pilihan Foto" : "Pilih Foto"}
            </Button>

            {selectedFile ? (
              <p className="truncate text-center text-xs text-muted-foreground">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={tutupModal} disabled={uploading}>
              Batal
            </Button>
            <Button
              onClick={simpanFoto}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Menyimpan…" : "Simpan Foto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
