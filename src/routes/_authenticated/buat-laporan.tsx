import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Eye,
  FilePenLine,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchActivityTypes,
  fetchMaterials,
  fetchSchedules,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/buat-laporan")({
  head: () => ({
    meta: [
      {
        title: "Buat Laporan · Laporan Kegiatan Trainer K3 PT IWIP",
      },
      {
        name: "description",
        content: "Form laporan kegiatan trainer K3 PT IWIP.",
      },
    ],
  }),
  component: BuatLaporan,
});

type FormState = {
  tanggal_kegiatan: string;
  tanggal_selesai: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_kegiatan: string;
  jenis_kegiatan_kategori: string;
  keterangan_cuti: string;
  materi: string;
  material_id: string;
  schedule_id: string;
  kelas: string;
  lokasi: string;
  penanggung_jawab: string;
  jumlah_peserta: number;
  jumlah_hadir: number;
  jumlah_tidak_hadir: number;
  jumlah_tambahan: number;
  keterangan: string;
};

type ExistingPhoto = {
  id: string;
  storage_path: string;
  nama_file: string | null;
  url: string;
};

const MAX_PHOTOS = 10;
const SEPARATOR_KETERANGAN = " | ";

function hariIni() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const FORM_AWAL: FormState = {
  tanggal_kegiatan: hariIni(),
  tanggal_selesai: "",
  jam_mulai: "",
  jam_selesai: "",
  jenis_kegiatan: "",
  jenis_kegiatan_kategori: "",
  keterangan_cuti: "",
  materi: "",
  material_id: "",
  schedule_id: "",
  kelas: "",
  lokasi: "",
  penanggung_jawab: "",
  jumlah_peserta: 0,
  jumlah_hadir: 0,
  jumlah_tidak_hadir: 0,
  jumlah_tambahan: 0,
  keterangan: "",
};

const OPSI_CUTI = ["Cuti Tahunan", "Cuti Roster", "Cuti Public Holiday"];
const OPSI_IZIN = ["Izin Resmi", "Izin Tidak Resmi"];
const OPSI_SAKIT = ["Sakit"];
const SEMUA_OPSI_KHUSUS = [...OPSI_CUTI, ...OPSI_IZIN, ...OPSI_SAKIT];

function isCutiIzinSakit(value: string): boolean {
  return SEMUA_OPSI_KHUSUS.includes(value);
}

