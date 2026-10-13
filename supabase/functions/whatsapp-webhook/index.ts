import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  matchWhatsAppMaterials,
  matchWhatsAppSchedule,
  matchWhatsAppTrainer,
  parseWhatsAppReport,
  validateParsedWhatsAppReport,
} from "./parser.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_VERIFY_TOKEN =
  Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "iwip-k3-verify";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/* =========================================================
   HELPER: TENTUKAN LOKASI
========================================================= */
function tentukanLokasi(namaKegiatan: string): string {
  const LUAR_RUANGAN = ["APEL", "APD"];
  const upper = namaKegiatan.toUpperCase();
  return LUAR_RUANGAN.some((k) => upper.includes(k))
    ? "Luar Ruangan"
    : "Dalam Ruangan";
}

/* =========================================================
   SERVE
========================================================= */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ============================================
  // 1) VERIFIKASI WEBHOOK (GET)
  // ============================================
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified");
      return new Response(challenge ?? "", {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ============================================
  // 2) TERIMA PESAN (POST)
  // ============================================
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Webhook payload:", JSON.stringify(body));

      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value) {
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      const messages = value.messages ?? [];
      const contacts = value.contacts ?? [];

      for (const msg of messages) {
        const from = msg.from;
        const msgId = msg.id;
        const timestamp = msg.timestamp;

        const contact = contacts.find((c: any) => c.wa_id === from);
        const namaPengirim = contact?.profile?.name ?? null;

        let pesan: string | null = null;
        let caption: string | null = null;
        let mediaUrl: string | null = null;
        let mediaId: string | null = null;
        let fileName: string | null = null;

        if (msg.type === "text") {
          pesan = msg.text?.body ?? null;
        } else if (msg.type === "image" || msg.type === "document") {
          const media = msg.image ?? msg.document;
          caption = media?.caption ?? null;
          mediaId = media?.id ?? null;
          fileName = media?.filename ?? null;

          if (mediaId && WHATSAPP_ACCESS_TOKEN) {
            try {
              const mediaRes = await fetch(
                `https://graph.facebook.com/v21.0/${mediaId}`,
                {
                  headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                  },
                },
              );
              const mediaData = await mediaRes.json();
              mediaUrl = mediaData?.url ?? null;
            } catch (e) {
              console.error("Gagal ambil media URL:", e);
            }
          }
        } else if (msg.type === "button") {
          pesan = msg.button?.text ?? null;
        } else if (msg.type === "interactive") {
          pesan =
            msg.interactive?.button_reply?.title ??
            msg.interactive?.list_reply?.title ??
            null;
        }

        const pesanLengkap =
          [pesan, caption].filter(Boolean).join("\n") || null;

        // ============================================
        // CEK DUPLIKAT
        // ============================================
        const { data: existing } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("message_id", msgId)
          .maybeSingle();

        if (existing) {
          console.log("Pesan dobel diabaikan:", msgId);
          continue;
        }

        // ============================================
        // INSERT KE whatsapp_messages
        // ============================================
        const { data: insertedMsg, error: insertErr } = await supabase
          .from("whatsapp_messages")
          .insert({
            message_id: msgId,
            nomor_pengirim: from,
            nama_pengirim: namaPengirim,
            pesan: pesanLengkap,
            caption,
            media_url: mediaUrl,
            media_storage_path: null,
            timestamp_pesan: timestamp
              ? new Date(Number(timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            status: "baru",
            raw_payload: msg,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("Insert error:", insertErr);
          continue;
        }

        console.log("Pesan tersimpan:", insertedMsg?.id);

        // ============================================
        // AUTO-PARSE + AUTO-INSERT KE REPORTS
        // ============================================
        if (pesanLengkap) {
          await prosesPesanJadiLaporan({
            messageId: insertedMsg!.id,
            pesanLengkap,
            nomorPengirim: from,
            timestampPesan: timestamp
              ? new Date(Number(timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            caption,
            mediaUrl,
            mediaId,
            fileName,
          });
        }
      }

      return new Response("ok", { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});

/* =========================================================
   AUTO-PARSE + INSERT KE REPORTS
========================================================= */
async function prosesPesanJadiLaporan(opts: {
  messageId: string;
  pesanLengkap: string;
  nomorPengirim: string;
  timestampPesan: string;
  caption: string | null;
  mediaUrl: string | null;
  mediaId: string | null;
  fileName: string | null;
}) {
  const {
    messageId,
    pesanLengkap,
    nomorPengirim,
    timestampPesan,
    caption,
    mediaUrl,
    mediaId,
    fileName,
  } = opts;

  try {
    // 1. Ambil trainers + materials + schedules
    const [trainersRes, materialsRes, schedulesRes] = await Promise.all([
      supabase.from("trainers").select("id, nama_lengkap, nomor_whatsapp, aktif"),
      supabase.from("materials").select("id, nama, aktif"),
      supabase
        .from("schedules")
        .select(
          "id, nama_kegiatan, jam_mulai, jam_selesai, kelas, kategori, material_id, training_day_id, aktif",
        ),
    ]);

    if (trainersRes.error) throw trainersRes.error;
    if (materialsRes.error) throw materialsRes.error;
    if (schedulesRes.error) throw schedulesRes.error;

    const trainers = trainersRes.data ?? [];
    const materials = materialsRes.data ?? [];
    const schedules = schedulesRes.data ?? [];

    // 2. Parse pesan
    const parsed = parseWhatsAppReport(pesanLengkap);
    const valid = validateParsedWhatsAppReport(parsed);

    // 3. Match trainer
    const trainerMatch = matchWhatsAppTrainer(
      parsed.trainerNama,
      nomorPengirim,
      trainers,
    );

    // 4. Kalau trainer gak match → perlu_review
    if (trainerMatch.status !== "matched") {
      const reason =
        trainerMatch.status === "ambiguous"
          ? "Trainer ambigu — perlu konfirmasi manual."
          : "Trainer tidak ditemukan di Master Trainer.";

      await supabase
        .from("whatsapp_messages")
        .update({
          status: "perlu_review",
          error_reason: reason,
          trainer_id: null,
        })
        .eq("id", messageId);

      console.log(`Pesan ${messageId} → perlu_review (${reason})`);
      return;
    }

    // 5. Cek trainer aktif
    const trainerAktif = (trainerMatch.trainer as any).aktif !== false;
    if (!trainerAktif) {
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "perlu_review",
          error_reason: "Trainer nonaktif — tidak bisa buat laporan.",
          trainer_id: trainerMatch.trainer!.id,
        })
        .eq("id", messageId);

      console.log(`Pesan ${messageId} → perlu_review (trainer nonaktif)`);
      return;
    }

    // 6. Kalau data gak lengkap → perlu_review
    if (!valid.valid) {
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "perlu_review",
          error_reason: `Data belum lengkap: ${valid.errors.join("; ")}`,
          trainer_id: trainerMatch.trainer!.id,
        })
        .eq("id", messageId);

      console.log(`Pesan ${messageId} → perlu_review (data gak lengkap)`);
      return;
    }

    // 7. Match jadwal dari Master Jadwal
    const scheduleMatch = matchWhatsAppSchedule(parsed.materi, schedules);
    const jadwal = scheduleMatch.schedule;

    // 8. Kalau jadwal gak ketemu → perlu_review (sesuai pilihan B)
    if (!jadwal) {
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "perlu_review",
          error_reason: `Materi tidak cocok dengan Master Jadwal: "${parsed.materi.join(", ")}"`,
          trainer_id: trainerMatch.trainer!.id,
        })
        .eq("id", messageId);

      console.log(`Pesan ${messageId} → perlu_review (materi gak match jadwal)`);
      return;
    }

    // 9. Cek jam jadwal — kalau kosong, perlu_review
    if (!jadwal.jam_mulai || !jadwal.jam_selesai) {
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "perlu_review",
          error_reason: `Jam kegiatan "${jadwal.nama_kegiatan}" belum ditentukan di Master Jadwal.`,
          trainer_id: trainerMatch.trainer!.id,
        })
        .eq("id", messageId);

      console.log(`Pesan ${messageId} → perlu_review (jam jadwal kosong)`);
      return;
    }

    // 10. Match material (optional — buat isi material_id kalau jadwal gak punya)
    const materialMatches = matchWhatsAppMaterials(parsed.materi, materials);
    const materialIdFromMatch =
      materialMatches.length > 0 &&
      materialMatches[0]?.status === "matched" &&
      materialMatches[0]?.material
        ? materialMatches[0].material.id
        : null;

    // 11. Siapkan payload — AUTO dari jadwal
    const tanggal = timestampPesan.slice(0, 10);
    const materialId = jadwal.material_id ?? materialIdFromMatch;

    // Kelas: prioritas dari WA, fallback ke jadwal
    const kelasFinal = parsed.kelas || jadwal.kelas || null;

    // Lokasi: auto dari nama kegiatan
    const lokasiFinal = tentukanLokasi(jadwal.nama_kegiatan);

    // ============================================
    // INSERT KE REPORTS
    // ============================================
    const { data: insertedReport, error: reportErr } = await supabase
      .from("reports")
      .insert({
        trainer_id: trainerMatch.trainer!.id,
        tanggal_kegiatan: tanggal,
        materi: jadwal.nama_kegiatan,
        material_id: materialId,
        schedule_id: jadwal.id,
        jam_mulai: jadwal.jam_mulai,
        jam_selesai: jadwal.jam_selesai,
        jam_perlu_konfirmasi: false,
        jenis_kegiatan: jadwal.kategori || null,
        kelas: kelasFinal,
        lokasi: lokasiFinal,
        penanggung_jawab: "Muhammad Halid (Superintendent)",
        jumlah_peserta: parsed.jumlahPeserta ?? 0,
        jumlah_hadir: parsed.jumlahHadir ?? 0,
        jumlah_tidak_hadir: parsed.jumlahTidakHadir ?? 0,
        jumlah_tambahan: parsed.jumlahTambahan ?? 0,
        keterangan: caption || null,
        sumber_laporan: "whatsapp",
        status_laporan: "menunggu_verifikasi",
        waktu_laporan_dikirim: timestampPesan,
        created_by: null,
      })
      .select("id")
      .single();

    if (reportErr) {
      console.error("Gagal insert report:", reportErr);

      await supabase
        .from("whatsapp_messages")
        .update({
          status: "perlu_review",
          error_reason: `Gagal insert report: ${reportErr.message}`,
          trainer_id: trainerMatch.trainer!.id,
        })
        .eq("id", messageId);

      return;
    }

    const reportId = insertedReport.id;

    // ============================================
    // SIMPAN FOTO (kalau ada media)
    // ============================================
    if (mediaUrl && mediaId && WHATSAPP_ACCESS_TOKEN) {
      try {
        const fileRes = await fetch(mediaUrl, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });

        if (fileRes.ok) {
          const fileBuffer = await fileRes.arrayBuffer();
          const ext = fileName?.split(".").pop() || "jpeg";
          const safeMsgId = messageId.replace(/[^a-zA-Z0-9]/g, "_").slice(-40);
          const storagePath = `${reportId}/${safeMsgId}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from("report-photos")
            .upload(storagePath, fileBuffer, {
              contentType:
                fileRes.headers.get("content-type") || "image/jpeg",
              upsert: false,
            });

          if (uploadErr) {
            console.error("Upload foto gagal:", uploadErr);
          } else {
            await supabase.from("report_photos").insert({
              report_id: reportId,
              storage_path: storagePath,
              nama_file:
                fileName || `WhatsApp-${Date.now()}.jpeg`,
              uploaded_by: null,
            });
            console.log("Foto tersimpan:", storagePath);
          }
        }
      } catch (fotoErr) {
        console.error("Error simpan foto:", fotoErr);
      }
    }

    // ============================================
    // UPDATE whatsapp_messages → berhasil
    // ============================================
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "berhasil",
        trainer_id: trainerMatch.trainer!.id,
        report_id: reportId,
        error_reason: null,
      })
      .eq("id", messageId);

    console.log(
      `✅ Pesan ${messageId} → Laporan ${reportId} (${trainerMatch.trainer!.nama_lengkap} | ${jadwal.nama_kegiatan})`,
    );
  } catch (err) {
    console.error("prosesPesanJadiLaporan error:", err);

    await supabase
      .from("whatsapp_messages")
      .update({
        status: "perlu_review",
        error_reason:
          err instanceof Error ? err.message : "Unknown error saat parse.",
      })
      .eq("id", messageId);
  }
}
