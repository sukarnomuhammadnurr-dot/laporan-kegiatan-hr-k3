import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  FileCheck2,
  ImageIcon,
  Info,
  Link2,
  MessageCircle,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";

import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMaterials,
  fetchTrainers,
} from "@/lib/queries";
import {
  matchWhatsAppMaterials,
  matchWhatsAppTrainer,
  parseWhatsAppReport,
  validateParsedWhatsAppReport,
} from "@/lib/whatsapp-report-parser";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pesan-whatsapp")({
  head: () => ({
    meta: [
      { title: "Pesan WhatsApp · Laporan Kegiatan Trainer K3" },
      {
        name: "description",
        content:
          "Kelola integrasi WhatsApp untuk laporan kegiatan trainer K3.",
      },
    ],
  }),
  component: PesanWhatsAppPage,
});

type WhatsAppMessage = {
  id: string;
  message_id: string | null;
  nomor_pengirim: string | null;
  nama_pengirim: string | null;
  pesan: string | null;
  caption: string | null;
  media_url: string | null;
  media_storage_path: string | null;
  timestamp_pesan: string | null;
  trainer_id: string | null;
  status: string | null;
  raw_payload: unknown;
};

function formatTanggalWaktu(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: string | null }) {
  const s = status ?? "baru";
  const config =
    s === "berhasil" || s === "diproses"
      ? {
          label: s === "berhasil" ? "Berhasil" : "Diproses",
          className: "bg-status-verified/15 text-status-verified",
          dot: "bg-status-verified",
        }
      : s === "perlu_review" || s === "perlu_konfirmasi"
        ? {
            label: "Perlu Review",
            className: "bg-status-warning/15 text-status-warning",
            dot: "bg-status-warning",
          }
        : s === "gagal" || s === "error"
          ? {
              label: "Gagal",
              className: "bg-destructive/10 text-destructive",
              dot: "bg-destructive",
            }
          : {
              label: s,
              className: "bg-muted text-muted-foreground",
              dot: "bg-muted-foreground",
            };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        config.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof MessageCircle;
  tone: "blue" | "green" | "orange" | "red";
}) {
  const toneClass = {
    blue: { icon: "bg-primary/10 text-primary" },
    green: { icon: "bg-status-verified/15 text-status-verified" },
    orange: { icon: "bg-status-warning/15 text-status-warning" },
    red: { icon: "bg-destructive/10 text-destructive" },
  }[tone];

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="num mt-2 text-3xl font-bold">
            {value.toLocaleString("id-ID")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            toneClass.icon,
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </Panel>
  );
}

