import { createFileRoute } from "@tanstack/react-router";
import {
  matchWhatsAppMaterials,
  matchWhatsAppSchedule,
  matchWhatsAppTrainer,
  parseWhatsAppReport,
  validateParsedWhatsAppReport,
} from "@/lib/whatsapp-webhook-parser.server";

const GRAPH = "https://graph.facebook.com/v21.0";

function tentukanLokasi(namaKegiatan: string): string {
  const LUAR_RUANGAN = ["APEL", "APD"];
  const upper = namaKegiatan.toUpperCase();
  return LUAR_RUANGAN.some((k) => upper.includes(k))
    ? "Luar Ruangan"
    : "Dalam Ruangan";
}

async function verifySignature(raw: string, header: string | null, secret: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const given = header.slice(7).toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * Deteksi apakah pesan adalah "chat sampah" yang gak perlu diproses.
 */
function isPesanSampah(teks: string): boolean {
  const lower = teks.toLowerCase().trim();
  const sampah = [
    "makasih", "terima kasih", "thanks", "thank you",
    "ok", "oke", "okay", "sip", "siap", "baik",
    "noted", "diterima", "sudah", "done", "beres",
    "👍", "🙏", "mantap", "keren",
  ];
  return lower.length < 20 && sampah.some((s) => lower.includes(s));
}

/**
 * Generate catatan revisi dari list error.
 * Ditampilkan ke trainer di halaman "Laporan Saya".
 */
function buatCatatanRevisi(errors: string[]): string {
  return [
    "⚠️ Laporan Ditolak Otomatis",
    "",
    "Alasan:",
    ...errors.map((e) => `• ${e}`),
    "",
    "Silakan perbaiki dan kirim ulang dari aplikasi.",
    "",
    "Format yang benar:",
    "Materi: [nama materi]",
    "Trainer: [nama lengkap]",
    "Tanggal: DD-MM-YYYY (opsional kalau hari ini)",
    "Kelas: [kelas]",
    "Jumlah peserta: [angka]",
    "Hadir: [angka]",
    "Tidak Hadir: [angka]",
    "Tambahan: [angka/-]",
  ].join("\n");
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"] || "iwip-k3-verify";
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === verifyToken
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const appSecret = process.env["WHATSAPP_APP_SECRET"];
        if (!appSecret) {
          console.error("WHATSAPP_APP_SECRET belum dipasang — pesan ditolak.");
          return new Response("Server not configured", { status: 503 });
        }
        const raw = await request.text();
        const ok = await verifySignature(raw, request.headers.get("x-hub-signature-256"), appSecret);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let body: any;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const accessToken = process.env["WHATSAPP_ACCESS_TOKEN"] ?? "";

        try {
          for (const entry of body?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
              const value = change?.value;
              if (!value) continue;
              const contacts = value.contacts ?? [];
              for (const msg of value.messages ?? []) {
                await handleMessage(supabaseAdmin, msg, contacts, accessToken);
              }
            }
          }
        } catch (e) {
          console.error("Webhook error:", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function handleMessage(
  supabase: any,
  msg: any,
  contacts: any[],
  accessToken: string,
) {
  const from: string = msg.from;
  const tsIso = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString();
  const namaPengirim = contacts.find((c: any) => c.wa_id === from)?.profile?.name ?? null;

  // Cegah duplikat
  if (msg.id) {
    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("message_id", msg.id)
      .maybeSingle();
    if (existing) return;
  }

  let pesan: string | null = null;
  let caption: string | null = null;
  let mediaUrl: string | null = null;
  let mediaId: string | null = null;
  let mimeType: string | null = null;
  let fileName: string | null = null;

  if (msg.type === "text") pesan = msg.text?.body ?? null;
  else if (msg.type === "image" || msg.type === "document") {
    const media = msg.image ?? msg.document;
    caption = media?.caption ?? null;
    mediaId = media?.id ?? null;
    mimeType = media?.mime_type ?? null;
    fileName = media?.filename ?? null;
    if (mediaId && accessToken) {
      try {
        const r = await fetch(`${GRAPH}/${mediaId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const d: any = await r.json();
        mediaUrl = d?.url ?? null;
        mimeType = d?.mime_type ?? mimeType;
      } catch (e) {
        console.error("Gagal ambil media URL:", e);
      }
    }
  } else if (msg.type === "button") pesan = msg.button?.text ?? null;
  else if (msg.type === "interactive")
    pesan = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null;

  const pesanLengkap = [pesan, caption].filter(Boolean).join("\n") || null;

  // ============================================================
  // FILTER: Abaikan "chat sampah" — hemat DB & gak balas
  // ============================================================
  if (pesanLengkap && isPesanSampah(pesanLengkap)) {
    console.log(`Pesan sampah dari ${from}, diabaikan: "${pesanLengkap.slice(0, 50)}"`);
    return;
  }

  const { data: inserted, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      message_id: msg.id ?? null,
      nomor_pengirim: from,
      nama_pengirim: namaPengirim,
      pesan: pesanLengkap,
      caption,
      media_url: mediaUrl,
      timestamp_pesan: tsIso,
      status: "baru",
      raw_payload: msg,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Insert whatsapp_messages gagal:", error);
    return;
  }
  const messageId: string = inserted.id;

  const setStatus = (patch: Record<string, unknown>) =>
    supabase.from("whatsapp_messages").update(patch).eq("id", messageId);

  if (!pesanLengkap) {
    await setStatus({ status: "perlu_review", error_reason: "Pesan tanpa teks/keterangan." });
    return;
  }

  try {
    const [tr, mr, sr] = await Promise.all([
      supabase.from("trainers").select("id, nama_lengkap, nomor_whatsapp, aktif"),
      supabase.from("materials").select("id, nama, aktif"),
      supabase
        .from("schedules")
        .select("id, nama_kegiatan, jam_mulai, jam_selesai, kelas, kategori, material_id, training_day_id, aktif"),
    ]);
    if (tr.error) throw tr.error;
    if (mr.error) throw mr.error;
    if (sr.error) throw sr.error;

    const parsed = parseWhatsAppReport(pesanLengkap);
    const trainerMatch = matchWhatsAppTrainer(parsed.trainerNama, from, tr.data ?? []);
    const materialMatches = matchWhatsAppMaterials(parsed.materi, mr.data ?? []);
    const scheduleMatch = matchWhatsAppSchedule(parsed.materi, sr.data ?? []);
    const jadwal = scheduleMatch.schedule;

    // ============================================================
    // VALIDASI MENYELURUH
    // ============================================================
    const tanggalKirimWA = new Date(tsIso).toISOString().slice(0, 10);
    const validasi = validateParsedWhatsAppReport(parsed);

    // ============================================================
    // KALAU INVALID → INSERT ke reports dengan status "perlu_revisi"
    // (biar trainer liat di aplikasi & benerin sendiri)
    // ============================================================
    if (!validasi.valid) {
      // Kalau trainer gak match, gak bisa insert ke reports (FK constraint)
      // → simpan di whatsapp_messages aja
      if (trainerMatch.status !== "matched" || !trainerMatch.trainer) {
        await setStatus({
          status: "perlu_review",
          trainer_id: null,
          error_reason: `Trainer tidak ditemukan. ${validasi.errors.join("; ")}`,
        });
        console.log(`Pesan ${messageId} → perlu_review (trainer gak match)`);
        return;
      }

      const trainerId = trainerMatch.trainer.id;

      // Insert ke reports sebagai draft "perlu_revisi"
      // Biar muncul di halaman "Laporan Saya" trainer
      const tanggalFallback = parsed.tanggalKegiatan || tanggalKirimWA;

      const { data: draftReport, error: draftErr } = await supabase
        .from("reports")
        .insert({
          trainer_id: trainerId,
          tanggal_kegiatan: tanggalFallback,
          materi: jadwal?.nama_kegiatan || parsed.materi.join(", "),
          material_id: jadwal?.material_id || null,
          schedule_id: jadwal?.id || null,
          jam_mulai: jadwal?.jam_mulai || null,
          jam_selesai: jadwal?.jam_selesai || null,
          jam_perlu_konfirmasi: !jadwal?.jam_mulai,
          jenis_kegiatan: jadwal?.kategori || null,
          kelas: parsed.kelas || jadwal?.kelas || null,
          lokasi: jadwal
            ? tentukanLokasi(jadwal.nama_kegiatan)
            : "Dalam Ruangan",
          penanggung_jawab: "Muhammad Halid (Superintendent)",
          jumlah_peserta: parsed.jumlahPeserta ?? 0,
          jumlah_hadir: parsed.jumlahHadir ?? 0,
          jumlah_tidak_hadir: parsed.jumlahTidakHadir ?? 0,
          jumlah_tambahan: parsed.jumlahTambahan ?? 0,
          keterangan: caption || pesanLengkap,
          sumber_laporan: "whatsapp",
          status_laporan: "perlu_revisi", // ← LANGSUNG PERLU REVISI
          catatan_revisi: buatCatatanRevisi(validasi.errors),
          waktu_laporan_dikirim: tsIso,
          created_by: null,
        })
        .select("id")
        .single();

      if (draftErr) {
        console.error("Gagal insert draft revisi:", draftErr);
        await setStatus({
          status: "perlu_review",
          trainer_id: trainerId,
          error_reason: `Validasi gagal: ${validasi.errors.join("; ")}. Gagal buat draft: ${draftErr.message}`,
        });
        return;
      }

      // Update whatsapp_messages → link ke draft report
      await setStatus({
        status: "berhasil",
        trainer_id: trainerId,
        report_id: draftReport.id,
        error_reason: validasi.errors.join("; "),
      });

      console.log(
        `Pesan ${messageId} → Laporan DRAFT ${draftReport.id} (perlu_revisi)`,
      );

      // ❌ GAK kirim WA balik — trainer liat di aplikasi
      return;
    }

    // ============================================================
    // VALIDASI LOLOS — cek trainer & jadwal detail
    // ============================================================
    if (trainerMatch.status !== "matched" || !trainerMatch.trainer) {
      await setStatus({
        status: "perlu_review",
        trainer_id: null,
        error_reason: "Trainer tidak ditemukan di Master Trainer.",
      });
      return;
    }

    const trainerId = trainerMatch.trainer.id;
    const trainerRow = (tr.data ?? []).find((t: any) => t.id === trainerId);
    if (trainerRow && trainerRow.aktif === false) {
      await setStatus({
        status: "perlu_review",
        trainer_id: trainerId,
        error_reason: "Trainer berstatus nonaktif.",
      });
      return;
    }

    const validDasar = validateParsedWhatsAppReport(parsed);
    if (!validDasar.valid) {
      await setStatus({
        status: "perlu_review",
        trainer_id: trainerId,
        error_reason: `Data belum lengkap: ${validDasar.errors.join("; ")}`,
      });
      return;
    }

    if (!jadwal || !jadwal.jam_mulai || !jadwal.jam_selesai) {
      await setStatus({
        status: "perlu_review",
        trainer_id: trainerId,
        error_reason: jadwal
          ? `Jam kegiatan "${jadwal.nama_kegiatan}" belum ditentukan di Master Jadwal.`
          : "Jadwal kegiatan tidak ditemukan di Master Jadwal.",
      });
      return;
    }

    const materialId =
      jadwal.material_id ??
      (materialMatches.length === 1 &&
      materialMatches[0]?.status === "matched" &&
      materialMatches[0]?.material
        ? materialMatches[0].material.id
        : null);

    const kelasFinal = parsed.kelas || jadwal.kelas || null;
    const lokasiFinal = tentukanLokasi(jadwal.nama_kegiatan);

    const tanggal = new Date(new Date(tsIso).getTime() + 9 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    // ============================================================
    // LAPORAN VALID → AUTO-TERVERIFIKASI
    // ============================================================
    const { data: report, error: rErr } = await supabase
      .from("reports")
      .insert({
        trainer_id: trainerId,
        tanggal_kegiatan: parsed.tanggalKegiatan || tanggal,
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
        status_laporan: "terverifikasi",
        verified_at: new Date().toISOString(),
        verified_by: null,
        waktu_laporan_dikirim: tsIso,
        created_by: null,
      })
      .select("id")
      .single();

    if (rErr) {
      await setStatus({
        status: "perlu_review",
        trainer_id: trainerId,
        error_reason: `Gagal membuat laporan: ${rErr.message}`,
      });
      return;
    }

    // Simpan foto
    let storagePath: string | null = null;
    if (mediaUrl && accessToken) {
      try {
        const f = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (f.ok) {
          const ct = f.headers.get("content-type") || mimeType || "image/jpeg";
          const ext = (ct.split("/")[1] || "jpeg").split(";")[0];
          storagePath = `${report.id}/${String(msg.id ?? Date.now()).replace(/[^a-zA-Z0-9]/g, "_").slice(-40)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("report-photos")
            .upload(storagePath, await f.arrayBuffer(), { contentType: ct, upsert: false });
          if (upErr) {
            console.error("Upload foto gagal:", upErr);
            storagePath = null;
          } else {
            await supabase.from("report_photos").insert({
              report_id: report.id,
              storage_path: storagePath,
              nama_file: fileName ?? `WhatsApp-${Date.now()}.${ext}`,
              uploaded_by: null,
            });
          }
        }
      } catch (e) {
        console.error("Simpan foto gagal:", e);
      }
    }

    await setStatus({
      status: "berhasil",
      trainer_id: trainerId,
      report_id: report.id,
      media_storage_path: storagePath,
      error_reason: null,
    });

    console.log(`✅ Pesan ${messageId} → Laporan ${report.id} AUTO-TERVERIFIKASI`);
  } catch (err) {
    console.error("Proses pesan gagal:", err);
    await setStatus({
      status: "perlu_review",
      error_reason: err instanceof Error ? err.message : "Kesalahan tidak dikenal saat memproses.",
    });
  }
}
