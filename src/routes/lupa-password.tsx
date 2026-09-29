import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/lupa-password")({
  head: () => ({
    meta: [
      { title: "Lupa Password — Laporan Kegiatan Trainer K3 PT IWIP" },
      { name: "description", content: "Kirim link untuk mengatur ulang password akun laporan Trainer K3." },
      { property: "og:title", content: "Lupa Password — Trainer K3 PT IWIP" },
      { property: "og:description", content: "Atur ulang password akun Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LupaPassword,
});

function LupaPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setErr("Format email tidak valid.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error && error.message.toLowerCase().includes("rate limit")) {
      return setErr("Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.");
    }
    setTerkirim(true);
  }

  return (
    <AuthCard title="Lupa Password" subtitle="Masukkan email yang digunakan untuk akun Anda.">
      {terkirim ? (
        <p className="rounded-lg bg-status-verified/10 px-3 py-3 text-sm">
          Jika email terdaftar, link untuk mengatur ulang password telah dikirim.
        </p>
      ) : (
        <form onSubmit={kirim} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {err && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Mengirim…" : "Kirim Link Reset Password"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/masuk" className="font-medium text-primary underline-offset-4 hover:underline">Kembali ke halaman masuk</Link>
      </p>
    </AuthCard>
  );
}
