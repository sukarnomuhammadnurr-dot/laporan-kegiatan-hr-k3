import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  matchWhatsAppMaterials,
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
        const mediaStoragePath: string | null = null;

        if (msg.type === "text") {
          pesan = msg.text?.body ?? null;
        } else if (msg.type === "image" || msg.type === "document") {
          const media = msg.image ?? msg.document;
          caption = media?.caption ?? null;
          const mediaId = media?.id;

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
            media_storage_path: mediaStoragePath,
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
}) {
  const { messageId, pesanLengkap, nomorPengirim, timestampPesan, caption } =
    opts;

  try {
    // 1. Ambil trainers + materials
    const [trainersRes, materialsRes] = await Promise.all([
      supabase
        .from("trainers")
        .select("id, nama_lengkap, nomor_whatsapp"),
      supabase.from("materials").select("id, nama, aktif"),
    ]);

    if (trainersRes.error) throw trainersRes.error;
    if (materialsRes.error) throw materialsRes.error;

    const trainers = trainersRes.data ?? [];
    const materials = materialsRes.data ?? [];

    // 2. Parse pesan
    const parsed = parseWhatsAppReport(pesanLengkap);
    const valid = validateParsedWhatsAppReport(parsed);

    // 3. Match trainer
    const trainerMatch = matchWhatsAppTrainer(
      parsed.trainerNama,
      nomorPengirim,
      trainers,
    );

    // 4. Match material
    const materialMatches = matchWhatsAppMaterials(parsed.materi, materials);

    // 5. Kalau trainer gak match → perlu_review
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

    // 7. Siapkan data untuk insert ke reports
    const tanggal = timestampPesan.slice(0, 10);
    const materiGabungan = parsed.materi.join(", ");

    const materialId =
      materialMatches.length === 1 &&
      materialMatches[0]?.status === "matched" &&
      materialMatches[0]?.material
        ? materialMatches[0].material.id
        : null;

    // 8. Insert ke reports
    const { data: insertedReport, error: reportErr } = await supabase
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
        keterangan: caption || null,
        sumber_laporan: "whatsapp",
        status_laporan: "menunggu_verifikasi",
        waktu_laporan_dikirim: timestampPesan,
        created_by: trainerMatch.trainer!.id,
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

    // 9. Update whatsapp_messages → berhasil + link ke report
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "berhasil",
        trainer_id: trainerMatch.trainer!.id,
        report_id: insertedReport.id,
        error_reason: null,
      })
      .eq("id", messageId);

    console.log(
      `✅ Pesan ${messageId} → Laporan ${insertedReport.id} dibuat (trainer: ${trainerMatch.trainer!.nama_lengkap})`,
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
