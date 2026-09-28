import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Laporan Kegiatan Trainer K3 — PT IWIP" },
      {
        name: "description",
        content:
          "Masuk untuk mencatat, memverifikasi, dan merekap kegiatan Trainer K3 PT IWIP.",
      },
      { property: "og:title", content: "Laporan Kegiatan Trainer K3 — PT IWIP" },
      {
        property: "og:description",
        content: "Sistem pencatatan kegiatan Trainer K3 PT IWIP.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/dashboard" : "/masuk", replace: true });
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="eyebrow text-primary">PT IWIP</p>
        <p className="mt-2 text-sm text-muted-foreground">Memuat sistem laporan K3…</p>
      </div>
    </div>
  );
}
