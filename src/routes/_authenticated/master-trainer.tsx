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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser, type AppRole, type Trainer } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  buatAkunTrainer,
  setPasswordSementara,
  ubahStatusAkun,
} from "@/lib/trainer-accounts.functions";
import { formatTanggal } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/master-trainer")({
  head: () => ({
    meta: [
      { title: "Master Trainer · Laporan Kegiatan Trainer K3 PT IWIP" },
      {
        name: "description",
        content:
          "Kelola data trainer yang menggunakan sistem laporan kegiatan K3 PT IWIP.",
      },
      {
        property: "og:title",
        content: "Master Trainer · Laporan Kegiatan Trainer K3",
      },
      {
        property: "og:description",
        content: "Kelola data trainer K3 PT IWIP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MasterTrainer,
});

const ROLE_LABEL: Record<string, string> = {
  trainer: "Trainer",
  supervisor: "Supervisor",
  superintendent: "Superintendent",
  admin: "Admin",
};

type Filter = "semua" | "aktif" | "nonaktif";

type FormState = {
  id?: string;
  nomor_id_trainer: string;
  nama_lengkap: string;
  jabatan: string;
  email: string;
  nomor_whatsapp: string;
  role: AppRole;
  aktif: boolean;
};

const KOSONG: FormState = {
  nomor_id_trainer: "",
  nama_lengkap: "",
  jabatan: "",
  email: "",
  nomor_whatsapp: "",
  role: "trainer",
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

function AccountPill({ trainer }: { trainer: Trainer }) {
  if (!trainer.user_id) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Belum ada akun
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        trainer.akun_aktif === false
          ? "bg-muted text-muted-foreground"
          : "bg-status-verified/15 text-status-verified",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          trainer.akun_aktif === false
            ? "bg-muted-foreground"
            : "bg-status-verified",
        )}
      />
      {trainer.akun_aktif === false ? "Akun nonaktif" : "Akun aktif"}
    </span>
  );
}

