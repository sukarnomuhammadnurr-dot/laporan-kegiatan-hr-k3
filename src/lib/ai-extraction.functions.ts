import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HasilEkstraksi = {
  trainer_name: string | null;
  materi: string | null;
  jenis_kegiatan: string | null;
  kelas: string | null;
  penanggung_jawab: string | null;
  tanggal_kegiatan: string | null;
  jam_mulai: string | null;
  jam_selesai: string | null;
  jumlah_peserta: number | null;
  jumlah_hadir: number | null;
  jumlah_tidak_hadir: number | null;
  jumlah_tambahan: number | null;
  keterangan: string | null;
  confidence: number;
  fields_needing_confirmation: string[];
};

const SYSTEM_PROMPT = `Anda adalah asisten pencatat laporan kegiatan Trainer K3 di PT IWIP.
Tugas Anda membaca teks laporan (dan tulisan pada foto bila ada) lalu mengekstrak data terstruktur.

ATURAN MUTLAK:
- JANGAN mengarang data apa pun. Nilai yang tidak tertulis harus null.
- Jangan menebak angka peserta, jam, atau nama trainer.
- Jika nilai "Tambahan" ditulis "-", kosong, atau tidak ada angka, isi 0.
- Jika Anda tidak yakin pada suatu field, tetap isi nilai terbaik yang terbaca TETAPI cantumkan nama field tersebut pada fields_needing_confirmation.
- Jam kegiatan dan waktu pesan dikirim adalah dua hal berbeda. Jangan menyalin waktu kirim menjadi jam kegiatan.
- Format jam: HH:MM 24 jam. Format tanggal: YYYY-MM-DD.
- confidence adalah angka 0 sampai 1.

Jawab HANYA dengan satu objek JSON tanpa penjelasan dan tanpa blok kode, dengan kunci:
trainer_name, materi, jenis_kegiatan, kelas, penanggung_jawab, tanggal_kegiatan, jam_mulai, jam_selesai,
jumlah_peserta, jumlah_hadir, jumlah_tidak_hadir, jumlah_tambahan, keterangan, confidence, fields_needing_confirmation.`;

/**
 * Membaca teks laporan (dan foto opsional) memakai Lovable AI.
 * Dipakai oleh form "Buat Laporan" dan nantinya oleh alur WhatsApp.
 */
export const ekstrakLaporan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teks: string; imageDataUrl?: string | null }) => input)
  .handler(async ({ data }): Promise<HasilEkstraksi> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Layanan AI belum dikonfigurasi.");

    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: `Teks laporan:\n${data.teks || "(kosong)"}` },
    ];
    if (data.imageDataUrl) {
      content.push({ type: "input_image", image_url: data.imageDataUrl });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          { role: "user", content },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 402) throw new Error("Kredit AI habis. Silakan isi ulang kredit.");
      if (res.status === 429) throw new Error("Terlalu banyak permintaan AI. Coba lagi sebentar.");
      throw new Error(`Layanan AI gagal (${res.status}): ${body.slice(0, 200)}`);
    }

    const raw = await res.text();
    let teks = "";
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          text?: string;
        };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          teks += evt.delta;
        }
      } catch {
        /* lewati baris yang bukan JSON */
      }
    }

    const cocok = teks.match(/\{[\s\S]*\}/);
    if (!cocok) throw new Error("AI tidak mengembalikan data yang dapat dibaca.");

    const parsed = JSON.parse(cocok[0]) as Partial<HasilEkstraksi>;
    const angka = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

    return {
      trainer_name: (parsed.trainer_name as string) ?? null,
      materi: (parsed.materi as string) ?? null,
      jenis_kegiatan: (parsed.jenis_kegiatan as string) ?? null,
      kelas: (parsed.kelas as string) ?? null,
      penanggung_jawab: (parsed.penanggung_jawab as string) ?? null,
      tanggal_kegiatan: (parsed.tanggal_kegiatan as string) ?? null,
      jam_mulai: (parsed.jam_mulai as string) ?? null,
      jam_selesai: (parsed.jam_selesai as string) ?? null,
      jumlah_peserta: angka(parsed.jumlah_peserta),
      jumlah_hadir: angka(parsed.jumlah_hadir),
      jumlah_tidak_hadir: angka(parsed.jumlah_tidak_hadir),
      jumlah_tambahan: angka(parsed.jumlah_tambahan) ?? 0,
      keterangan: (parsed.keterangan as string) ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      fields_needing_confirmation: Array.isArray(parsed.fields_needing_confirmation)
        ? (parsed.fields_needing_confirmation as string[])
        : [],
    };
  });
