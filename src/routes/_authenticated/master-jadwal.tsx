import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Pencil,
  Plus,
  Power,
  Search,
  TriangleAlert,
} from "lucide-react";

import { AppShell, Panel } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMaterials,
  fetchSchedules,
  fetchTrainingDays,
  jadwalOverlap,
  type ScheduleRow,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/master-jadwal")({
  component: MasterJadwalPage,
});

type FormState = {
  id: string | null;
  training_day_id: string;
  material_id: string;
  nama_kegiatan: string;
  jam_mulai: string;
  jam_selesai: string;
  kategori: string;
  kelas: string;
  materi_lanjutan_dari: string;
  catatan: string;
  urutan: string;
  aktif: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  training_day_id: "",
  material_id: "",
  nama_kegiatan: "",
  jam_mulai: "",
  jam_selesai: "",
  kategori: "",
  kelas: "",
  materi_lanjutan_dari: "",
  catatan: "",
  urutan: "0",
  aktif: true,
};

function MasterJadwalPage() {
  const qc = useQueryClient();

  const [cari, setCari] = useState("");
  const [filterHari, setFilterHari] = useState<string>("semua");
  const [filterAktif, setFilterAktif] = useState<string>("semua");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const {
    data: schedules = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
  });

  const { data: days = [] } = useQuery({
    queryKey: ["training_days"],
    queryFn: fetchTrainingDays,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: fetchMaterials,
  });

  const konflik = useMemo(() => jadwalOverlap(schedules), [schedules]);

  const rows = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return schedules.filter((r) => {
      if (filterHari !== "semua" && r.training_day_id !== filterHari) return false;
      if (filterAktif === "aktif" && !r.aktif) return false;
      if (filterAktif === "nonaktif" && r.aktif) return false;
      if (!q) return true;
      const hay = [
        r.nama_kegiatan,
        r.kategori,
        r.kelas,
        r.catatan,
        r.training_days?.nama,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [schedules, cari, filterHari, filterAktif]);

  const totalAktif = schedules.filter((s) => s.aktif).length;
  const totalNonaktif = schedules.length - totalAktif;

  const simpan = useMutation({
    mutationFn: async (payload: FormState) => {
      if (!payload.nama_kegiatan.trim()) throw new Error("Nama kegiatan wajib diisi");
      if (!payload.training_day_id) throw new Error("Hari training wajib dipilih");
      if (!payload.jam_mulai || !payload.jam_selesai)
        throw new Error("Jam mulai & selesai wajib diisi");
      if (payload.jam_mulai >= payload.jam_selesai)
        throw new Error("Jam selesai harus lebih besar dari jam mulai");

      const body = {
        training_day_id: payload.training_day_id,
        material_id: payload.material_id || null,
        nama_kegiatan: payload.nama_kegiatan.trim(),
        jam_mulai: payload.jam_mulai,
        jam_selesai: payload.jam_selesai,
        kategori: payload.kategori || null,
        kelas: payload.kelas || null,
        materi_lanjutan_dari: payload.materi_lanjutan_dari || null,
        catatan: payload.catatan || null,
        urutan: Number(payload.urutan) || 0,
        aktif: payload.aktif,
      };

      if (payload.id) {
        const { error } = await supabase.from("schedules").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schedules").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Jadwal diperbarui" : "Jadwal ditambahkan");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setFormOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAktif = useMutation({
    mutationFn: async (row: ScheduleRow) => {
      const { error } = await supabase
        .from("schedules")
        .update({ aktif: !row.aktif })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status jadwal diubah");
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function bukaTambah() {
    setForm({ ...EMPTY_FORM, urutan: String((schedules.length + 1) * 10) });
    setFormOpen(true);
  }

  function bukaEdit(row: ScheduleRow) {
    setForm({
      id: row.id,
      training_day_id: row.training_day_id ?? "",
      material_id: row.material_id ?? "",
      nama_kegiatan: row.nama_kegiatan ?? "",
      jam_mulai: row.jam_mulai?.slice(0, 5) ?? "",
      jam_selesai: row.jam_selesai?.slice(0, 5) ?? "",
      kategori: row.kategori ?? "",
      kelas: row.kelas ?? "",
      materi_lanjutan_dari: row.materi_lanjutan_dari ?? "",
      catatan: row.catatan ?? "",
      urutan: String(row.urutan ?? 0),
      aktif: row.aktif,
    });
    setFormOpen(true);
  }

  return (
    <AppShell
      title="Master Jadwal"
      eyebrow="Data & Sistem"
      description="Kelola jadwal kegiatan training: hari, jam, materi, kelas, dan deteksi bentrok."
      actions={
        <button
          onClick={bukaTambah}
          className="inline-flex items-center gap-2 rounded-lg bg-sidebar-primary px-4 py-2 text-sm font-semibold text-sidebar-primary-foreground shadow hover:opacity-90"
        >
          <Plus className="size-4" />
          Tambah Jadwal
        </button>
      }
    >
      {/* Summary */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Jadwal" value={schedules.length} />
        <StatCard label="Aktif" value={totalAktif} tone="ok" />
        <StatCard label="Nonaktif" value={totalNonaktif} tone="muted" />
        <StatCard
          label="Potensi Bentrok"
          value={konflik.size}
          tone={konflik.size > 0 ? "warn" : "muted"}
        />
      </div>

      {/* Filter */}
      <Panel className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-55 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama kegiatan, kategori, kelas..."
              className="w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            value={filterHari}
            onChange={(e) => setFilterHari(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="semua">Semua Hari</option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>

          <select
            value={filterAktif}
            onChange={(e) => setFilterAktif(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="semua">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
      </Panel>

      {/* Tabel */}
      <Panel className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Memuat jadwal…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">
            Gagal memuat: {(error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Belum ada jadwal. Klik <b>Tambah Jadwal</b> untuk mulai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Urutan</th>
                  <th className="px-4 py-3">Hari</th>
                  <th className="px-4 py-3">Kegiatan / Materi</th>
                  <th className="px-4 py-3">Jam</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const isKonflik = konflik.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "hover:bg-accent/40",
                        isKonflik && "bg-destructive/5",
                      )}
                    >
                      <td className="px-4 py-3 tabular-nums">{r.urutan ?? 0}</td>
                      <td className="px-4 py-3">
                        {r.training_days?.nama ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.nama_kegiatan}</p>
                        {r.catatan && (
                          <p className="text-xs text-muted-foreground">
                            {r.catatan}
                          </p>
                        )}
                        {isKonflik && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            <TriangleAlert className="size-3" />
                            Bentrok jadwal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.jam_mulai?.slice(0, 5) ?? "—"} –{" "}
                        {r.jam_selesai?.slice(0, 5) ?? "—"}
                      </td>
                      <td className="px-4 py-3">{r.kelas ?? "—"}</td>
                      <td className="px-4 py-3">{r.kategori ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            r.aktif
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {r.aktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => bukaEdit(r)}
                            className="grid size-8 place-items-center rounded-lg hover:bg-accent"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => toggleAktif.mutate(r)}
                            className="grid size-8 place-items-center rounded-lg hover:bg-accent"
                            title={r.aktif ? "Nonaktifkan" : "Aktifkan"}
                          >
                            <Power
                              className={cn(
                                "size-4",
                                r.aktif ? "text-emerald-600" : "text-muted-foreground",
                              )}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Modal Form */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {form.id ? "Edit Jadwal" : "Tambah Jadwal"}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hari Training" required>
                <select
                  value={form.training_day_id}
                  onChange={(e) =>
                    setForm({ ...form, training_day_id: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Pilih hari —</option>
                  {days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nama}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Urutan">
                <input
                  type="number"
                  value={form.urutan}
                  onChange={(e) => setForm({ ...form, urutan: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Nama Kegiatan" required className="sm:col-span-2">
                <input
                  value={form.nama_kegiatan}
                  onChange={(e) =>
                    setForm({ ...form, nama_kegiatan: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Materi (Master)">
                <select
                  value={form.material_id}
                  onChange={(e) =>
                    setForm({ ...form, material_id: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Pilih materi —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kategori">
                <input
                  value={form.kategori}
                  onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Jam Mulai" required>
                <input
                  type="time"
                  value={form.jam_mulai}
                  onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Jam Selesai" required>
                <input
                  type="time"
                  value={form.jam_selesai}
                  onChange={(e) =>
                    setForm({ ...form, jam_selesai: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Kelas">
                <input
                  value={form.kelas}
                  onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                  placeholder="contoh: H1A"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Materi Lanjutan Dari">
                <input
                  value={form.materi_lanjutan_dari}
                  onChange={(e) =>
                    setForm({ ...form, materi_lanjutan_dari: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Catatan" className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Status" className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.aktif}
                    onChange={(e) =>
                      setForm({ ...form, aktif: e.target.checked })
                    }
                  />
                  Aktif (tampil di pilihan jadwal saat buat laporan)
                </label>
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Batal
              </button>
              <button
                onClick={() => simpan.mutate(form)}
                disabled={simpan.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {simpan.isPending ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "ok" | "warn" | "muted";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", toneClass)}>
        {value}
      </p>
    </Panel>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