function MasterTrainer() {
  const { isAdmin, isStaff, loading, user } = useCurrentUser();
  const qc = useQueryClient();

  const [cari, setCari] = useState("");
  const [filter, setFilter] = useState<Filter>("semua");
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<Trainer | null>(null);
  const [ubahStatus, setUbahStatus] = useState<Trainer | null>(null);
  const [akun, setAkun] = useState<Trainer | null>(null);
  const [resetAkun, setResetAkun] = useState<Trainer | null>(null);
  const [statusAkun, setStatusAkun] = useState<Trainer | null>(null);

  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ["trainers", "master"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainers")
        .select("*")
        .order("nama_lengkap");

      if (error) throw error;

      return data as Trainer[];
    },
  });

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();

    return trainers.filter((t) => {
      if (filter === "aktif" && !t.aktif) return false;
      if (filter === "nonaktif" && t.aktif) return false;

      if (!q) return true;

      return (
        t.nama_lengkap.toLowerCase().includes(q) ||
        t.nomor_id_trainer.toLowerCase().includes(q) ||
        (t.jabatan ?? "").toLowerCase().includes(q)
      );
    });
  }, [trainers, cari, filter]);

  const toggle = useMutation({
    mutationFn: async (t: Trainer) => {
      const { error } = await supabase
        .from("trainers")
        .update({ aktif: !t.aktif })
        .eq("id", t.id);

      if (error) throw error;

      return !t.aktif;
    },

    onSuccess: (aktif) => {
      toast.success(
        aktif ? "Trainer diaktifkan." : "Trainer dinonaktifkan.",
      );

      qc.invalidateQueries({ queryKey: ["trainers"] });
      setUbahStatus(null);
    },

    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Gagal mengubah status.",
      ),
  });

  const toggleAkun = useMutation({
    mutationFn: async (t: Trainer) => {
      await ubahStatusAkun({
        data: {
          trainerId: t.id,
          aktif: t.akun_aktif === false,
        },
      });

      return t.akun_aktif === false;
    },

    onSuccess: (aktif) => {
      toast.success(
        aktif
          ? "Akun trainer diaktifkan."
          : "Akun trainer dinonaktifkan.",
      );

      qc.invalidateQueries({ queryKey: ["trainers"] });
      setStatusAkun(null);
    },

    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Gagal mengubah status akun.",
      ),
  });

  if (!loading && !isStaff) {
    return (
      <AppShell title="Master Trainer">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki akses ke halaman ini. Master Trainer hanya
            dapat dikelola oleh Admin.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Data & Sistem"
      title="Master Trainer"
      actions={
        isAdmin ? (
          <Button size="lg" onClick={() => setForm({ ...KOSONG })}>
            + Tambah Trainer
          </Button>
        ) : null
      }
    >
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Kelola data trainer, jabatan, dan akun login yang digunakan untuk
        sistem laporan kegiatan.
        {!isAdmin && " Anda melihat dalam mode baca saja."}
      </p>

      <Panel className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama, ID, atau jabatan..."
            className="sm:max-w-sm"
          />

          <div className="flex gap-1 rounded-lg bg-card/60 p-1 ring-1 ring-foreground/5">
            {(["semua", "aktif", "nonaktif"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "semua"
                  ? "Semua"
                  : f === "aktif"
                    ? "Aktif"
                    : "Nonaktif"}
              </button>
            ))}
          </div>

          <span className="eyebrow text-muted-foreground sm:ml-auto">
            {tampil.length} trainer
          </span>
        </div>
      </Panel>

      <Panel className="p-0 sm:p-0">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">
            Memuat data trainer…
          </p>
        ) : tampil.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Tidak ada trainer yang cocok.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {[
                      "No",
                      "ID Trainer",
                      "Nama Lengkap",
                      "Role",
                      "Jabatan",
                      "Status",
                      "Akun",
                      "Email",
                      "Nomor WhatsApp",
                      "Aksi",
                    ].map((h) => (
                      <th
                        key={h}
                        className="eyebrow px-4 py-3 font-medium text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {tampil.map((t, i) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="num px-4 py-3 text-muted-foreground">
                        {i + 1}
                      </td>

                      <td className="num px-4 py-3">
                        {t.nomor_id_trainer}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {t.nama_lengkap}
                      </td>

                      <td className="px-4 py-3">
                        {ROLE_LABEL[t.role]}
                      </td>

                      <td className="px-4 py-3">
                        {t.jabatan || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill aktif={t.aktif} />
                      </td>

                      <td className="px-4 py-3">
                        <AccountPill trainer={t} />
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        {t.email || "—"}
                      </td>

                      <td className="num px-4 py-3 text-muted-foreground">
                        {t.nomor_whatsapp || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <Aksi
                          t={t}
                          isAdmin={isAdmin}
                          onDetail={setDetail}
                          onEdit={(x) => setForm(toForm(x))}
                          onToggle={setUbahStatus}
                          onAccount={setAkun}
                          onResetPassword={setResetAkun}
                          onToggleAccount={setStatusAkun}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {tampil.map((t) => (
                <div key={t.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{t.nama_lengkap}</p>

                      <p className="num text-xs text-muted-foreground">
                        {t.nomor_id_trainer} · {ROLE_LABEL[t.role]}
                      </p>

                      <p className="mt-0.5 text-xs font-medium text-foreground">
                        Jabatan: {t.jabatan || "Belum diisi"}
                      </p>
                    </div>

                    <StatusPill aktif={t.aktif} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <AccountPill trainer={t} />

                    <span className="text-xs text-muted-foreground">
                      {t.email || "Email belum diisi"}
                    </span>
                  </div>

                  <Aksi
                    t={t}
                    isAdmin={isAdmin}
                    onDetail={setDetail}
                    onEdit={(x) => setForm(toForm(x))}
                    onToggle={setUbahStatus}
                    onAccount={setAkun}
                    onResetPassword={setResetAkun}
                    onToggleAccount={setStatusAkun}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {form && (
        <FormTrainer
          initial={form}
          selfUserId={user?.id}
          trainerUserId={
            trainers.find((t) => t.id === form.id)?.user_id ?? null
          }
          onClose={() => setForm(null)}
        />
      )}

      {detail && (
        <DetailTrainer
          t={detail}
          onClose={() => setDetail(null)}
        />
      )}

      {akun && (
        <BuatAkunDialog
          trainer={akun}
          onClose={() => setAkun(null)}
        />
      )}

      {resetAkun && (
        <ResetPasswordDialog
          trainer={resetAkun}
          onClose={() => setResetAkun(null)}
        />
      )}

      <Dialog
        open={!!ubahStatus}
        onOpenChange={(o) => !o && setUbahStatus(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ubahStatus?.aktif
                ? "Nonaktifkan trainer?"
                : "Aktifkan trainer?"}
            </DialogTitle>

            <DialogDescription>
              {ubahStatus?.aktif
                ? `${ubahStatus?.nama_lengkap} tidak akan bisa membuat laporan baru. Laporan lama tetap tersimpan.`
                : `${ubahStatus?.nama_lengkap} akan dapat membuat laporan kembali.`}
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
              disabled={toggle.isPending}
              onClick={() =>
                ubahStatus && toggle.mutate(ubahStatus)
              }
            >
              {toggle.isPending
                ? "Memproses…"
                : ubahStatus?.aktif
                  ? "Nonaktifkan"
                  : "Aktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!statusAkun}
        onOpenChange={(o) => !o && setStatusAkun(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAkun?.akun_aktif === false
                ? "Aktifkan akun trainer?"
                : "Nonaktifkan akun trainer?"}
            </DialogTitle>

            <DialogDescription>
              {statusAkun?.akun_aktif === false
                ? `${statusAkun?.nama_lengkap} akan dapat login kembali menggunakan akun tersebut.`
                : `${statusAkun?.nama_lengkap} tidak dapat login sampai akun diaktifkan kembali.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusAkun(null)}
            >
              Batal
            </Button>

            <Button
              disabled={toggleAkun.isPending}
              onClick={() =>
                statusAkun && toggleAkun.mutate(statusAkun)
              }
            >
              {toggleAkun.isPending
                ? "Memproses…"
                : statusAkun?.akun_aktif === false
                  ? "Aktifkan Akun"
                  : "Nonaktifkan Akun"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function toForm(t: Trainer): FormState {
  return {
    id: t.id,
    nomor_id_trainer: t.nomor_id_trainer,
    nama_lengkap: t.nama_lengkap,
    jabatan: t.jabatan ?? "",
    email: t.email ?? "",
    nomor_whatsapp: t.nomor_whatsapp ?? "",
    role: t.role,
    aktif: t.aktif,
  };
}

function Aksi({
  t,
  isAdmin,
  onDetail,
  onEdit,
  onToggle,
  onAccount,
  onResetPassword,
  onToggleAccount,
}: {
  t: Trainer;
  isAdmin: boolean;
  onDetail: (t: Trainer) => void;
  onEdit: (t: Trainer) => void;
  onToggle: (t: Trainer) => void;
  onAccount: (t: Trainer) => void;
  onResetPassword: (t: Trainer) => void;
  onToggleAccount: (t: Trainer) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onDetail(t)}
      >
        Detail
      </Button>

      {isAdmin && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(t)}
          >
            Edit
          </Button>

          {!t.user_id ? (
            <Button
              size="sm"
              onClick={() => onAccount(t)}
            >
              Buat Akun
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResetPassword(t)}
              >
                Reset Password
              </Button>

              <Button
                size="sm"
                variant={
                  t.akun_aktif === false
                    ? "secondary"
                    : "ghost"
                }
                onClick={() => onToggleAccount(t)}
              >
                {t.akun_aktif === false
                  ? "Aktifkan Akun"
                  : "Nonaktifkan Akun"}
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant={t.aktif ? "ghost" : "secondary"}
            onClick={() => onToggle(t)}
          >
            {t.aktif ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </>
      )}
    </div>
  );
}

function buatPasswordSementara() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  const values = new Uint32Array(10);

  crypto.getRandomValues(values);

  return (
    Array.from(
      values,
      (n) => chars[n % chars.length],
    ).join("") + "!"
  );
}

function BuatAkunDialog({
  trainer,
  onClose,
}: {
  trainer: Trainer;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [email, setEmail] = useState(trainer.email ?? "");
  const [password, setPassword] = useState(
    buatPasswordSementara,
  );
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setErr(null);

    const cleanEmail = email.trim().toLowerCase();

    if (
      !cleanEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setErr("Email wajib diisi dengan format yang valid.");
      return;
    }

    if (password.length < 6) {
      setErr("Password sementara minimal 6 karakter.");
      return;
    }

    setBusy(true);

    try {
      await buatAkunTrainer({
        data: {
          trainerId: trainer.id,
          email: cleanEmail,
          password,
        },
      });

      toast.success("Akun trainer berhasil dibuat.");

      setHasil(true);

      qc.invalidateQueries({
        queryKey: ["trainers"],
      });
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Gagal membuat akun trainer.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Akun Trainer</DialogTitle>

          <DialogDescription>
            Buat akun login untuk{" "}
            <strong>{trainer.nama_lengkap}</strong>. Password
            sementara hanya ditampilkan di sini dan tidak
            disimpan oleh aplikasi sebagai teks biasa.
          </DialogDescription>
        </DialogHeader>

        {!hasil ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Trainer</Label>

              <Input
                value={trainer.nama_lengkap}
                disabled
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="akun-email">
                Email Login
              </Label>

              <Input
                id="akun-email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="akun-password">
                Password Sementara
              </Label>

              <div className="flex gap-2">
                <Input
                  id="akun-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="new-password"
                  className="font-mono"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPassword(buatPasswordSementara())
                  }
                >
                  Buat Baru
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Simpan/catat password ini untuk diberikan
                kepada trainer. Trainer sebaiknya langsung
                menggantinya setelah login.
              </p>
            </div>

            {err && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {err}
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

              <Button
                type="submit"
                disabled={busy}
              >
                {busy ? "Membuat Akun…" : "Buat Akun"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-status-verified/10 p-4 text-sm">
              <p className="font-semibold text-status-verified">
                Akun berhasil dibuat.
              </p>

              <p className="mt-1 text-muted-foreground">
                Berikan email dan password sementara berikut
                kepada trainer.
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Email
                </p>

                <p className="font-medium">{email}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Password sementara
                </p>

                <p className="break-all font-mono font-semibold">
                  {password}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Password ini tidak dapat dilihat kembali setelah
              dialog ditutup. Jika hilang, gunakan menu Reset
              Password.
            </p>

            <DialogFooter>
              <Button onClick={onClose}>
                Selesai
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  trainer,
  onClose,
}: {
  trainer: Trainer;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [password, setPassword] = useState(
    buatPasswordSementara,
  );
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setErr(null);

    if (password.length < 6) {
      setErr("Password sementara minimal 6 karakter.");
      return;
    }

    setBusy(true);

    try {
      await setPasswordSementara({
        data: {
          trainerId: trainer.id,
          password,
        },
      });

      toast.success(
        "Password sementara berhasil diatur ulang.",
      );

      setHasil(true);

      qc.invalidateQueries({
        queryKey: ["trainers"],
      });
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Gagal mengatur ulang password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reset Password Trainer
          </DialogTitle>

          <DialogDescription>
            Buat password sementara baru untuk{" "}
            <strong>{trainer.nama_lengkap}</strong>. Password
            lama tidak dapat dilihat oleh Admin.
          </DialogDescription>
        </DialogHeader>

        {!hasil ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Password Sementara Baru</Label>

              <div className="flex gap-2">
                <Input
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="new-password"
                  className="font-mono"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPassword(buatPasswordSementara())
                  }
                >
                  Buat Baru
                </Button>
              </div>
            </div>

            {err && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {err}
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

              <Button
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Mereset…"
                  : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-status-verified/10 p-4 text-sm">
              <p className="font-semibold text-status-verified">
                Password berhasil direset.
              </p>

              <p className="mt-1 text-muted-foreground">
                Berikan password sementara berikut kepada
                trainer.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">
                Password sementara baru
              </p>

              <p className="mt-1 break-all font-mono font-semibold">
                {password}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Password ini tidak dapat dilihat kembali setelah
              dialog ditutup.
            </p>

            <DialogFooter>
              <Button onClick={onClose}>
                Selesai
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormTrainer({
  initial,
  selfUserId,
  trainerUserId,
  onClose,
}: {
  initial: FormState;
  selfUserId?: string | undefined;
  trainerUserId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const edit = !!initial.id;

  const [f, setF] = useState<FormState>(initial);
  const [bukaId, setBukaId] = useState(!edit);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const akunSendiri =
    !!trainerUserId && trainerUserId === selfUserId;

  const set = <K extends keyof FormState>(
    k: K,
    v: FormState[K],
  ) => setF((p) => ({ ...p, [k]: v }));

  async function simpan(e: React.FormEvent) {
    e.preventDefault();

    setErr(null);

    const id = f.nomor_id_trainer.trim();
    const nama = f.nama_lengkap.trim();
    const jabatan = f.jabatan.trim();
    const email = f.email.trim().toLowerCase();
    const wa = f.nomor_whatsapp.replace(/[\s-]/g, "");

    if (!id) {
      return setErr("ID Trainer wajib diisi.");
    }

    if (!nama) {
      return setErr("Nama lengkap wajib diisi.");
    }

    if (!jabatan) {
      return setErr("Jabatan wajib diisi.");
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return setErr("Format email tidak valid.");
    }

    if (
      wa &&
      !/^(\+?62|0)8\d{7,12}$/.test(wa)
    ) {
      return setErr(
        "Nomor WhatsApp tidak valid. Contoh: 081234567890 atau +6281234567890.",
      );
    }

    if (
      ![
        "trainer",
        "supervisor",
        "superintendent",
        "admin",
      ].includes(f.role)
    ) {
      return setErr("Role tidak valid.");
    }

    setBusy(true);

    try {
      const { data: dupId } = await supabase
        .from("trainers")
        .select("id")
        .eq("nomor_id_trainer", id)
        .neq(
          "id",
          f.id ??
            "00000000-0000-0000-0000-000000000000",
        );

      if (dupId?.length) {
        throw new Error(
          "ID Trainer sudah digunakan.",
        );
      }

      if (email) {
        const { data: dupEmail } = await supabase
          .from("trainers")
          .select("id")
          .ilike("email", email)
          .neq(
            "id",
            f.id ??
              "00000000-0000-0000-0000-000000000000",
          );

        if (dupEmail?.length) {
          throw new Error(
            "Email sudah digunakan trainer lain.",
          );
        }
      }

      const payload = {
        nomor_id_trainer: id,
        nama_lengkap: nama,
        jabatan: (jabatan || null) as string,
        email: email || null,
        nomor_whatsapp: wa || null,
        role: f.role,
        aktif: f.aktif,
        status_trainer: f.aktif
          ? "Aktif"
          : "Nonaktif",
      };

      const { error } = edit
        ? await supabase
            .from("trainers")
            .update(payload)
            .eq("id", f.id!)
        : await supabase
            .from("trainers")
            .insert(payload);

      if (error) {
        if (error.code === "23505") {
          throw new Error(
            "ID Trainer atau email sudah digunakan.",
          );
        }

        throw error;
      }

      toast.success(
        edit
          ? "Data trainer berhasil diperbarui."
          : "Data trainer berhasil ditambahkan.",
      );

      qc.invalidateQueries({
        queryKey: ["trainers"],
      });

      onClose();
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Gagal menyimpan data.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {edit ? "Edit Trainer" : "Tambah Trainer"}
          </DialogTitle>

          <DialogDescription>
            Data trainer adalah identitas. Akun login dapat
            dibuat Admin setelah data trainer tersimpan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={simpan} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="idt">
              ID Trainer
            </Label>

            <div className="flex gap-2">
              <Input
                id="idt"
                value={f.nomor_id_trainer}
                disabled={!bukaId}
                onChange={(e) =>
                  set(
                    "nomor_id_trainer",
                    e.target.value,
                  )
                }
                className="num"
              />

              {edit && !bukaId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (
                      window.confirm(
                        "ID Trainer adalah identitas utama. Yakin ingin mengubahnya?",
                      )
                    ) {
                      setBukaId(true);
                    }
                  }}
                >
                  Ubah
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nm">
              Nama Lengkap
            </Label>

            <Input
              id="nm"
              value={f.nama_lengkap}
              onChange={(e) =>
                set("nama_lengkap", e.target.value)
              }
            />
          </div>

          {/* JABATAN */}
          <div className="space-y-1.5">
            <Label htmlFor="jabatan">
              Jabatan
            </Label>

            <Input
              id="jabatan"
              value={f.jabatan}
              onChange={(e) =>
                set("jabatan", e.target.value)
              }
              placeholder="Contoh: Wakil Supervisor"
            />

            <p className="text-xs text-muted-foreground">
              Isi jabatan aktual trainer di perusahaan,
              misalnya Wakil Supervisor, Senior Officer,
              atau Safety Trainer.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="em">
              Email{" "}
              <span className="text-muted-foreground">
                (opsional)
              </span>
            </Label>

            <Input
              id="em"
              type="email"
              value={f.email}
              onChange={(e) =>
                set("email", e.target.value)
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wa">
              Nomor WhatsApp{" "}
              <span className="text-muted-foreground">
                (opsional)
              </span>
            </Label>

            <Input
              id="wa"
              inputMode="tel"
              value={f.nomor_whatsapp}
              onChange={(e) =>
                set(
                  "nomor_whatsapp",
                  e.target.value,
                )
              }
              placeholder="081234567890"
              className="num"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role</Label>

              <Select
                value={f.role}
                onValueChange={(v) =>
                  set("role", v as AppRole)
                }
                disabled={akunSendiri}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="trainer">
                    Trainer
                  </SelectItem>

                  <SelectItem value="supervisor">
                    Supervisor
                  </SelectItem>

                  <SelectItem value="superintendent">
                    Superintendent
                  </SelectItem>

                  <SelectItem value="admin">
                    Admin
                  </SelectItem>
                </SelectContent>
              </Select>

              {akunSendiri && (
                <p className="text-xs text-muted-foreground">
                  Role akun Anda sendiri tidak dapat
                  diubah.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>

              <Select
                value={
                  f.aktif
                    ? "aktif"
                    : "nonaktif"
                }
                onValueChange={(v) =>
                  set(
                    "aktif",
                    v === "aktif",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="aktif">
                    Aktif
                  </SelectItem>

                  <SelectItem value="nonaktif">
                    Nonaktif
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {err && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {err}
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

            <Button
              type="submit"
              disabled={busy}
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailTrainer({
  t,
  onClose,
}: {
  t: Trainer;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["trainer-detail", t.id],

    queryFn: async () => {
      const { count } = await supabase
        .from("reports")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("trainer_id", t.id);

      const { data: last } = await supabase
        .from("reports")
        .select(
          "tanggal_kegiatan, materi",
        )
        .eq("trainer_id", t.id)
        .order("tanggal_kegiatan", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      return {
        count: count ?? 0,
        last,
      };
    },
  });

  const baris: [
    string,
    React.ReactNode,
  ][] = [
    ["Nama Lengkap", t.nama_lengkap],

    [
      "ID Trainer",
      <span className="num">
        {t.nomor_id_trainer}
      </span>,
    ],

    ["Role", ROLE_LABEL[t.role]],

    [
      "Jabatan",
      t.jabatan || "Belum diisi",
    ],

    [
      "Status Trainer",
      <StatusPill aktif={t.aktif} />,
    ],

    [
      "Status Akun",
      <AccountPill trainer={t} />,
    ],

    ["Email", t.email || "—"],

    [
      "Nomor WhatsApp",
      t.nomor_whatsapp || "—",
    ],

    [
      "Akun login",
      t.user_id
        ? "Tertaut"
        : "Belum punya akun",
    ],

    [
      "Tanggal dibuat",
      formatTanggal(
        t.created_at.slice(0, 10),
      ),
    ],

    [
      "Jumlah laporan",
      isLoading
        ? "…"
        : data?.count
          ? String(data.count)
          : "Belum ada laporan.",
    ],

    [
      "Laporan terakhir",
      isLoading
        ? "…"
        : data?.last
          ? `${formatTanggal(
              data.last.tanggal_kegiatan,
            )} · ${data.last.materi}`
          : "Belum ada laporan.",
    ],
  ];

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Detail Trainer
          </DialogTitle>
        </DialogHeader>

        <dl className="divide-y divide-border text-sm">
          {baris.map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between gap-4 py-2"
            >
              <dt className="text-muted-foreground">
                {k}
              </dt>

              <dd className="text-right font-medium">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
