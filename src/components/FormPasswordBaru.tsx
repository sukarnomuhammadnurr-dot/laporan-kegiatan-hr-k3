import { useState } from "react";

import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Form password baru + konfirmasi. `withCurrent` menambah field password saat ini. */
export function FormPasswordBaru({
  withCurrent,
  onSubmit,
  label = "Simpan Password",
}: {
  withCurrent?: boolean;
  onSubmit: (pw: string, current?: string) => Promise<string | null>;
  label?: string;
}) {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [konf, setKonf] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (withCurrent && !cur) return setErr("Password saat ini wajib diisi.");
    if (!pw) return setErr("Password baru wajib diisi.");
    if (!konf) return setErr("Konfirmasi password wajib diisi.");
    if (pw.length < 6) return setErr("Password minimal 6 karakter.");
    if (pw !== konf) return setErr("Password dan konfirmasi tidak sama.");
    setBusy(true);
    const m = await onSubmit(pw, withCurrent ? cur : undefined);
    setBusy(false);
    if (m) setErr(m);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {withCurrent && (
        <div className="space-y-1.5">
          <Label htmlFor="cur">Password saat ini</Label>
          <PasswordInput id="cur" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pw">Password Baru</Label>
        <PasswordInput id="pw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="konf">Konfirmasi Password</Label>
        <PasswordInput id="konf" value={konf} onChange={(e) => setKonf(e.target.value)} autoComplete="new-password" />
      </div>
      {err && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Menyimpan…" : label}</Button>
    </form>
  );
}

export function pesanErrorPassword(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("current password") || m.includes("invalid credentials")) return "Password saat ini salah.";
  if (m.includes("different from the old") || m.includes("same")) return "Password baru harus berbeda dari password lama.";
  if (m.includes("weak") || m.includes("should be")) return "Password terlalu lemah. Gunakan minimal 6 karakter.";
  if (m.includes("session") || m.includes("expired")) return "Link sudah kedaluwarsa. Silakan minta link reset baru.";
  return "Gagal menyimpan password. Silakan coba lagi.";
}