function formatTanggalIndonesia(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function hitungHari(start: string, end: string) {
  if (!start || !end) return 0;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if ([sy, sm, sd, ey, em, ed].some((n) => Number.isNaN(n))) return 0;
  const s = Date.UTC(sy!, sm! - 1, sd!);
  const e = Date.UTC(ey!, em! - 1, ed!);
  if (e < s) return 0;
  return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Pecah keterangan gabungan jadi keterangan_cuti + keterangan.
 * Format DB: "keterangan_cuti | keterangan_tambahan"
 * Kalau gak ada separator, anggap semua isinya keterangan_cuti.
 */
function pecahKeterangan(full: string): {
  keterangan_cuti: string;
  keterangan: string;
} {
  if (!full) return { keterangan_cuti: "", keterangan: "" };

  const idx = full.indexOf(SEPARATOR_KETERANGAN);
  if (idx === -1) {
    return { keterangan_cuti: full, keterangan: "" };
  }

  return {
    keterangan_cuti: full.slice(0, idx).trim(),
    keterangan: full.slice(idx + SEPARATOR_KETERANGAN.length).trim(),
  };
}

/**
 * Gabung keterangan_cuti + keterangan jadi 1 string.
 * Kalau salah satu kosong, hasilnya yang ada aja.
 */
function gabungKeterangan(
  keteranganCuti: string,
  keterangan: string,
): string {
  return [keteranganCuti.trim(), keterangan.trim()]
    .filter(Boolean)
    .join(SEPARATOR_KETERANGAN);
}

function BuatLaporan() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { trainer, nama, loading } = useCurrentUser();

  const [form, setForm] = useState<FormState>(FORM_AWAL);
  const [preview, setPreview] = useState(false);
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [revisionNote, setRevisionNote] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [penanggungJawabOption, setPenanggungJawabOption] = useState("");

  const isEditMode = Boolean(editId);

  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ["materials", "buat-laporan"],
    queryFn: fetchMaterials,
  });

  const { data: activityTypes = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["activity-types", "buat-laporan"],
    queryFn: fetchActivityTypes,
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ["schedules", "buat-laporan"],
    queryFn: fetchSchedules,
  });

  const scheduleAktif = useMemo(
    () => schedules.filter((item) => item.aktif),
    [schedules],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("edit");
    setEditId(id);
  }, []);

  useEffect(() => {
    const trainerId = trainer?.id;
    const reportId = editId;
    if (!trainerId || !reportId) return;

    let cancelled = false;

    async function loadReport() {
      setLoadingEdit(true);

      try {
        const { data: report, error } = await supabase
          .from("reports")
          .select("*")
          .eq("id", reportId!)
          .eq("trainer_id", trainerId!)
          .maybeSingle();

        if (error) throw error;

        if (!report) {
          throw new Error(
            "Laporan tidak ditemukan atau bukan milik akun trainer ini.",
          );
        }

        if (report.status_laporan !== "perlu_revisi") {
          throw new Error("Laporan ini tidak sedang menunggu revisi.");
        }

        const { data: photos, error: photoError } = await supabase
          .from("report_photos")
          .select("id, storage_path, nama_file")
          .eq("report_id", reportId!);

        if (photoError) throw photoError;

        const signedPhotos: ExistingPhoto[] = [];

        for (const photo of photos ?? []) {
          const { data: signed, error: signedError } =
            await supabase.storage
              .from("report-photos")
              .createSignedUrl(photo.storage_path, 60 * 60);

          if (!signedError && signed?.signedUrl) {
            signedPhotos.push({
              id: photo.id,
              storage_path: photo.storage_path,
              nama_file: photo.nama_file,
              url: signed.signedUrl,
            });
          }
        }

        if (cancelled) return;

        const jenis = report.jenis_kegiatan ?? "";
        const cuti = isCutiIzinSakit(jenis);

        // FIX: pisah keterangan yang udah digabung
        const fullKeterangan = report.keterangan ?? "";
        const { keterangan_cuti, keterangan } = pecahKeterangan(fullKeterangan);

        setForm({
          tanggal_kegiatan: report.tanggal_kegiatan ?? hariIni(),
          tanggal_selesai: (report as any).tanggal_selesai ?? "",
          jam_mulai: report.jam_mulai?.slice(0, 5) ?? "",
          jam_selesai: report.jam_selesai?.slice(0, 5) ?? "",
          jenis_kegiatan: jenis,
          jenis_kegiatan_kategori: cuti ? "KHUSUS" : "LAINNYA",
          // Kalau cuti, isi keterangan_cuti dari data, kalau bukan cuti isi keterangan umum
          keterangan_cuti: cuti ? keterangan_cuti : "",
          materi: report.materi ?? "",
          material_id: report.material_id ?? "",
          schedule_id: report.schedule_id ?? "",
          kelas: report.kelas ?? "",
          lokasi: report.lokasi ?? "",
          penanggung_jawab: report.penanggung_jawab ?? "",
          jumlah_peserta: report.jumlah_peserta ?? 0,
          jumlah_hadir: report.jumlah_hadir ?? 0,
          jumlah_tidak_hadir: report.jumlah_tidak_hadir ?? 0,
          jumlah_tambahan: report.jumlah_tambahan ?? 0,
          // Kalau cuti, sisa keterangan jadi keterangan umum; kalau bukan, semua jadi keterangan umum
          keterangan: cuti ? keterangan : fullKeterangan,
        });

        setRevisionNote(report.catatan_revisi ?? "");

        if (report.penanggung_jawab === "Muhammad Halid (Superintendent)") {
          setPenanggungJawabOption("Muhammad Halid (Superintendent)");
        } else if (report.penanggung_jawab) {
          setPenanggungJawabOption("Lainnya");
        } else {
          setPenanggungJawabOption("");
        }

        setExistingPhotos(signedPhotos);
      } catch (error) {
        toast.error("Laporan tidak dapat dibuka.", {
          description:
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan saat memuat laporan.",
        });

        navigate({ to: "/laporan", search: {} });
      } finally {
        if (!cancelled) {
          setLoadingEdit(false);
        }
      }
    }

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [trainer?.id, editId, navigate]);

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  function pilihMaterial(materialId: string) {
    const material = materials.find((item) => item.id === materialId);

    setForm((current) => ({
      ...current,
      material_id: materialId,
      materi: material?.nama ?? current.materi,
    }));
  }

  function pilihJadwal(scheduleId: string) {
    const schedule = schedules.find((item) => item.id === scheduleId);

    if (!schedule) {
      updateField("schedule_id", "");
      return;
    }

    setForm((current) => ({
      ...current,
      schedule_id: scheduleId,
      jam_mulai: schedule.jam_mulai?.slice(0, 5) ?? current.jam_mulai,
      jam_selesai: schedule.jam_selesai?.slice(0, 5) ?? current.jam_selesai,
      kelas: schedule.kelas ?? current.kelas,
      jenis_kegiatan: schedule.kategori ?? current.jenis_kegiatan,
      materi: schedule.nama_kegiatan || current.materi,
      material_id: schedule.material_id ?? current.material_id,
    }));
  }

  function totalFoto() {
    return existingPhotos.length + fotoFiles.length;
  }

  function tambahFoto(files: FileList | null) {
    if (!files) return;

    const selected = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (selected.length === 0) {
      toast.error("File yang dipilih harus berupa foto.");
      return;
    }

    const sisaSlot = Math.max(0, MAX_PHOTOS - totalFoto());

    if (sisaSlot === 0) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto per laporan.`);
      return;
    }

    const accepted = selected.slice(0, sisaSlot);

    if (accepted.length < selected.length) {
      toast.warning(
        `Hanya ${accepted.length} foto yang ditambahkan karena maksimal ${MAX_PHOTOS} foto.`,
      );
    }

    setFotoFiles((current) => [...current, ...accepted]);
  }

  function hapusFoto(index: number) {
    setFotoFiles((current) => current.filter((_, i) => i !== index));
  }

  function validasiForm() {
    if (!trainer?.id) {
      return "Akun trainer belum tertaut ke data trainer.";
    }

    if (!form.tanggal_kegiatan) {
      return "Tanggal kegiatan wajib diisi.";
    }

    if (isCutiIzinSakit(form.jenis_kegiatan)) {
      if (!form.tanggal_selesai) {
        return "Tanggal selesai wajib diisi untuk Cuti/Izin/Sakit.";
      }

      if (form.tanggal_selesai < form.tanggal_kegiatan) {
        return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
      }
    }

    if (!form.materi.trim()) {
      return "Materi atau kegiatan wajib diisi.";
    }

    if (totalFoto() > MAX_PHOTOS) {
      return `Maksimal ${MAX_PHOTOS} foto per laporan.`;
    }

    if (form.jumlah_peserta < 0) {
      return "Jumlah peserta tidak boleh negatif.";
    }

    if (form.jumlah_hadir < 0 || form.jumlah_tidak_hadir < 0) {
      return "Jumlah hadir dan tidak hadir tidak boleh negatif.";
    }

    if (form.jumlah_hadir + form.jumlah_tidak_hadir > form.jumlah_peserta) {
      return "Jumlah hadir + tidak hadir tidak boleh melebihi jumlah peserta.";
    }

    if (
      form.jam_mulai &&
      form.jam_selesai &&
      form.jam_selesai <= form.jam_mulai
    ) {
      return "Jam selesai harus lebih besar dari jam mulai.";
    }

    if (
      penanggungJawabOption === "Lainnya" &&
      !form.penanggung_jawab.trim()
    ) {
      return "Nama penanggung jawab lainnya wajib diisi.";
    }

    return null;
  }

  const kirimLaporan = useMutation({
    mutationFn: async () => {
      if (!trainer?.id) {
        throw new Error("Data trainer tidak ditemukan.");
      }

      const errorValidasi = validasiForm();

      if (errorValidasi) {
        throw new Error(errorValidasi);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
      }

      const isCuti = isCutiIzinSakit(form.jenis_kegiatan);

      // FIX: pakai fungsi gabung biar konsisten
      const keteranganFinal = isCuti
        ? gabungKeterangan(form.keterangan_cuti, form.keterangan)
        : form.keterangan.trim();

      const payloadBase = {
        schedule_id: form.schedule_id || null,
        material_id: form.material_id || null,
        tanggal_kegiatan: form.tanggal_kegiatan,
        tanggal_selesai: isCuti ? form.tanggal_selesai || null : null,
        jam_mulai: isCuti ? null : form.jam_mulai || null,
        jam_selesai: isCuti ? null : form.jam_selesai || null,
        jam_perlu_konfirmasi: isCuti
          ? false
          : !form.jam_mulai || !form.jam_selesai,
        jenis_kegiatan: form.jenis_kegiatan || null,
        materi: form.materi.trim(),
        kelas: isCuti ? null : form.kelas.trim() || null,
        lokasi: isCuti ? null : form.lokasi.trim() || null,
        penanggung_jawab: form.penanggung_jawab.trim() || null,
        jumlah_peserta: isCuti ? 0 : form.jumlah_peserta,
        jumlah_hadir: isCuti ? 0 : form.jumlah_hadir,
        jumlah_tidak_hadir: isCuti ? 0 : form.jumlah_tidak_hadir,
        jumlah_tambahan: isCuti ? 0 : form.jumlah_tambahan,
        keterangan: keteranganFinal || null,
        updated_at: new Date().toISOString(),
      };

      if (editId) {
        const { data: existingReport, error: existingError } = await supabase
          .from("reports")
          .select("id, trainer_id, status_laporan")
          .eq("id", editId)
          .eq("trainer_id", trainer.id)
          .maybeSingle();

        if (existingError) throw existingError;

        if (!existingReport) {
          throw new Error(
            "Laporan tidak ditemukan atau bukan milik trainer ini.",
          );
        }

        if (existingReport.status_laporan !== "perlu_revisi") {
          throw new Error("Laporan sudah tidak berada pada status Perlu Revisi.");
        }

        const { error: updateError } = await supabase
          .from("reports")
          .update({
            ...payloadBase,
            status_laporan: "menunggu_verifikasi" as const,
            verified_by: null,
            verified_at: null,
            catatan_revisi: revisionNote || null,
            waktu_laporan_dikirim: new Date().toISOString(),
          })
          .eq("id", editId)
          .eq("trainer_id", trainer.id);

        if (updateError) throw updateError;

        if (fotoFiles.length > 0) {
          for (const file of fotoFiles) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const storagePath = `${trainer.id}/${editId}/${crypto.randomUUID()}-${safeName}`;

            const { error: uploadError } = await supabase.storage
              .from("report-photos")
              .upload(storagePath, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || "image/jpeg",
              });

            if (uploadError) {
              toast.warning(
                "Data laporan sudah diperbarui, tetapi salah satu foto gagal diunggah.",
                { description: uploadError.message },
              );
              continue;
            }

            const { error: photoRowError } = await supabase
              .from("report_photos")
              .insert({
                report_id: editId,
                storage_path: storagePath,
                nama_file: file.name,
                uploaded_by: userId,
              });

            if (photoRowError) {
              toast.warning(
                "Foto berhasil diunggah, tetapi data foto gagal dicatat.",
                { description: photoRowError.message },
              );
            }
          }
        }

        return { mode: "edit" as const, id: editId };
      }

      const payload = {
        trainer_id: trainer.id,
        ...payloadBase,
        sumber_laporan: "manual" as const,
        waktu_laporan_dikirim: new Date().toISOString(),
        status_laporan: "menunggu_verifikasi" as const,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from("reports")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      if (fotoFiles.length > 0) {
        for (const file of fotoFiles) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `${trainer.id}/${data.id}/${crypto.randomUUID()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("report-photos")
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "image/jpeg",
            });

          if (uploadError) {
            toast.warning("Laporan tersimpan, tetapi foto belum berhasil diunggah.", {
              description: uploadError.message,
            });
            continue;
          }

          const { error: photoRowError } = await supabase
            .from("report_photos")
            .insert({
              report_id: data.id,
              storage_path: storagePath,
              nama_file: file.name,
              uploaded_by: userId,
            });

          if (photoRowError) {
            toast.warning("Laporan tersimpan, tetapi data foto belum tercatat.", {
              description: photoRowError.message,
            });
          }
        }
      }

      return { mode: "new" as const, id: data.id };
    },

    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });

      if (result.mode === "edit") {
        toast.success("Laporan berhasil dikirim ulang.", {
          description: "Status laporan: Menunggu Verifikasi.",
        });
      } else {
        toast.success("Laporan berhasil dikirim.", {
          description: "Status laporan: Menunggu Verifikasi.",
        });
      }

      setPreview(false);
      setForm(FORM_AWAL);
      setFotoFiles([]);
      setExistingPhotos([]);
      setPenanggungJawabOption("");
      setRevisionNote("");

      navigate({ to: "/laporan", search: {} });
    },

    onError: (error) => {
      toast.error(
        isEditMode
          ? "Laporan belum berhasil dikirim ulang."
          : "Laporan belum berhasil dikirim.",
        {
          description:
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan saat menyimpan laporan.",
        },
      );
    },
  });

  function bukaPreview() {
    const errorValidasi = validasiForm();

    if (errorValidasi) {
      toast.error("Periksa kembali laporan.", {
        description: errorValidasi,
      });
      return;
    }

    setPreview(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading || (isEditMode && loadingEdit)) {
    return (
      <AppShell
        title={isEditMode ? "Edit Laporan" : "Buat Laporan"}
        eyebrow="Laporan Kegiatan Trainer"
      >
        <Panel>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isEditMode
              ? "Memuat laporan yang perlu direvisi…"
              : "Memuat data trainer…"}
          </p>
        </Panel>
      </AppShell>
    );
  }

  if (!trainer) {
    return (
      <AppShell title="Buat Laporan" eyebrow="Laporan Kegiatan Trainer">
        <Panel>
          <div className="py-8 text-center">
            <p className="text-sm font-medium">
              Akun ini belum tertaut ke data trainer.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Hubungi Admin untuk menautkan akun ke Master Trainer.
            </p>
          </div>
        </Panel>
      </AppShell>
    );
  }

  // ============================
  // PREVIEW
  // ============================
  if (preview) {
    const isCuti = isCutiIzinSakit(form.jenis_kegiatan);
    const jumlahHari = isCuti
      ? hitungHari(form.tanggal_kegiatan, form.tanggal_selesai)
      : 0;

    // FIX: tampilkan keterangan tanpa duplikat
    const keteranganTampil = isCuti
      ? gabungKeterangan(form.keterangan_cuti, form.keterangan)
      : form.keterangan;

    return (
      <AppShell
        title={isEditMode ? "Preview Kirim Ulang" : "Preview Laporan"}
        eyebrow="Periksa sebelum dikirim"
        actions={
          <Button
            variant="outline"
            onClick={() => setPreview(false)}
            disabled={kirimLaporan.isPending}
          >
            <ArrowLeft className="mr-2 size-4" />
            Kembali Edit
          </Button>
        }
      >
        <Panel>
          {isEditMode && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
              <RotateCcw className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold">Laporan akan dikirim ulang</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Setelah dikirim, status laporan akan kembali menjadi{" "}
                  <b>Menunggu Verifikasi</b>.
                </p>
                {revisionNote && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-background/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Catatan Revisi
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {revisionNote}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isEditMode && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Eye className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Preview sebelum dikirim</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Periksa seluruh data di bawah. Data belum disimpan sampai lu
                  menekan tombol <b>Konfirmasi & Kirim</b>.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <PreviewItem
              label="Trainer"
              value={trainer.nama_lengkap || nama || "-"}
            />

            <PreviewItem
              label="Jenis Kegiatan"
              value={form.jenis_kegiatan || "-"}
            />

            {isCuti ? (
              <>
                <PreviewItem
                  label="Tanggal Mulai"
                  value={formatTanggalIndonesia(form.tanggal_kegiatan)}
                />
                <PreviewItem
                  label="Tanggal Selesai"
                  value={formatTanggalIndonesia(form.tanggal_selesai)}
                />
                <PreviewItem
                  label="Durasi"
                  value={`${jumlahHari} hari`}
                />
              </>
            ) : (
              <>
                <PreviewItem
                  label="Tanggal Kegiatan"
                  value={formatTanggalIndonesia(form.tanggal_kegiatan)}
                />
                <PreviewItem
                  label="Jam Kegiatan"
                  value={
                    form.jam_mulai && form.jam_selesai
                      ? `${form.jam_mulai} – ${form.jam_selesai}`
                      : "Belum lengkap / perlu konfirmasi"
                  }
                />
                <PreviewItem label="Kelas" value={form.kelas || "-"} />
                <PreviewItem label="Lokasi" value={form.lokasi || "-"} />
              </>
            )}

            <PreviewItem label="Materi / Kegiatan" value={form.materi} />

            <PreviewItem
              label="Penanggung Jawab"
              value={form.penanggung_jawab || "-"}
            />
          </div>

          {!isCuti && (
            <div className="mt-4 rounded-xl border border-border/70 bg-card/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data Peserta
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PreviewNumber label="Jumlah Peserta" value={form.jumlah_peserta} />
                <PreviewNumber label="Hadir" value={form.jumlah_hadir} />
                <PreviewNumber
                  label="Tidak Hadir"
                  value={form.jumlah_tidak_hadir}
                />
                <PreviewNumber label="Tambahan" value={form.jumlah_tambahan} />
              </div>
            </div>
          )}

          {keteranganTampil && (
            <div className="mt-4 rounded-xl border border-border/70 bg-card/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Keterangan
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {keteranganTampil}
              </p>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-border/70 bg-card/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dokumentasi Foto
            </p>

            {totalFoto() > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {existingPhotos.map((photo) => (
                  <div
                    key={`existing-${photo.id}`}
                    className="overflow-hidden rounded-lg border"
                  >
                    <img
                      src={photo.url}
                      alt={photo.nama_file ?? "Foto dokumentasi"}
                      className="aspect-square w-full object-cover"
                    />
                    <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                      {photo.nama_file ?? "Foto lama"}
                    </p>
                  </div>
                ))}

                {fotoFiles.map((file, index) => (
                  <div
                    key={`new-${file.name}-${index}`}
                    className="overflow-hidden rounded-lg border"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="aspect-square w-full object-cover"
                    />
                    <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Tidak ada foto dokumentasi.
              </p>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Total foto: {totalFoto()} / {MAX_PHOTOS}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setPreview(false)}
              disabled={kirimLaporan.isPending}
            >
              Kembali Edit
            </Button>

            <Button
              onClick={() => kirimLaporan.mutate()}
              disabled={kirimLaporan.isPending}
            >
              {isEditMode ? (
                <RotateCcw className="mr-2 size-4" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              {kirimLaporan.isPending
                ? "Mengirim…"
                : isEditMode
                  ? "Kirim Ulang"
                  : "Konfirmasi & Kirim"}
            </Button>
          </div>
        </Panel>
      </AppShell>
    );
  }

  // ============================
  // FORM UTAMA
  // ============================
  const isCuti = isCutiIzinSakit(form.jenis_kegiatan);
  const jumlahHariCuti = isCuti
    ? hitungHari(form.tanggal_kegiatan, form.tanggal_selesai)
    : 0;

  return (
    <AppShell
      title={isEditMode ? "Edit Laporan" : "Buat Laporan"}
      eyebrow="Laporan Kegiatan Trainer"
      actions={
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/laporan", search: {} })}
        >
          <ArrowLeft className="mr-2 size-4" />
          Kembali
        </Button>
      }
    >
      <Panel>
        {isEditMode && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <FilePenLine className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Laporan Memerlukan Revisi</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Perbaiki data laporan sesuai catatan dari Admin/Supervisor,
                  lalu lakukan Preview sebelum mengirim ulang.
                </p>
                <div className="mt-3 rounded-lg border border-amber-200 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Catatan Revisi
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium">
                    {revisionNote || "Tidak ada catatan revisi."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-5 rounded-xl border border-border/70 bg-card/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trainer
          </p>
          <p className="mt-1 text-sm font-semibold">
            {trainer.nama_lengkap || nama}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ID Trainer: {trainer.nomor_id_trainer}
          </p>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold">Jenis Kegiatan</h2>

            <div className="mt-3 space-y-2">
              <Label htmlFor="jenis-kegiatan">Jenis kegiatan</Label>

              <select
                id="jenis-kegiatan"
                value={form.jenis_kegiatan}
                onChange={(e) =>
                  updateField("jenis_kegiatan", e.target.value)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">
                  {loadingActivities ? "Memuat jenis kegiatan…" : "Pilih jenis kegiatan"}
                </option>

                <optgroup label="Kegiatan Training">
                  {activityTypes
                    .filter((item) => item.aktif)
                    .map((item) => (
                      <option key={item.id} value={item.nama}>
                        {item.nama}
                      </option>
                    ))}
                </optgroup>

                <optgroup label="Cuti">
                  {OPSI_CUTI.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Izin">
                  {OPSI_IZIN.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Sakit">
                  {OPSI_SAKIT.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>

                <option value="Lainnya">Lainnya (isi manual)</option>
              </select>

              {form.jenis_kegiatan === "Lainnya" && (
                <Input
                  placeholder="Tulis jenis kegiatan lainnya"
                  value={form.jenis_kegiatan}
                  onChange={(e) =>
                    updateField("jenis_kegiatan", e.target.value)
                  }
                />
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">
              {isCuti ? "Rentang Tanggal Cuti / Izin / Sakit" : "Waktu Kegiatan"}
            </h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tanggal">
                  {isCuti ? "Tanggal mulai *" : "Tanggal kegiatan *"}
                </Label>
                <Input
                  id="tanggal"
                  type="date"
                  value={form.tanggal_kegiatan}
                  onChange={(e) =>
                    updateField("tanggal_kegiatan", e.target.value)
                  }
                />
              </div>

              {isCuti && (
                <div className="space-y-2">
                  <Label htmlFor="tanggal-selesai">
                    Tanggal selesai *
                  </Label>
                  <Input
                    id="tanggal-selesai"
                    type="date"
                    min={form.tanggal_kegiatan}
                    value={form.tanggal_selesai}
                    onChange={(e) =>
                      updateField("tanggal_selesai", e.target.value)
                    }
                  />
                </div>
              )}
            </div>

            {isCuti && jumlahHariCuti > 0 && (
              <p className="mt-2 text-xs font-medium text-primary">
                Durasi: {jumlahHariCuti} hari ({formatTanggalIndonesia(form.tanggal_kegiatan)} - {formatTanggalIndonesia(form.tanggal_selesai)})
              </p>
            )}

            {!isCuti && (
              <>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jam-mulai">Jam mulai</Label>
                    <Input
                      id="jam-mulai"
                      type="time"
                      value={form.jam_mulai}
                      onChange={(e) =>
                        updateField("jam_mulai", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jam-selesai">Jam selesai</Label>
                    <Input
                      id="jam-selesai"
                      type="time"
                      value={form.jam_selesai}
                      onChange={(e) =>
                        updateField("jam_selesai", e.target.value)
                      }
                    />
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Jika jam belum diketahui, boleh dikosongkan. Sistem akan
                  menandai waktu tersebut untuk konfirmasi.
                </p>
              </>
            )}
          </section>

          {!isCuti && (
            <section>
              <h2 className="text-sm font-semibold">Detail Kegiatan</h2>

              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="jadwal">Gunakan jadwal master</Label>
                  <select
                    id="jadwal"
                    value={form.schedule_id}
                    onChange={(e) => pilihJadwal(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">
                      {loadingSchedules
                        ? "Memuat jadwal…"
                        : "Pilih jadwal (opsional)"}
                    </option>
                    {scheduleAktif.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.jam_mulai && schedule.jam_selesai
                          ? `${schedule.jam_mulai.slice(0, 5)}–${schedule.jam_selesai.slice(0, 5)} · `
                          : ""}
                        {schedule.nama_kegiatan}
                        {schedule.kelas ? ` · ${schedule.kelas}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="master-materi">Materi dari master</Label>
                  <select
                    id="master-materi"
                    value={form.material_id}
                    onChange={(e) => pilihMaterial(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">
                      {loadingMaterials
                        ? "Memuat materi…"
                        : "Pilih materi (opsional)"}
                    </option>
                    {materials
                      .filter((item) => item.aktif)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nama}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="materi">Materi / kegiatan *</Label>
                <Input
                  id="materi"
                  placeholder="Contoh: K3 Umum"
                  value={form.materi}
                  onChange={(e) => updateField("materi", e.target.value)}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kelas">Kelas</Label>
                  <Input
                    id="kelas"
                    placeholder="Contoh: Kelas A / Kelas B"
                    value={form.kelas}
                    onChange={(e) => updateField("kelas", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lokasi">Lokasi</Label>
                  <select
                    id="lokasi"
                    value={form.lokasi}
                    onChange={(e) => updateField("lokasi", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Pilih lokasi</option>
                    <option value="Dalam Ruangan">Dalam Ruangan</option>
                    <option value="Luar Ruangan">Luar Ruangan</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {isCuti && (
            <section>
              <h2 className="text-sm font-semibold">
                Keterangan Cuti / Izin / Sakit
              </h2>
              <div className="mt-3 space-y-2">
                <Label htmlFor="keterangan-cuti">
                  Keterangan *
                </Label>
                <Textarea
                  id="keterangan-cuti"
                  rows={3}
                  placeholder="Contoh: Cuti tahunan disetujui oleh atasan. / Izin resmi karena urusan keluarga."
                  value={form.keterangan_cuti}
                  onChange={(e) =>
                    updateField("keterangan_cuti", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Keterangan ini akan muncul di laporan bulanan.
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="materi">
                  Materi / kegiatan *
                </Label>
                <Input
                  id="materi"
                  placeholder="Contoh: Cuti Tahunan"
                  value={form.materi}
                  onChange={(e) => updateField("materi", e.target.value)}
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold">Penanggung Jawab</h2>
            <div className="mt-3 space-y-2">
              <Label htmlFor="penanggung-jawab">Penanggung jawab</Label>
              <select
                id="penanggung-jawab"
                value={penanggungJawabOption}
                onChange={(e) => {
                  const value = e.target.value;
                  setPenanggungJawabOption(value);
                  updateField(
                    "penanggung_jawab",
                    value === "Muhammad Halid (Superintendent)" ? value : "",
                  );
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Pilih penanggung jawab</option>
                <option value="Muhammad Halid (Superintendent)">
                  Muhammad Halid (Superintendent)
                </option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {penanggungJawabOption === "Lainnya" && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="penanggung-jawab-lainnya">
                  Nama penanggung jawab lainnya
                </Label>
                <Input
                  id="penanggung-jawab-lainnya"
                  placeholder="Tulis nama penanggung jawab"
                  value={form.penanggung_jawab}
                  onChange={(e) =>
                    updateField("penanggung_jawab", e.target.value)
                  }
                />
              </div>
            )}
          </section>

          {!isCuti && (
            <section>
              <h2 className="text-sm font-semibold">Jumlah Peserta</h2>

              <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                <NumberField
                  id="jumlah-peserta"
                  label="Jumlah peserta"
                  value={form.jumlah_peserta}
                  onChange={(value) => updateField("jumlah_peserta", value)}
                />
                <NumberField
                  id="jumlah-hadir"
                  label="Hadir"
                  value={form.jumlah_hadir}
                  onChange={(value) => updateField("jumlah_hadir", value)}
                />
                <NumberField
                  id="jumlah-tidak-hadir"
                  label="Tidak hadir"
                  value={form.jumlah_tidak_hadir}
                  onChange={(value) =>
                    updateField("jumlah_tidak_hadir", value)
                  }
                />
                <NumberField
                  id="jumlah-tambahan"
                  label="Tambahan"
                  value={form.jumlah_tambahan}
                  onChange={(value) => updateField("jumlah_tambahan", value)}
                />
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Jumlah tambahan dicatat sebagai data terpisah dan tidak
                otomatis ditambahkan ke jumlah peserta.
              </p>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold">Keterangan Tambahan</h2>
            <div className="mt-3 space-y-2">
              <Label htmlFor="keterangan">Catatan tambahan (opsional)</Label>
              <Textarea
                id="keterangan"
                rows={3}
                placeholder="Tulis keterangan tambahan jika diperlukan…"
                value={form.keterangan}
                onChange={(e) => updateField("keterangan", e.target.value)}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card/30 p-4">
            <div className="flex items-start gap-3">
              <Camera className="mt-0.5 size-5 shrink-0 text-primary" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Dokumentasi foto</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Maksimal {MAX_PHOTOS} foto per laporan. Pada laporan revisi,
                  foto lama tetap dipertahankan dan lu bisa menambahkan foto
                  baru sampai batas maksimal.
                </p>

                <div className="mt-4">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={totalFoto() >= MAX_PHOTOS}
                    onChange={(e) => {
                      tambahFoto(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>

                {existingPhotos.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Foto sebelumnya
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                      {existingPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="overflow-hidden rounded-lg border"
                        >
                          <img
                            src={photo.url}
                            alt={photo.nama_file ?? "Foto dokumentasi"}
                            className="aspect-square w-full object-cover"
                          />
                          <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                            {photo.nama_file ?? "Foto lama"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fotoFiles.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Foto tambahan
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                      {fotoFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="relative overflow-hidden rounded-lg border"
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="aspect-square w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => hapusFoto(index)}
                            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                            title="Hapus foto"
                          >
                            <X className="size-3" />
                          </button>
                          <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                            {file.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  Total foto: {totalFoto()} / {MAX_PHOTOS}
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={bukaPreview} size="lg">
              <Eye className="mr-2 size-4" />
              Preview {isEditMode ? "Kirim Ulang" : "Laporan"}
            </Button>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
        }}
      />
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function PreviewNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
