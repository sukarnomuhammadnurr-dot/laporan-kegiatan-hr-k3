import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthCard } from "@/components/AuthCard";
import { FormPasswordBaru, pesanErrorPassword } from "@/components/FormPasswordBaru";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur Ulang Password — Laporan Kegiatan Trainer K3 PT IWIP" },
      { name: "description", content: "Buat password baru untuk akun laporan Trainer K3." },
      { property: "og:title", content: "Atur Ulang Password — Trainer K3 PT IWIP" },
      { property: "og:description", content: "Buat password baru untuk akun Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [siap, setSiap] = useState<boolean | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === "PASSWORD_RECOVERY" || s) setSiap(true);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      if (d.session) setSiap(true);
      else setTimeout(() => setSiap((v) => v ?? false), 2500);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthCard title="Atur Ulang Password" subtitle="Masukkan password baru untuk akun Anda.">
      {siap === null ? (
        <p className="text-sm text-muted-foreground">Memeriksa link…</p>
      ) : siap ? (
        <FormPasswordBaru
          onSubmit={async (pw) => {
            const { error } = await supabase.auth.updateUser({ password: pw, data: { wajib_ganti_password: false } });
            if (error) return pesanErrorPassword(error.message);
            await supabase.auth.signOut();
            toast.success("Password berhasil diperbarui. Silakan masuk dengan password baru.");
            navigate({ to: "/masuk", replace: true });
            return null;
          }}
        />
      ) : (
        <p className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
          Link tidak valid atau sudah kedaluwarsa.{" "}
          <Link to="/lupa-password" className="font-medium underline">Minta link baru</Link>
        </p>
      )}
    </AuthCard>
  );
}
