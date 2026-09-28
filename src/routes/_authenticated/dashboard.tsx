import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell, Panel } from "@/components/AppShell";
import { StatTile } from "@/components/StatTile";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrentUser } from "@/hooks/useAuth";
import { fetchReports } from "@/lib/queries";
import { formatTanggalPendek, hariIniISO, rentangJam } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Laporan Kegiatan Trainer K3 PT IWIP" },
      {
        name: "description",
        content:
          "Ringkasan laporan kegiatan trainer K3 PT IWIP: laporan hari ini, bulan ini, terverifikasi, dan yang perlu revisi.",
      },
      { property: "og:title", content: "Dashboard Laporan Kegiatan Trainer K3 PT IWIP" },
      {
        property: "og:description",
        content: "Pantau laporan kegiatan trainer K3 harian dan bulanan dalam satu tampilan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isStaff, nama, trainer } = useCurrentUser();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", "dashboard", trainer?.id ?? "semua", isStaff],
    queryFn: () => fetchReports(isStaff ? {} : { trainerId: trainer?.id ?? "" }),
    enabled: isStaff || Boolean(trainer?.id),
  });

  const hariIni = hariIniISO();
  const bulanIni = hariIni.slice(0, 7);

  const jumlahHariIni = reports.filter((r) => r.tanggal_kegiatan === hariIni).length;
  const jumlahBulanIni = reports.filter((r) => r.tanggal_kegiatan.startsWith(bulanIni)).length;
  const terverifikasi = reports.filter((r) => r.status_laporan === "terverifikasi").length;
  const perluRevisi = reports.filter((r) => r.status_laporan === "perlu_revisi").length;
  const menungguVerifikasi = reports.filter(
    (r) => r.status_laporan === "menunggu_verifikasi" || r.status_laporan === "terkirim",
  ).length;

  const terbaru = reports.slice(0, 8);

  return (
    <AppShell
      eyebrow={isStaff ? "Ringkasan Seluruh Trainer" : "Ringkasan Laporan Saya"}
      title={`Selamat datang, ${nama}`}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Laporan Hari Ini" value={jumlahHariIni} hint={formatTanggalPendek(hariIni)} />
        <StatTile label="Laporan Bulan Ini" value={jumlahBulanIni} />
        <StatTile label="Terverifikasi" value={terverifikasi} tone="verified" />
        <StatTile label="Menunggu Verifikasi" value={menungguVerifikasi} tone="review" />
        <StatTile label="Perlu Revisi" value={perluRevisi} tone="revision" />
      </div>

      <Panel className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Laporan Terbaru</h2>
          <span className="eyebrow text-muted-foreground">{reports.length} laporan</span>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Memuat data…</p>
        ) : terbaru.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada laporan tercatat.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {terbaru.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="num w-24 shrink-0 text-xs text-muted-foreground">
                  {formatTanggalPendek(r.tanggal_kegiatan)}
                </span>
                <span className="num w-28 shrink-0 text-xs text-muted-foreground">
                  {rentangJam(r.jam_mulai, r.jam_selesai)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.materi}</span>
                {isStaff && r.trainers ? (
                  <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">
                    {r.trainers.nama_lengkap}
                  </span>
                ) : null}
                <StatusBadge status={r.status_laporan} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="mt-4">
        <h2 className="text-sm font-semibold">Tahap pembangunan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Basis data, hak akses (trainer/admin/supervisor), data master trainer, materi, jenis
          kegiatan, dan jadwal Hari 1 / Hari 2 sudah tersimpan. Halaman lain pada menu masih
          bertanda “segera”.
        </p>
      </Panel>
    </AppShell>
  );
}
