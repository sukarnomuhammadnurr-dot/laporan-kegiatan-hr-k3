import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/masuk")({
  head: () => ({
    meta: [
      { title: "Masuk — Laporan Kegiatan Trainer K3 PT IWIP" },
      {
        name: "description",
        content: "Masuk ke sistem laporan kegiatan Trainer K3 PT IWIP.",
      },
      { property: "og:title", content: "Masuk — Laporan Kegiatan Trainer K3 PT IWIP" },
      { property: "og:description", content: "Halaman masuk trainer, admin, dan supervisor." },
    ],
  }),
  component: Masuk,
});

function Masuk() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nama, setNama] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "masuk") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nama_lengkap: nama },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else toast.success("Akun dibuat. Silakan cek email untuk konfirmasi.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses permintaan.");
    } finally {
      setBusy(false);
    }
  }

  async function masukGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Gagal masuk dengan Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 size-[460px] rounded-full bg-status-sent/25 blur-[120px]" />
        <div className="absolute -bottom-44 left-1/3 size-[420px] rounded-full bg-card/70 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="glass-strong rounded-2xl p-6 ring-1 ring-foreground/5 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="num grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              IW
            </div>
            <div>
              <p className="text-sm leading-tight font-semibold">Laporan Kegiatan Trainer K3</p>
              <p className="eyebrow text-muted-foreground">PT IWIP</p>
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-semibold">
            {mode === "masuk" ? "Masuk ke akun Anda" : "Buat akun baru"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gunakan email kantor Anda agar otomatis tertaut ke data trainer.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "daftar" && (
              <div className="space-y-1.5">
                <Label htmlFor="nama">Nama lengkap</Label>
                <Input
                  id="nama"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  required
                  placeholder="Nama sesuai data trainer"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Kata sandi</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "masuk" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Memproses…" : mode === "masuk" ? "Masuk" : "Daftar"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="eyebrow text-muted-foreground">atau</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" size="lg" className="w-full" onClick={masukGoogle}>
            Lanjutkan dengan Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "masuk" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "masuk" ? "daftar" : "masuk")}
            >
              {mode === "masuk" ? "Daftar" : "Masuk"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Akun pertama yang mendaftar otomatis menjadi Admin sistem.
        </p>
      </div>
    </div>
  );
}
