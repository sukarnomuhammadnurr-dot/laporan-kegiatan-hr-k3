import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileCheck2,
  ImageIcon,
  MessageCircle,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
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
import { fetchMaterials, fetchTrainers } from "@/lib/queries";
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

const NOMOR_WA_RESMI = "+62 819-3614-0126";
const PER_HALAMAN = 10;

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
  report_id: string | null;
  status: string | null;
  error_reason: string | null;
  raw_payload: unknown;
  created_at: string | null;
};

/* =========================================================
   HELPER BULAN
========================================================= */

function bulanIni() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function labelBulan(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function listBulan(startYear = 2026, endYear = 2040) {
  const result: string[] = [];
  for (let y = endYear; y >= startYear; y--) {
    for (let m = 12; m >= 1; m--) {
      result.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return result;
}

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
    s === "berhasil"
      ? {
          label: "Berhasil",
          className: "bg-status-verified/15 text-status-verified",
          dot: "bg-status-verified",
        }
      : s === "perlu_review"
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
          : s === "diproses"
            ? {
                label: "Diproses",
                className: "bg-primary/10 text-primary",
                dot: "bg-primary",
              }
            : {
                label: "Baru",
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

/* =========================================================
   PAGINATION COMPONENT
========================================================= */

function Pagination({
  halaman,
  totalHalaman,
  onPindah,
}: {
  halaman: number;
  totalHalaman: number;
  onPindah: (h: number) => void;
}) {
  if (totalHalaman <= 1) return null;

  const halamanList: (number | "...")[] = [];
  const maxTampil = 5;

  if (totalHalaman <= maxTampil) {
    for (let i = 1; i <= totalHalaman; i++) halamanList.push(i);
  } else {
    halamanList.push(1);

    const start = Math.max(2, halaman - 1);
    const end = Math.min(totalHalaman - 1, halaman + 1);

    if (start > 2) halamanList.push("...");
    for (let i = start; i <= end; i++) halamanList.push(i);
    if (end < totalHalaman - 1) halamanList.push("...");

    halamanList.push(totalHalaman);
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Halaman <strong>{halaman}</strong> dari <strong>{totalHalaman}</strong>
      </p>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          disabled={halaman <= 1}
          onClick={() => onPindah(halaman - 1)}
          title="Halaman sebelumnya"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {halamanList.map((h, i) =>
          h === "..." ? (
            <span
              key={`dots-${i}`}
              className="px-2 text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={h}
              size="sm"
              variant={h === halaman ? "default" : "outline"}
              onClick={() => onPindah(h)}
              className="min-w-9"
            >
              {h}
            </Button>
          ),
        )}

        <Button
          size="icon"
          variant="outline"
          disabled={halaman >= totalHalaman}
          onClick={() => onPindah(halaman + 1)}
          title="Halaman berikutnya"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function PesanWhatsAppPage() {
  const { isStaff, loading } = useCurrentUser();
  const qc = useQueryClient();

  const [cari, setCari] = useState("");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [bulan, setBulan] = useState<string>(bulanIni());
  const [halaman, setHalaman] = useState(1);
  const [detail, setDetail] = useState<WhatsAppMessage | null>(null);
  const [hapusTarget, setHapusTarget] = useState<WhatsAppMessage | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const daftarBulan = useMemo(() => listBulan(2026, 2040), []);

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
    data: result,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["whatsapp_messages", bulan, halaman],
    enabled: isStaff,
    queryFn: async () => {
      const [y, m] = bulan.split("-").map(Number);
      const start = `${bulan}-01`;
      const lastDay = new Date(y!, m!, 0).getDate();
      const end = `${bulan}-${String(lastDay).padStart(2, "0")}`;

      const from = (halaman - 1) * PER_HALAMAN;
      const to = from + PER_HALAMAN - 1;

      const { data, error, count } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact" })
        .gte("timestamp_pesan", start)
        .lte("timestamp_pesan", `${end}T23:59:59`)
        .order("timestamp_pesan", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        messages: (data ?? []) as WhatsAppMessage[],
        total: count ?? 0,
      };
    },
  });

  const messages = result?.messages ?? [];
  const totalPesan = result?.total ?? 0;
  const totalHalaman = Math.max(1, Math.ceil(totalPesan / PER_HALAMAN));

  // Reset halaman ke 1 kalau ganti bulan
  function gantiBulan(b: string) {
    setBulan(b);
    setHalaman(1);
  }

  function resetHalamanSaatFilter() {
    setHalaman(1);
  }

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
    const total = totalPesan;
    const berhasil = messages.filter((m) => m.status === "berhasil").length;
    const perluReview = messages.filter(
      (m) => m.status === "perlu_review",
    ).length;
    const gagal = messages.filter(
      (m) => m.status === "gagal" || m.status === "error",
    ).length;

    return { total, berhasil, perluReview, gagal };
  }, [messages, totalPesan]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    for (const m of messages) {
      if (m.status) values.add(m.status);
    }
    return [...values].sort();
  }, [messages]);

  const webhookUrl = `https://laporan-kegiatan-hr-k3.lovable.app/api/public/whatsapp/webhook`;

  function salinWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setWebhookCopied(true);
      toast.success("Webhook URL disalin.");
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  }

  /* =========================================================
     HAPUS PESAN
  ========================================================= */
  const hapusMutation = useMutation({
    mutationFn: async (msg: WhatsAppMessage) => {
      const { error } = await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("id", msg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesan berhasil dihapus.");
      qc.invalidateQueries({ queryKey: ["whatsapp_messages"] });
      setHapusTarget(null);
      setDetail(null);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Gagal menghapus pesan.");
    },
  });

  /* =========================================================
     PROSES MANUAL
  ========================================================= */
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
        throw new Error(`Data belum lengkap: ${valid.errors.join("; ")}`);
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
          created_by: trainerMatch.trainer!.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase
        .from("whatsapp_messages")
        .update({
          status: "berhasil",
          trainer_id: trainerMatch.trainer!.id,
          report_id: inserted?.id,
          error_reason: null,
        })
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
                Nomor: {NOMOR_WA_RESMI}
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
          description="Semua pesan bulan ini"
          icon={MessageCircle}
          tone="blue"
        />
        <StatCard
          title="Laporan Berhasil"
          value={stats.berhasil}
          description="Otomatis jadi laporan"
          icon={FileCheck2}
          tone="green"
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-4">
        <StatCard
          title="Perlu Review"
          value={stats.perluReview}
          description="Parser gagal — perbaiki manual"
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
                  {NOMOR_WA_RESMI}
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
                t: "Sistem auto-parse",
                d: "Parser otomatis baca pesan, cocokin trainer & materi.",
              },
              {
                t: "Auto jadi laporan",
                d: "Kalau match → langsung jadi laporan status 'Menunggu Verifikasi'.",
              },
              {
                t: "Verifikasi di halaman Laporan",
                d: "Staff/supervisor verifikasi di halaman Laporan. Kalau salah → perbaiki manual.",
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
{`Materi Apel Pagi
Trainer Sukarno M Nur
Kelas : 2A
jumlah peserta: 50
Hadir: 49
Tidak Hadir: 1
Tambahan: -`}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            Nomor WhatsApp pengirim otomatis terbaca. Materi auto-match ke Master Jadwal.
          </p>
        </Panel>
      </div>

      {/* TABEL PESAN */}
      <Panel className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Riwayat Pesan</p>
            <p className="text-xs text-muted-foreground">
              {totalPesan} pesan · {labelBulan(bulan)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Bulan */}
            <Select value={bulan} onValueChange={gantiBulan}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Pilih bulan" />
              </SelectTrigger>
              <SelectContent>
                {daftarBulan.map((b) => (
                  <SelectItem key={b} value={b}>
                    {labelBulan(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-56 pl-9"
                placeholder="Cari nomor / isi pesan…"
                value={cari}
                onChange={(e) => {
                  setCari(e.target.value);
                  resetHalamanSaatFilter();
                }}
              />
            </div>

            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v);
                resetHalamanSaatFilter();
              }}
            >
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
              {cari || filterStatus !== "semua"
                ? "Tidak ada pesan yang cocok dengan filter."
                : `Belum ada pesan di bulan ${labelBulan(bulan)}.`}
            </p>
          </div>
        ) : (
          <>
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
                        {m.error_reason ? (
                          <p className="mt-1 text-[11px] text-status-warning">
                            ⚠️ {m.error_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={m.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            title="Lihat detail"
                            onClick={() => setDetail(m)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            title="Hapus pesan"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setHapusTarget(m)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              halaman={halaman}
              totalHalaman={totalHalaman}
              onPindah={(h) => {
                setHalaman(h);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
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

      {/* MODAL KONFIRMASI HAPUS */}
      {hapusTarget ? (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setHapusTarget(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Hapus Pesan Ini?
              </DialogTitle>
              <DialogDescription>
                Pesan WhatsApp ini akan dihapus permanen dari riwayat.
                Laporan yang sudah ter-generate (kalau ada) tidak akan
                terhapus.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="num text-xs text-muted-foreground">
                {formatTanggalWaktu(hapusTarget.timestamp_pesan)} ·{" "}
                {hapusTarget.nomor_pengirim || "—"}
              </p>
              <p className="mt-1 line-clamp-3">
                {hapusTarget.pesan || hapusTarget.caption || "—"}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setHapusTarget(null)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={hapusMutation.isPending}
                onClick={() => hapusMutation.mutate(hapusTarget)}
              >
                <Trash2 className="mr-2 size-4" />
                {hapusMutation.isPending ? "Menghapus…" : "Ya, Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppShell>
  );
}

/* =========================================================
   MODAL DETAIL PESAN
========================================================= */

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

  const bisaProses = Boolean(
    parsed &&
      valid?.valid &&
      trainerMatch?.status === "matched" &&
      message.status !== "berhasil",
  );

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

          {message.error_reason ? (
            <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-status-warning">
                Alasan Perlu Review
              </p>
              <p className="mt-2 text-sm">{message.error_reason}</p>
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
                  <Row label="Kelas" value={parsed.kelas || "—"} />
                  <Row
                    label="Tanggal Kegiatan"
                    value={
                      parsed.tanggalKegiatan
                        ? new Date(
                            `${parsed.tanggalKegiatan}T00:00:00`,
                          ).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "⚠️ Otomatis (tanggal kirim WA)"
                    }
                  />
                  <Row
                    label="Jumlah Peserta"
                    value={String(parsed.jumlahPeserta ?? "—")}
                  />
                  <Row
                    label="Hadir"
                    value={String(parsed.jumlahHadir ?? "—")}
                  />
                  <Row
                    label="Tidak Hadir"
                    value={String(parsed.jumlahTidakHadir ?? "—")}
                  />
                  <Row
                    label="Tambahan"
                    value={String(parsed.jumlahTambahan)}
                  />
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
                    Ambigu:{" "}
                    {trainerMatch.candidates
                      .map((c) => c.nama_lengkap)
                      .join(", ")}
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
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3"
                    >
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
          {message.status !== "berhasil" ? (
            <Button
              onClick={onProses}
              disabled={processing || !bisaProses}
              title={
                !bisaProses
                  ? "Data belum lengkap atau trainer tidak match"
                  : "Proses manual jadi laporan"
              }
            >
              {processing ? "Memproses…" : "Proses jadi Laporan"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-status-verified/15 px-3 py-2 text-xs font-medium text-status-verified">
              <CheckCircle2 className="size-3.5" />
              Laporan sudah dibuat
            </span>
          )}
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