function PesanWhatsAppPage() {
  const { isStaff, isAdmin, loading } = useCurrentUser();
  const qc = useQueryClient();

  const [cari, setCari] = useState("");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [detail, setDetail] = useState<WhatsAppMessage | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const { data: trainers = [] } = useQuery({
    queryKey: ["trainers", "wa"],
    enabled: isStaff,
    queryFn: fetchTrainers,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", "wa"],
    enabled: isStaff,
    queryFn: fetchMaterials,
  });

  const {
    data: messages = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["whatsapp_messages"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("timestamp_pesan", { ascending: false })
        .limit(200);

      if (error) throw error;

      return (data ?? []) as WhatsAppMessage[];
    },
  });

  const filtered = useMemo(() => {
    const q = cari.trim().toLowerCase();

    return messages.filter((m) => {
      if (filterStatus !== "semua" && (m.status ?? "baru") !== filterStatus)
        return false;
      if (!q) return true;

      const hay = [m.nomor_pengirim, m.nama_pengirim, m.pesan, m.caption]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [messages, cari, filterStatus]);

  const stats = useMemo(() => {
    const total = messages.length;
    const diproses = messages.filter(
      (m) => m.status === "diproses" || m.status === "berhasil",
    ).length;
    const perluReview = messages.filter(
      (m) => m.status === "perlu_review" || m.status === "perlu_konfirmasi",
    ).length;
    const gagal = messages.filter(
      (m) => m.status === "gagal" || m.status === "error",
    ).length;

    return { total, diproses, perluReview, gagal };
  }, [messages]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    for (const m of messages) {
      if (m.status) values.add(m.status);
    }
    return [...values].sort();
  }, [messages]);

  const webhookUrl = `https://kpapxeicbdnbmjylulcc.supabase.co/functions/v1/whatsapp-webhook`;

  function salinWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setWebhookCopied(true);
      toast.success("Webhook URL disalin.");
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  }

  const prosesJadiLaporan = useMutation({
    mutationFn: async (msg: WhatsAppMessage) => {
      if (!msg.pesan) throw new Error("Pesan kosong, tidak bisa diproses.");

      const parsed = parseWhatsAppReport(msg.pesan);
      const valid = validateParsedWhatsAppReport(parsed);

      const trainerMatch = matchWhatsAppTrainer(
        parsed.trainerNama,
        msg.nomor_pengirim,
        trainers.map((t) => ({
          id: t.id,
          nama_lengkap: t.nama_lengkap,
          nomor_whatsapp: t.nomor_whatsapp,
        })),
      );

      const materialMatches = matchWhatsAppMaterials(
        parsed.materi,
        materials.map((m) => ({
          id: m.id,
          nama: m.nama,
          aktif: m.aktif ?? true,
        })),
      );

      if (trainerMatch.status !== "matched") {
        throw new Error(
          trainerMatch.status === "ambiguous"
            ? "Trainer ambigu — perlu konfirmasi manual."
            : "Trainer tidak ditemukan di Master Trainer.",
        );
      }

      if (!valid.valid) {
        throw new Error(
          `Data belum lengkap: ${valid.errors.join("; ")}`,
        );
      }

      const tanggal = msg.timestamp_pesan
        ? msg.timestamp_pesan.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const materiGabungan = parsed.materi.join(", ");

      const materialId =
        materialMatches.length === 1 &&
        materialMatches[0]?.status === "matched" &&
        materialMatches[0]?.material
          ? materialMatches[0].material.id
          : null;

      const { data: inserted, error } = await supabase
        .from("reports")
        .insert({
          trainer_id: trainerMatch.trainer!.id,
          tanggal_kegiatan: tanggal,
          materi: materiGabungan,
          material_id: materialId,
          jumlah_peserta: parsed.jumlahPeserta ?? 0,
          jumlah_hadir: parsed.jumlahHadir ?? 0,
          jumlah_tidak_hadir: parsed.jumlahTidakHadir ?? 0,
          jumlah_tambahan: parsed.jumlahTambahan ?? 0,
          keterangan: msg.caption || null,
          sumber_laporan: "whatsapp",
          status_laporan: "menunggu_verifikasi",
          waktu_laporan_dikirim: msg.timestamp_pesan,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase
        .from("whatsapp_messages")
        .update({ status: "berhasil", trainer_id: trainerMatch.trainer!.id })
        .eq("id", msg.id);

      return inserted?.id;
    },
    onSuccess: () => {
      toast.success("Laporan berhasil dibuat dari pesan WhatsApp.");
      qc.invalidateQueries({ queryKey: ["whatsapp_messages"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      setDetail(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <AppShell title="Pesan WhatsApp" eyebrow="Data & Sistem">
        <Panel>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Memuat…
          </p>
        </Panel>
      </AppShell>
    );
  }

  if (!isStaff) {
    return (
      <AppShell title="Pesan WhatsApp">
        <Panel>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki akses ke halaman ini.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Pesan WhatsApp"
      eyebrow="Data & Sistem"
      description="Kelola integrasi dan pengaturan pesan WhatsApp untuk laporan training."
    >
      {/* STATUS + STATS */}
      <div className="mb-5 grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-status-verified/15 text-status-verified">
              <MessageCircle className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Status WhatsApp</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-verified/15 px-2 py-0.5 text-[11px] font-semibold text-status-verified">
                  <span className="size-1.5 rounded-full bg-status-verified" />
                  Terhubung
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Nomor: +62 812 3456 7890
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => toast.info("Cek koneksi API WhatsApp belum aktif.")}
              >
                <RefreshCcw className="mr-2 size-3.5" />
                Cek Koneksi
              </Button>
            </div>
          </div>
        </Panel>

        <StatCard
          title="Total Pesan Masuk"
          value={stats.total}
          description="Semua pesan"
          icon={MessageCircle}
          tone="blue"
        />
        <StatCard
          title="Laporan Diproses"
          value={stats.diproses}
          description="Berhasil diproses"
          icon={FileCheck2}
          tone="green"
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-4">
        <StatCard
          title="Perlu Review"
          value={stats.perluReview}
          description="Menunggu konfirmasi"
          icon={AlertTriangle}
          tone="orange"
        />
        <StatCard
          title="Gagal"
          value={stats.gagal}
          description="Gagal diproses"
          icon={WifiOff}
          tone="red"
        />

        {/* KONFIGURASI */}
        <Panel className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            <p className="font-semibold">Konfigurasi WhatsApp</p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Nomor WhatsApp (Business)
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  +62 812 3456 7890
                </code>
                <span className="inline-flex items-center gap-1 rounded-full bg-status-verified/15 px-2 py-0.5 text-[11px] font-semibold text-status-verified">
                  Aktif
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Mode Integrasi
              </p>
              <div className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                WhatsApp Business API
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Webhook URL
              </p>
              <div className="mt-1 flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  {webhookUrl}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={salinWebhook}
                  title="Salin"
                >
                  {webhookCopied ? (
                    <CheckCircle2 className="size-4 text-status-verified" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* 4 KARTU AKSI */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          icon={Send}
          title="Test Pesan"
          description="Kirim pesan tes untuk memastikan koneksi berfungsi dengan baik."
          buttonLabel="Kirim Test"
          tone="blue"
          onClick={() => toast.info("Fitur test pesan belum aktif.")}
        />
        <ActionCard
          icon={Settings2}
          title="Pengaturan Parser"
          description="Atur format dan pola pesan yang akan diparse dari WhatsApp."
          buttonLabel="Kelola Parser"
          tone="green"
          onClick={() => toast.info("Pengaturan parser belum tersedia.")}
        />
        <ActionCard
          icon={ImageIcon}
          title="Dokumentasi Foto"
          description="Konfigurasi penerimaan foto dokumentasi dari WhatsApp."
          buttonLabel="Kelola Foto"
          tone="purple"
          onClick={() => toast.info("Pengaturan foto belum tersedia.")}
        />
        <ActionCard
          icon={Info}
          title="Panduan Penggunaan"
          description="Lihat panduan lengkap cara penggunaan fitur WhatsApp."
          buttonLabel="Lihat Panduan"
          tone="teal"
          onClick={() => setDetail(null)}
        />
      </div>

      {/* CARA KERJA + TIPS */}
      <div className="mb-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="font-semibold">Cara Kerja</p>
          </div>
          <ol className="space-y-4">
            {[
              {
                t: "Trainer mengirim laporan",
                d: "Melalui WhatsApp dengan format yang sudah ditentukan.",
              },
              {
                t: "Sistem memproses pesan",
                d: "Parser membaca dan mengekstrak data dari pesan WhatsApp.",
              },
              {
                t: "Cocokkan dengan Master Data",
                d: "Nomor WA → Master Trainer. Nama Materi → Master Materi.",
              },
              {
                t: "Data tersimpan",
                d: "Laporan otomatis tersimpan ke sistem dengan status berhasil / perlu review.",
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{s.t}</p>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <Wifi className="size-4 text-primary" />
            <p className="font-semibold">Tips Format Pesan</p>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed">
{`Materi K3 H1A, PERATURAN PERUSAHAAN,
Trainer Sufri Hi Rajak
Jumlah peserta: 34
Hadir: 32
Tidak Hadir: 2
Tambahan: -`}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            Nomor WhatsApp pengirim otomatis terbaca. Nama trainer dipakai sebagai fallback.
          </p>
        </Panel>
      </div>

      {/* TABEL PESAN */}
      <Panel className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Pesan Terbaru</p>
            <p className="text-xs text-muted-foreground">
              {filtered.length} dari {messages.length} pesan
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-56 pl-9"
                placeholder="Cari nomor / isi pesan…"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Status</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" onClick={() => refetch()}>
              <RefreshCcw className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Memuat pesan…
          </p>
        ) : isError ? (
          <p className="p-10 text-center text-sm text-destructive">
            Gagal memuat pesan WhatsApp.
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-4 font-semibold">Belum ada pesan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pesan WhatsApp yang masuk akan tampil di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-left">
                <tr className="border-b border-border">
                  <th className="eyebrow px-4 py-3 text-muted-foreground">
                    Tanggal & Waktu
                  </th>
                  <th className="eyebrow px-4 py-3 text-muted-foreground">
                    Pengirim
                  </th>
                  <th className="eyebrow px-4 py-3 text-muted-foreground">
                    Isi Pesan
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
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/60 hover:bg-muted/20"
                  >
                    <td className="num whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatTanggalWaktu(m.timestamp_pesan)}
                    </td>
                    <td className="num px-4 py-3">
                      {m.nomor_pengirim || m.nama_pengirim || "—"}
                    </td>
                    <td className="max-w-[420px] px-4 py-3">
                      <p className="line-clamp-2 text-sm">
                        {m.pesan || m.caption || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={m.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetail(m)}
                      >
                        <Eye className="mr-1.5 size-3.5" />
                        Lihat
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* MODAL DETAIL */}
      {detail ? (
        <DetailPesanModal
          message={detail}
          trainers={trainers.map((t) => ({
            id: t.id,
            nama_lengkap: t.nama_lengkap,
            nomor_whatsapp: t.nomor_whatsapp,
          }))}
          materials={materials.map((m) => ({
            id: m.id,
            nama: m.nama,
            aktif: m.aktif ?? true,
          }))}
          onClose={() => setDetail(null)}
          onProses={() => prosesJadiLaporan.mutate(detail)}
          processing={prosesJadiLaporan.isPending}
        />
      ) : null}
    </AppShell>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  tone,
  onClick,
}: {
  icon: typeof Send;
  title: string;
  description: string;
  buttonLabel: string;
  tone: "blue" | "green" | "purple" | "teal";
  onClick: () => void;
}) {
  const toneClass = {
    blue: "bg-primary/10 text-primary",
    green: "bg-status-verified/15 text-status-verified",
    purple: "bg-purple-500/10 text-purple-600",
    teal: "bg-teal-500/10 text-teal-600",
  }[tone];

  const btnClass = {
    blue: "bg-primary text-primary-foreground hover:opacity-90",
    green: "bg-status-verified text-white hover:opacity-90",
    purple: "bg-purple-600 text-white hover:opacity-90",
    teal: "bg-teal-600 text-white hover:opacity-90",
  }[tone];

  return (
    <Panel>
      <div
        className={cn(
          "mb-3 flex size-10 items-center justify-center rounded-xl",
          toneClass,
        )}
      >
        <Icon className="size-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Button size="sm" className={cn("mt-4 w-full", btnClass)} onClick={onClick}>
        {buttonLabel}
      </Button>
    </Panel>
  );
}

function DetailPesanModal({
  message,
  trainers,
  materials,
  onClose,
  onProses,
  processing,
}: {
  message: WhatsAppMessage;
  trainers: { id: string; nama_lengkap: string; nomor_whatsapp: string | null }[];
  materials: { id: string; nama: string; aktif?: boolean }[];
  onClose: () => void;
  onProses: () => void;
  processing: boolean;
}) {
  const parsed = useMemo(
    () => (message.pesan ? parseWhatsAppReport(message.pesan) : null),
    [message.pesan],
  );

  const valid = useMemo(
    () => (parsed ? validateParsedWhatsAppReport(parsed) : null),
    [parsed],
  );

  const trainerMatch = useMemo(() => {
    if (!parsed) return null;
    return matchWhatsAppTrainer(
      parsed.trainerNama,
      message.nomor_pengirim,
      trainers,
    );
  }, [parsed, message.nomor_pengirim, trainers]);

  const materialMatches = useMemo(() => {
    if (!parsed) return [];
    return matchWhatsAppMaterials(parsed.materi, materials);
  }, [parsed, materials]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Pesan WhatsApp</DialogTitle>
          <DialogDescription>
            {formatTanggalWaktu(message.timestamp_pesan)} ·{" "}
            {message.nomor_pengirim || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pesan Mentah
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-sm">
              {message.pesan || "—"}
            </pre>
            {message.caption ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Caption: {message.caption}
              </p>
            ) : null}
          </div>

          {message.media_url ? (
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Media
                </p>
              </div>
              <img
                src={message.media_url}
                alt="Media WhatsApp"
                className="max-h-64 rounded-lg object-contain"
              />
            </div>
          ) : null}

          {parsed ? (
            <>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hasil Parser
                </p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Row label="Trainer" value={parsed.trainerNama || "—"} />
                  <Row label="Materi" value={parsed.materi.join(", ") || "—"} />
                  <Row label="Jumlah Peserta" value={String(parsed.jumlahPeserta ?? "—")} />
                  <Row label="Hadir" value={String(parsed.jumlahHadir ?? "—")} />
                  <Row label="Tidak Hadir" value={String(parsed.jumlahTidakHadir ?? "—")} />
                  <Row label="Tambahan" value={String(parsed.jumlahTambahan)} />
                </dl>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Matching Trainer
                </p>
                {trainerMatch?.status === "matched" ? (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-status-verified">
                    <CheckCircle2 className="size-4" />
                    {trainerMatch.trainer?.nama_lengkap} (via{" "}
                    {trainerMatch.matchedBy === "nomor_whatsapp"
                      ? "nomor WA"
                      : "nama"}
                    )
                  </p>
                ) : trainerMatch?.status === "ambiguous" ? (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-status-warning">
                    <AlertTriangle className="size-4" />
                    Ambigu: {trainerMatch.candidates.map((c) => c.nama_lengkap).join(", ")}
                  </p>
                ) : (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="size-4" />
                    Trainer tidak ditemukan
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Matching Materi
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {materialMatches.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="truncate">{m.input}</span>
                      {m.status === "matched" ? (
                        <span className="inline-flex items-center gap-1 text-status-verified">
                          <CheckCircle2 className="size-3.5" />
                          {m.material?.nama}
                        </span>
                      ) : m.status === "ambiguous" ? (
                        <span className="inline-flex items-center gap-1 text-status-warning">
                          <AlertTriangle className="size-3.5" />
                          Ambigu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          Tidak cocok
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {valid && !valid.valid ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    Perlu Perhatian
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-destructive">
                    {valid.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          <Button
            onClick={onProses}
            disabled={
              processing ||
              !parsed ||
              !valid?.valid ||
              trainerMatch?.status !== "matched"
            }
          >
            {processing ? "Memproses…" : "Proses jadi Laporan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-background/60 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
