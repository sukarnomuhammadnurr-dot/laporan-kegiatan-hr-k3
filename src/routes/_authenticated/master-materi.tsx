import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/master-materi")({
  head: () => ({
    meta: [
      {
        title: "Master Materi · Laporan Kegiatan Trainer K3 PT IWIP",
      },
      {
        name: "description",
        content: "Kelola master materi untuk laporan kegiatan trainer K3 PT IWIP.",
      },
    ],
  }),
  component: MasterMateri,
});

type Material = {
  id: string;
  nama: string;
  aktif: boolean;
  created_at?: string | null;
};

type FormState = {
  id?: string;
  nama: string;
  aktif: boolean;
};

const FORM_KOSONG: FormState = {
  nama: "",
  aktif: true,
};

function StatusPill({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        aktif
          ? "bg-status-verified/15 text-status-verified"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          aktif ? "bg-status-verified" : "bg-muted-foreground",
        )}
      />
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function MasterMateri() {
  const { isAdmin, isStaff, loading } = useCurrentUser();

  const qc = useQueryClient();

  const [cari, setCari] = useState("");
  const [filter, setFilter] = useState<"semua" | "aktif" | "nonaktif">(
    "semua",
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [ubahStatus, setUbahStatus] = useState<Material | null>(null);

  const {
    data: materials = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["materials", "master"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("nama", { ascending: true });

      if (error) throw error;

      return (data ?? []) as Material[];
    },
  });

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();

    return materials.filter((material) => {
      if (filter === "aktif" && !material.aktif) return false;
      if (filter === "nonaktif" && material.aktif) return false;

      if (!q) return true;

      return material.nama.toLowerCase().includes(q);
    });
  }, [materials, cari, filter]);

  const simpan = useMutation({
    mutationFn: async (data: FormState) => {
      const nama = data.nama.trim();

      if (!nama) {
        throw new Error("Nama materi wajib diisi.");
      }

      const duplicateQuery = supabase
        .from("materials")
        .select("id")
        .ilike("nama", nama);

      const { data: duplicate, error: duplicateError } =
        data.id
          ? await duplicateQuery.neq("id", data.id)
          : await duplicateQuery;

      if (duplicateError) throw duplicateError;

      if (duplicate && duplicate.length > 0) {
        throw new Error("Materi dengan nama tersebut sudah ada.");
      }

      const payload = {
        nama,
        aktif: data.aktif,
      };

      if (data.id) {
        const { error } = await supabase
          .from("materials")
          .update(payload)
          .eq("id", data.id);

        if (error) throw error;

        return "edit";
      }

      const { error } = await supabase
        .from("materials")
        .insert(payload);

      if (error) throw error;

      return "tambah";
    },

    onSuccess: (mode) => {
      toast.success(
        mode === "edit"
          ? "Materi berhasil diperbarui."
          : "Materi berhasil ditambahkan.",
      );

      qc.invalidateQueries({
        queryKey: ["materials"],
      });

      setForm(null);
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan materi.",
      );
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (material: Material) => {
      const { error } = await supabase
        .from("materials")
        .update({
          aktif: !material.aktif,
        })
        .eq("id", material.id);

      if (error) throw error;

      return !material.aktif;
    },

    onSuccess: (aktif) => {
      toast.success(
        aktif
          ? "Materi berhasil diaktifkan."
          : "Materi berhasil dinonaktifkan.",
      );

      qc.invalidateQueries({
        queryKey: ["materials"],
      });

      setUbahStatus(null);
    },

    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengubah status materi.",
      );
    },
  });

  if (!loading && !isStaff) {
    return (
      <AppShell title="Master Materi">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki akses ke halaman Master Materi.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Data & Sistem"
      title="Master Materi"
      actions={
        isAdmin ? (
          <Button
            size="lg"
            onClick={() => setForm({ ...FORM_KOSONG })}
          >
            + Tambah Materi
          </Button>
        ) : null
      }
    >
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Kelola daftar materi yang digunakan pada laporan kegiatan trainer.
        {!isAdmin && " Anda melihat dalam mode baca saja."}
      </p>

      {/* FILTER */}
      <Panel className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama materi..."
            className="sm:max-w-sm"
          />

          <div className="flex gap-1 rounded-lg bg-card/60 p-1 ring-1 ring-foreground/5">
            {(["semua", "aktif", "nonaktif"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === item
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item === "semua"
                  ? "Semua"
                  : item === "aktif"
                    ? "Aktif"
                    : "Nonaktif"}
              </button>
            ))}
          </div>

          <span className="eyebrow text-muted-foreground sm:ml-auto">
            {tampil.length} materi
          </span>
        </div>
      </Panel>

      {/* TABLE */}
      <Panel className="p-0 sm:p-0">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">
            Memuat data materi…
          </p>
        ) : isError ? (
          <p className="p-5 text-sm text-destructive">
            Gagal mengambil data materi.
          </p>
        ) : tampil.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium">Belum ada materi</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {cari
                ? "Tidak ada materi yang cocok dengan pencarian."
                : "Silakan tambahkan materi terlebih dahulu."}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["No", "Nama Materi", "Status", "Aksi"].map((header) => (
                      <th
                        key={header}
                        className="eyebrow px-4 py-3 font-medium text-muted-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {tampil.map((material, index) => (
                    <tr
                      key={material.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="num px-4 py-3 text-muted-foreground">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {material.nama}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill aktif={material.aktif} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {isAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setForm({
                                    id: material.id,
                                    nama: material.nama,
                                    aktif: material.aktif,
                                  })
                                }
                              >
                                Edit
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setUbahStatus(material)
                                }
                              >
                                {material.aktif
                                  ? "Nonaktifkan"
                                  : "Aktifkan"}
                              </Button>
                            </>
                          )}

                          {!isAdmin && (
                            <span className="text-xs text-muted-foreground">
                              Baca saja
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="divide-y divide-border md:hidden">
              {tampil.map((material, index) => (
                <div
                  key={material.id}
                  className="space-y-3 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        No. {index + 1}
                      </p>

                      <p className="mt-1 font-medium">
                        {material.nama}
                      </p>
                    </div>

                    <StatusPill aktif={material.aktif} />
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            id: material.id,
                            nama: material.nama,
                            aktif: material.aktif,
                          })
                        }
                      >
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setUbahStatus(material)
                        }
                      >
                        {material.aktif
                          ? "Nonaktifkan"
                          : "Aktifkan"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* FORM TAMBAH / EDIT */}
      {form && (
        <FormMateri
          initial={form}
          busy={simpan.isPending}
          onClose={() => setForm(null)}
          onSubmit={(data) => simpan.mutate(data)}
        />
      )}

      {/* KONFIRMASI STATUS */}
      <Dialog
        open={!!ubahStatus}
        onOpenChange={(open) => {
          if (!open) setUbahStatus(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ubahStatus?.aktif
                ? "Nonaktifkan materi?"
                : "Aktifkan materi?"}
            </DialogTitle>

            <DialogDescription>
              {ubahStatus?.aktif
                ? `Materi "${ubahStatus?.nama}" tidak akan muncul sebagai pilihan aktif pada form laporan.`
                : `Materi "${ubahStatus?.nama}" akan dapat digunakan kembali pada form laporan.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUbahStatus(null)}
            >
              Batal
            </Button>

            <Button
              disabled={toggleStatus.isPending}
              onClick={() =>
                ubahStatus && toggleStatus.mutate(ubahStatus)
              }
            >
              {toggleStatus.isPending
                ? "Memproses…"
                : ubahStatus?.aktif
                  ? "Nonaktifkan"
                  : "Aktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function FormMateri({
  initial,
  busy,
  onClose,
  onSubmit,
}: {
  initial: FormState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: FormState) => void;
}) {
  const [nama, setNama] = useState(initial.nama);
  const [aktif, setAktif] = useState(initial.aktif);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const namaBersih = nama.trim();

    if (!namaBersih) {
      setError("Nama materi wajib diisi.");
      return;
    }

    setError("");

    onSubmit({
      ...initial,
      nama: namaBersih,
      aktif,
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial.id ? "Edit Materi" : "Tambah Materi"}
          </DialogTitle>

          <DialogDescription>
            Nama materi akan digunakan sebagai pilihan pada form laporan
            kegiatan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nama-materi">
              Nama Materi
            </Label>

            <Input
              id="nama-materi"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Safety Riding"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={aktif ? "default" : "outline"}
                onClick={() => setAktif(true)}
              >
                Aktif
              </Button>

              <Button
                type="button"
                variant={!aktif ? "default" : "outline"}
                onClick={() => setAktif(false)}
              >
                Nonaktif
              </Button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Batal
            </Button>

            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Materi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
