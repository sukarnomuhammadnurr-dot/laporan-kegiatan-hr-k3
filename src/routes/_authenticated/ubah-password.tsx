import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell, Panel } from "@/components/AppShell";
import { FormPasswordBaru, pesanErrorPassword } from "@/components/FormPasswordBaru";
import { useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ubah-password")({
  head: () => ({
    meta: [
      { title: "Ubah Password · Laporan Kegiatan Trainer K3 PT IWIP" },
      { name: "description", content: "Ganti password akun laporan Trainer K3." },
      { property: "og:title", content: "Ubah Password · Trainer K3" },
      { property: "og:description", content: "Ganti password akun Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UbahPassword,
});

function UbahPassword() {
  const navigate = useNavigate();
  const { session } = useSession();
  const wajib = !!session?.user.user_metadata?.["wajib_ganti_password"];

  return (
    <AppShell eyebrow="Akun" title="Ubah Password">
      <Panel className="max-w-md">
        {wajib && (
          <p className="mb-4 rounded-lg bg-status-waiting/15 px-3 py-2 text-sm">
            Anda masih memakai password sementara dari Admin. Silakan buat password baru.
          </p>
        )}
        <FormPasswordBaru
          withCurrent
          onSubmit={async (pw, cur) => {
            const { error } = await supabase.auth.updateUser({
              password: pw,
              current_password: cur,
              data: { wajib_ganti_password: false },
            } as Parameters<typeof supabase.auth.updateUser>[0]);
            if (error) return pesanErrorPassword(error.message);
            toast.success("Password berhasil diubah.");
            navigate({ to: "/dashboard" });
            return null;
          }}
        />
      </Panel>
    </AppShell>
  );
}
