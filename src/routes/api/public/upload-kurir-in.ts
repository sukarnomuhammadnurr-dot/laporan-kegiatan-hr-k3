import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "report-photos";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Max-Age": "86400",
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return Response.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}

function matchesSecret(received: string, expected: string): boolean {
  const receivedBytes = new TextEncoder().encode(received);
  const expectedBytes = new TextEncoder().encode(expected);
  if (receivedBytes.length !== expectedBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= (receivedBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  const signature = new TextDecoder().decode(bytes.subarray(0, 6));
  if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  return null;
}

export const Route = createFileRoute("/api/public/upload-kurir-in")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const expectedKey = process.env["KURIR_IN_API_KEY"];
        if (!expectedKey) {
          return jsonResponse(
            { success: false, error: "Server belum dikonfigurasi untuk menerima unggahan." },
            503,
          );
        }

        const providedKey = request.headers.get("x-api-key") ?? "";
        if (!matchesSecret(providedKey, expectedKey)) {
          return jsonResponse({ success: false, error: "Kunci API tidak valid." }, 401);
        }

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
          return jsonResponse(
            { success: false, error: "Kirim file menggunakan multipart/form-data." },
            400,
          );
        }

        const contentLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 1024 * 1024) {
          return jsonResponse({ success: false, error: "Ukuran unggahan melebihi 20 MB." }, 400);
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonResponse({ success: false, error: "Form unggahan tidak dapat dibaca." }, 400);
        }

        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return jsonResponse(
            { success: false, error: "File gambar wajib dikirim pada kolom 'file'." },
            400,
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          return jsonResponse({ success: false, error: "Ukuran file melebihi 20 MB." }, 400);
        }

        try {
          const fileBytes = new Uint8Array(await file.arrayBuffer());
          const actualMime = detectImageMime(fileBytes.subarray(0, 12));
          if (!actualMime || actualMime !== file.type || !MIME_EXTENSIONS[actualMime]) {
            return jsonResponse(
              { success: false, error: "File harus berupa gambar JPEG, PNG, WebP, atau GIF yang valid." },
              400,
            );
          }

          const storagePath = `kurir-in/${crypto.randomUUID()}.${MIME_EXTENSIONS[actualMime]}`;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(storagePath, fileBytes, {
              contentType: actualMime,
              upsert: false,
            });

          if (uploadError) {
            console.error("Upload Kurir-In ke penyimpanan gagal:", uploadError.message);
            return jsonResponse(
              { success: false, error: "Gagal menyimpan foto. Silakan coba lagi." },
              500,
            );
          }

          const { data: signedUrl, error: signedUrlError } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

          if (signedUrlError || !signedUrl?.signedUrl) {
            console.error("Gagal membuat tautan foto Kurir-In:", signedUrlError?.message);
            return jsonResponse(
              { success: false, error: "Foto tersimpan, tetapi tautannya gagal dibuat." },
              500,
            );
          }

          return jsonResponse({ success: true, url: signedUrl.signedUrl }, 200);
        } catch (error) {
          console.error(
            "Kesalahan endpoint upload Kurir-In:",
            error instanceof Error ? error.message : "Unknown error",
          );
          return jsonResponse(
            { success: false, error: "Terjadi kesalahan saat memproses foto." },
            500,
          );
        }
      },
    },
  },
});