import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/useAuth";
import {
  fetchReports,
  fetchTrainers,
  type ReportWithTrainer,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/laporan")({
  head: () => ({
    meta: [
      {
        title: "Laporan Kegiatan · Laporan Trainer K3 PT IWIP",
      },
    ],
  }),
  component: LaporanPage,
});

type FilterStatus =
  | "semua"
  | "terkirim"
  | "menunggu_verifikasi"
  | "terverifikasi"
  | "perlu_revisi";

function formatTanggal(tanggal: string | null | undefined) {
  if (!tanggal) return "—";

  const d = new Date(`${tanggal}T00:00:00`);

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusPill({
  status,
}: {
  status: string | null | undefined;
}) {
  const label =
    status === "terverifikasi"
      ? "Terverifikasi"
      : status === "perlu_revisi"
        ? "Perlu Revisi"
        : status === "menunggu_verifikasi"
          ? "Menunggu Verifikasi"
          : status === "terkirim"
            ? "Terkirim"
            : status || "—";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        status === "terverifikasi" &&
          "bg-status-verified/15 text-status-verified",
        status === "perlu_revisi" &&
          "bg-destructive/10 text-destructive",
        status === "menunggu_verifikasi" &&
          "bg-status-warning/15 text-status-warning",
        status === "terkirim" &&
          "bg-primary/10 text-primary",
        ![
          "terverifikasi",
          "perlu_revisi",
          "menunggu_verifikasi",
          "terkirim",
        ].includes(status ?? "") &&
          "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function LaporanPage() {
  const { isStaff, isTrainer, trainer, loading } = useCurrentUser();

  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [trainerFilter, setTrainerFilter] = useState("semua");
  const [status, setStatus] = useState<FilterStatus>("semua");
  const [cari, setCari] = useState("");
  const [preview, setPreview] = useState<ReportWithTrainer | null>(null);

  const { data: trainers = [] } = useQuery({
    queryKey: ["trainers", "laporan-filter"],
    enabled: isStaff,
    queryFn: fetchTrainers,
  });

  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: [
      "reports",
      "laporan",
      trainer?.id,
      dari,
      sampai,
      trainerFilter,
      status,
      cari,
    ],
    enabled: !loading && (isStaff || isTrainer),
    queryFn: () =>
      fetchReports({
        trainerId:
          isTrainer && trainer
            ? trainer.id
            : trainerFilter !== "semua"
              ? trainerFilter
              : null,
        dari: dari || null,
        sampai: sampai || null,
        status: status !== "semua" ? status : null,
        cari: cari.trim() || null,
      }),
  });

  const tampil = useMemo(() => {
    return reports;
  }, [reports]);

  if (!loading && !isStaff && !isTrainer) {
    return (
      <AppShell title="Laporan">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki akses ke halaman laporan.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Laporan Kegiatan"
      title={isTrainer ? "Laporan Saya" : "Semua Laporan"}
    >
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        {isTrainer
          ? "Daftar seluruh laporan kegiatan yang Anda kirim."
          : "Daftar seluruh laporan kegiatan trainer."}
      </p>

      {/* FILTER */}
      <Panel className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Dari tanggal
            </p>
            <Input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Sampai tanggal
            </p>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </div>

          {!isTrainer && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Trainer
              </p>

              <Select
                value={trainerFilter}
                onValueChange={setTrainerFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua trainer" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="semua">
                    Semua Trainer
                  </SelectItem>

                  {trainers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nama_lengkap}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Status
            </p>

            <Select
              value={status}
              onValueChange={(v) =>
                setStatus(v as FilterStatus)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="semua">
                  Semua Status
                </SelectItem>
                <SelectItem value="terkirim">
                  Terkirim
                </SelectItem>
                <SelectItem value="menunggu_verifikasi">
                  Menunggu Verifikasi
                </SelectItem>
                <SelectItem value="terverifikasi">
                  Terverifikasi
                </SelectItem>
                <SelectItem value="perlu_revisi">
                  Perlu Revisi
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Cari
            </p>

            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Materi, kegiatan, kelas..."
            />
          </div>
        </div>
      </Panel>

      {/* HASIL */}
      <Panel className="p-0 sm:p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Daftar Laporan</p>
            <p className="text-xs text-muted-foreground">
              {tampil.length} laporan ditemukan
            </p>
          </div>

          {(dari || sampai || trainerFilter !== "semua" ||
            status !== "semua" || cari) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDari("");
                setSampai("");
                setTrainerFilter("semua");
                setStatus("semua");
                setCari("");
              }}
            >
              Reset Filter
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">
            Memuat laporan…
          </p>
        ) : isError ? (
          <p className="p-5 text-sm text-destructive">
            Gagal mengambil data laporan.
          </p>
        ) : tampil.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium">Belum ada laporan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tidak ada laporan yang sesuai dengan filter.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      No
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Tanggal
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Jam
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Trainer
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Materi
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Kelas
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Peserta
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Status
                    </th>
                    <th className="eyebrow px-4 py-3 text-muted-foreground">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tampil.map((r, index) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="num px-4 py-3 text-muted-foreground">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatTanggal(r.tanggal_kegiatan)}
                      </td>

                      <td className="num px-4 py-3 whitespace-nowrap">
                        {r.jam_mulai || "—"}
                        {r.jam_selesai
                          ? ` - ${r.jam_selesai}`
                          : ""}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.trainers?.nama_lengkap || "—"}
                      </td>

                      <td className="max-w-[280px] px-4 py-3">
                        <p className="font-medium">
                          {r.materi || "—"}
                        </p>

                        {r.jenis_kegiatan && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.jenis_kegiatan}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {r.kelas || "—"}
                      </td>

                      <td className="num px-4 py-3">
                        {r.jumlah_peserta ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill
                          status={r.status_laporan}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreview(r)}
                        >
                          Preview
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="divide-y divide-border md:hidden">
              {tampil.map((r, index) => (
                <div
                  key={r.id}
                  className="space-y-3 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        No. {index + 1}
                      </p>

                      <p className="mt-1 font-semibold">
                        {r.materi || "Tanpa materi"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {r.trainers?.nama_lengkap || "—"}
                      </p>
                    </div>

                    <StatusPill
                      status={r.status_laporan}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Tanggal
                      </p>
                      <p>
                        {formatTanggal(r.tanggal_kegiatan)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Jam
                      </p>
                      <p>
                        {r.jam_mulai || "—"}
                        {r.jam_selesai
                          ? ` - ${r.jam_selesai}`
                          : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Kelas
                      </p>
                      <p>{r.kelas || "—"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Peserta
                      </p>
                      <p>{r.jumlah_peserta ?? "—"}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreview(r)}
                  >
                    Preview Laporan
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* PREVIEW */}
      {preview && (
        <PreviewLaporan
          report={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </AppShell>
  );
}

function PreviewLaporan({
  report,
  onClose,
}: {
  report: ReportWithTrainer;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-8 max-w-3xl rounded-xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-lg font-semibold">
              Preview Laporan
            </p>
            <p className="text-xs text-muted-foreground">
              Periksa data sebelum digunakan untuk rekap/export.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onClose}
          >
            Tutup
          </Button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Info
              label="Tanggal Kegiatan"
              value={formatTanggal(report.tanggal_kegiatan)}
            />

            <Info
              label="Trainer"
              value={report.trainers?.nama_lengkap || "—"}
            />

            <Info
              label="Jam"
              value={`${report.jam_mulai || "—"}${
                report.jam_selesai
                  ? ` - ${report.jam_selesai}`
                  : ""
              }`}
            />

            <Info
              label="Kelas"
              value={report.kelas || "—"}
            />

            <Info
              label="Jenis Kegiatan"
              value={report.jenis_kegiatan || "—"}
            />

            <Info
              label="Lokasi"
              value={report.lokasi || "—"}
            />
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Materi / Kegiatan
            </p>

            <p className="mt-1 text-base font-semibold">
              {report.materi || "—"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Stat
              label="Peserta"
              value={report.jumlah_peserta}
            />

            <Stat
              label="Hadir"
              value={report.jumlah_hadir}
            />

            <Stat
              label="Tidak Hadir"
              value={report.jumlah_tidak_hadir}
            />

            <Stat
              label="Tambahan"
              value={report.tambahan}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Info
              label="Penanggung Jawab"
              value={report.penanggung_jawab || "—"}
            />

            <Info
              label="Status"
              value={report.status_laporan || "—"}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Keterangan
            </p>

            <div className="mt-1 rounded-lg border p-3 text-sm whitespace-pre-wrap">
              {report.keterangan || "—"}
            </div>
          </div>

          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="font-medium">
              Dokumentasi Foto
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Penyimpanan dan tampilan foto kita sambungkan pada
              tahap berikutnya.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium">
        {value === null || value === undefined || value === ""
          ? "—"
          : value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="num mt-1 text-lg font-semibold">
        {value ?? "—"}
      </p>
    </div>
  );
}
