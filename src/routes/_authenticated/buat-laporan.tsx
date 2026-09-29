import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Eye, Send } from "lucide-react";
import { useMemo, useState } from "react";
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
      { title: "Buat Laporan · Laporan Kegiatan Trainer K3 PT IWIP" },
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
  jam_mulai: string;
  jam_selesai: string;
  jenis_kegiatan: string;
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

function hariIni() {
  return new Date().toISOString().slice(0, 10);
}

const FORM_AWAL: FormState = {
  tanggal_kegiatan: hariIni(),
  jam_mulai: "",
  jam_selesai: "",
  jenis_kegiatan: "",
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

function formatTanggalIndonesia(value: string) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function BuatLaporan() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { trainer, nama, loading } = useCurrentUser();

  const [form, setForm] = useState<FormState>(FORM_AWAL);
  const [preview, setPreview] = useState(false);

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
      materi:
        schedule.nama_kegiatan ||
        current.materi,
      material_id: schedule.material_id ?? current.material_id,
    }));
  }

  function validasiForm() {
    if (!trainer?.id) {
      return "Akun trainer belum tertaut ke data trainer.";
    }

    if (!form.tanggal_kegiatan) {
      return "Tanggal kegiatan wajib diisi.";
    }

    if (!form.materi.trim()) {
      return "Materi atau kegiatan wajib diisi.";
    }

    if (form.jumlah_peserta < 0) {
      return "Jumlah peserta tidak boleh negatif.";
    }

    if (form.jumlah_hadir < 0 || form.jumlah_tidak_hadir < 0) {
      return "Jumlah hadir dan tidak hadir tidak boleh negatif.";
    }

    if (
      form.jumlah_hadir + form.jumlah_tidak_hadir >
      form.jumlah_peserta
    ) {
      return "Jumlah hadir + tidak hadir tidak boleh melebihi jumlah peserta.";
    }

    if (form.jam_mulai && form.jam_selesai) {
      if (form.jam_selesai <= form.jam_mulai) {
        return "Jam selesai harus lebih besar dari jam mulai.";
      }
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

      const {
        data: sessionData,
      } = await supabase.auth.getSession();

      const userId = sessionData.session?.user.id;

      if (!userId) {
        throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
      }

      const payload = {
        trainer_id: trainer.id,
        schedule_id: form.schedule_id || null,
        material_id: form.material_id || null,
        tanggal_kegiatan: form.tanggal_kegiatan,
        jam_mulai: form.jam_mulai || null,
        jam_selesai: form.jam_selesai || null,
        jam_perlu_konfirmasi: !form.jam_mulai || !form.jam_selesai,
        jenis_kegiatan: form.jenis_kegiatan || null,
        materi: form.materi.trim(),
        kelas: form.kelas.trim() || null,
        lokasi: form.lokasi.trim() || null,
        penanggung_jawab: form.penanggung_jawab.trim() || null,
        jumlah_peserta: form.jumlah_peserta,
        jumlah_hadir: form.jumlah_hadir,
        jumlah_tidak_hadir: form.jumlah_tidak_hadir,
        jumlah_tambahan: form.jumlah_tambahan,
        keterangan: form.keterangan.trim() || null,
        sumber_laporan: "manual" as const,
        waktu_laporan_dikirim: new Date().toISOString(),
        status_laporan: "terkirim" as const,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from("reports")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      return data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["reports"],
      });

      toast.success("Laporan berhasil dikirim.", {
        description: "Laporan masuk ke daftar untuk proses verifikasi.",
      });

      setPreview(false);
      setForm(FORM_AWAL);

      navigate({
        to: "/dashboard",
      });
    },

    onError: (error) => {
      toast.error("Laporan belum berhasil dikirim.", {
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat menyimpan laporan.",
      });
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

  if (loading) {
    return (
      <AppShell title="Buat Laporan" eyebrow="Laporan Kegiatan Trainer">
        <Panel>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Memuat data trainer…
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

  if (preview) {
    return (
      <AppShell
        title="Preview Laporan"
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

          <div className="grid gap-4 md:grid-cols-2">
            <PreviewItem
              label="Trainer"
              value={trainer.nama_lengkap || nama || "-"}
            />
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
            <PreviewItem
              label="Jenis Kegiatan"
              value={form.jenis_kegiatan || "-"}
            />
            <PreviewItem label="Materi / Kegiatan" value={form.materi} />
            <PreviewItem label="Kelas" value={form.kelas || "-"} />
            <PreviewItem label="Lokasi" value={form.lokasi || "-"} />
            <PreviewItem
              label="Penanggung Jawab"
              value={form.penanggung_jawab || "-"}
            />
          </div>

          <div className="mt-4 rounded-xl border border-border/70 bg-card/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Data Peserta
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PreviewNumber
                label="Jumlah Peserta"
                value={form.jumlah_peserta}
              />
              <PreviewNumber label="Hadir" value={form.jumlah_hadir} />
              <PreviewNumber
                label="Tidak Hadir"
                value={form.jumlah_tidak_hadir}
              />
              <PreviewNumber
                label="Tambahan"
                value={form.jumlah_tambahan}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/70 bg-card/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Keterangan
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {form.keterangan || "-"}
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
              <Send className="mr-2 size-4" />
              {kirimLaporan.isPending
                ? "Mengirim…"
                : "Konfirmasi & Kirim"}
            </Button>
          </div>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Buat Laporan"
      eyebrow="Laporan Kegiatan Trainer"
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="mr-2 size-4" />
          Kembali
        </Button>
      }
    >
      <Panel>
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
            <h2 className="text-sm font-semibold">Waktu Kegiatan</h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tanggal">Tanggal kegiatan *</Label>
                <Input
                  id="tanggal"
                  type="date"
                  value={form.tanggal_kegiatan}
                  onChange={(e) =>
                    updateField("tanggal_kegiatan", e.target.value)
                  }
                />
              </div>

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
              Jika jam belum diketahui, boleh dikosongkan. Sistem akan menandai
              waktu tersebut untuk konfirmasi.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Kegiatan</h2>

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
                    {loadingActivities
                      ? "Memuat jenis kegiatan…"
                      : "Pilih jenis kegiatan"}
                  </option>

                  {activityTypes
                    .filter((item) => item.aktif)
                    .map((item) => (
                      <option key={item.id} value={item.nama}>
                        {item.nama}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
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

              <div className="space-y-2">
                <Label htmlFor="kelas">Kelas</Label>
                <Input
                  id="kelas"
                  placeholder="Contoh: Kelas A / Kelas B"
                  value={form.kelas}
                  onChange={(e) => updateField("kelas", e.target.value)}
                />
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
                <Label htmlFor="lokasi">Lokasi</Label>
                <Input
                  id="lokasi"
                  placeholder="Contoh: Ruang Training K3"
                  value={form.lokasi}
                  onChange={(e) => updateField("lokasi", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="penanggung-jawab">
                  Penanggung jawab
                </Label>
                <Input
                  id="penanggung-jawab"
                  placeholder="Nama penanggung jawab"
                  value={form.penanggung_jawab}
                  onChange={(e) =>
                    updateField("penanggung_jawab", e.target.value)
                  }
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Jumlah Peserta</h2>

            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <NumberField
                id="jumlah-peserta"
                label="Jumlah peserta"
                value={form.jumlah_peserta}
                onChange={(value) =>
                  updateField("jumlah_peserta", value)
                }
              />

              <NumberField
                id="jumlah-hadir"
                label="Hadir"
                value={form.jumlah_hadir}
                onChange={(value) =>
                  updateField("jumlah_hadir", value)
                }
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
                onChange={(value) =>
                  updateField("jumlah_tambahan", value)
                }
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Jumlah tambahan dicatat sebagai data terpisah dan tidak otomatis
              ditambahkan ke jumlah peserta.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Keterangan</h2>

            <div className="mt-3 space-y-2">
              <Label htmlFor="keterangan">Catatan / keterangan tambahan</Label>
              <Textarea
                id="keterangan"
                rows={5}
                placeholder="Tulis keterangan kegiatan jika diperlukan…"
                value={form.keterangan}
                onChange={(e) =>
                  updateField("keterangan", e.target.value)
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card/30 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />

              <div>
                <p className="text-sm font-semibold">
                  Dokumentasi foto
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload foto dokumentasi akan kita sambungkan pada tahap
                  berikutnya setelah alur laporan manual ini stabil.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={bukaPreview} size="lg">
              <Eye className="mr-2 size-4" />
              Preview Laporan
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

function PreviewItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function PreviewNumber({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
