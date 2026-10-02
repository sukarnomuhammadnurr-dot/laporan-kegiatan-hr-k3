import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "iwip-k3-verify";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ============================================
  // 1) VERIFIKASI WEBHOOK (GET) — dipanggil Meta sekali
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
  // 2) TERIMA PESAN (POST) — dari Meta
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

        // Cari nama pengirim dari contacts
        const contact = contacts.find((c: any) => c.wa_id === from);
        const namaPengirim = contact?.profile?.name ?? null;

        // Ambil teks pesan
        let pesan: string | null = null;
        let caption: string | null = null;
        let mediaUrl: string | null = null;
        let mediaStoragePath: string | null = null;

        if (msg.type === "text") {
          pesan = msg.text?.body ?? null;
        } else if (msg.type === "image" || msg.type === "document") {
          const media = msg.image ?? msg.document;
          caption = media?.caption ?? null;
          const mediaId = media?.id;

          if (mediaId && WHATSAPP_ACCESS_TOKEN) {
            // Ambil URL media dari Meta
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

        // Gabung pesan + caption
        const pesanLengkap = [pesan, caption].filter(Boolean).join("\n") || null;

        // Insert ke whatsapp_messages
        const { error } = await supabase.from("whatsapp_messages").insert({
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
        });

        if (error) {
          console.error("Insert error:", error);
        } else {
          console.log("Pesan tersimpan:", msgId);
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
