import { createClient } from "@supabase/supabase-js";
import {
  matchWhatsAppMaterials,
  matchWhatsAppTrainer,
  parseWhatsAppReport,
  validateParsedWhatsAppReport,
} from "./parser";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_ACCESS_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ============================================
    // 1) VERIFIKASI WEBHOOK (GET)
    // ============================================
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(challenge ?? "", { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    // ============================================
    // 2) TERIMA PESAN (POST)
    // ============================================
    if (request.method === "POST") {
      try {
        const body = (await request.json()) as any;
        const supabase = createClient(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_ROLE_KEY,
        );

        const entry = body?.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;

        if (!value) {
          return new Response("ok", { status: 200 });
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
            fileName = media?.filename ?? `WhatsApp Image ${Date.now()}.jpeg`;

            if (mediaId && env.WHATSAPP_ACCESS_TOKEN) {
              try {
                const mediaRes = await fetch(
                  `https://graph.facebook.com/v21.0/${mediaId}`,
                  {
                    headers: {
                      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
                    },
                  },
                );
                const mediaData = (await mediaRes.json()) as any;
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

          // Insert ke whatsapp_messages
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

          // AUTO-PARSE + AUTO-INSERT
          if (pesanLengkap) {
            await prosesPesanJadiLaporan({
              supabase,
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
              accessToken: env.WHATSAPP_ACCESS_TOKEN,
            });
          }
        }

        return new Response("ok", { status: 200 });
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("ok", { status: 200 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },
};

/* =========================================================
   AUTO-PARSE + INSERT
========================================================= */
async function prosesPesanJadiLaporan(opts: {
  supabase: any;
  messageId: string;
  pesanLengkap: string;
  nomorPengirim: string;
  timestampPesan: string;
  caption: string | null;
  mediaUrl: string | null;
  mediaId: string | null;
  fileName: string | null;
  accessToken: string;
}) {
  const {
    supabase,
    messageId,
    pesanLengkap,
    nomorPengirim,
    timestampPesan,
    caption,
    mediaUrl,
    mediaId,
    fileName,
    accessToken,
  } = opts;

  try {
    // 1. Ambil trainers + materials
    const [trainersRes, materialsRes] = await Promise.all([
      supabase.from("trainers").select("id, nama_lengkap, nomor_whatsapp"),
      supabase.from("materials").select("id, nama, aktif"),
    ]);

    if (trainersRes.error) throw trainersRes.error;
    if (materialsRes.error) throw materialsRes.error;

    const trainers = trainersRes.data ?? [];
    const materials = materialsRes.data ?? [];

    // 2. Parse
    const parsed = parseWhatsAppReport(pesanLengkap);
    const valid = validateParsedWhatsAppReport(parsed);

    // 3. Match
    const trainerMatch = matchWhatsAppTrainer(
      parsed.trainerNama,
      nomorPengirim,
      trainers,
    );
    const materialMatches = matchWhatsAppMaterials(parsed.materi, materials);

    // 4. Trainer gak match
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

      return;
    }

    // 5. Data gak lengkap
    if (!valid.valid) {
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "perlu_review",
          error_reason: `Data belum lengkap: ${valid.errors.join("; ")}`,
          trainer_id: trainerMatch.trainer!.id,
        })
        .eq("id", messageId);

      return;
    }

    // 6. Insert ke reports
    const tanggal = timestampPesan.slice(0, 10);
    const materiGabungan = parsed.materi.join(", ");

    const materialId =
      materialMatches.length === 1 &&
      materialMatches[0]?.status === "matched" &&
      materialMatches[0]?.material
        ? materialMatches[0].material.id
        : null;

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
        created_by: null,
      })
      .select("id")
      .single();

    if (reportErr) {
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

    // 7. SIMPAN FOTO (kalau ada media)
    if (mediaUrl && mediaId && accessToken) {
      try {
        // 7a. Download file dari Meta
        const fileRes = await fetch(mediaUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (fileRes.ok) {
          const fileBuffer = await fileRes.arrayBuffer();
          const ext = fileName?.split(".").pop() || "jpeg";
          const storagePath = `${reportId}/${msgIdSafe(messageId)}.${ext}`;

          // 7b. Upload ke Supabase Storage
          const { error: uploadErr } = await supabase.storage
            .from("report-photos")
            .upload(storagePath, fileBuffer, {
              contentType: fileRes.headers.get("content-type") || "image/jpeg",
              upsert: false,
            });

          if (uploadErr) {
            console.error("Upload foto gagal:", uploadErr);
          } else {
            // 7c. Insert ke report_photos
            await supabase.from("report_photos").insert({
              report_id: reportId,
              storage_path: storagePath,
              nama_file: fileName || `WhatsApp-${Date.now()}.jpeg`,
              uploaded_by: null,
            });
          }
        }
      } catch (fotoErr) {
        console.error("Error simpan foto:", fotoErr);
      }
    }

    // 8. Update whatsapp_messages → berhasil
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "berhasil",
        trainer_id: trainerMatch.trainer!.id,
        report_id: reportId,
        error_reason: null,
      })
      .eq("id", messageId);
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

function msgIdSafe(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_").slice(-40);
}
