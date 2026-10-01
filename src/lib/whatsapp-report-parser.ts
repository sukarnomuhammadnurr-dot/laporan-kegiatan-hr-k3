/**
 * WhatsApp Report Parser (v2 — fleksibel)
 * ========================================
 * Bisa baca pesan:
 * - Multi-baris (dipisah enter)
 * - 1 baris (dipisah spasi)
 * - Dipisah koma
 * - Tanpa spasi setelah titik dua
 * - Tanpa titik dua sama sekali
 *
 * Yang penting kata kuncinya ada: Materi, Trainer, Jumlah peserta,
 * Hadir, Tidak Hadir, Tambahan.
 */

export type ParsedWhatsAppReport = {
  trainerNama: string | null;
  materi: string[];
  jumlahPeserta: number | null;
  jumlahHadir: number | null;
  jumlahTidakHadir: number | null;
  jumlahTambahan: number;
};

/**
 * =========================
 * NORMALISASI TEXT
 * =========================
 */

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[.,;:()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * =========================
 * NORMALISASI NOMOR WA
 * =========================
 */

export function normalizeWhatsAppNumber(
  value: string | null | undefined,
) {
  if (!value) return "";

  let phone = value.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = `62${phone.slice(1)}`;
  }

  return phone;
}

/**
 * =========================
 * PARSE ANGKA
 * =========================
 */

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;

  const cleaned = value.replace(/[^\d-]/g, "").trim();

  if (!cleaned) return null;

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function removeTrailingPunctuation(value: string) {
  return value.replace(/[,\s;:]+$/g, "").trim();
}

/**
 * =========================
 * PARSE MATERI
 * =========================
 */

function parseMaterials(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((item) => removeTrailingPunctuation(normalizeText(item)))
    .filter(Boolean);
}

/**
 * =========================
 * PARSE LAPORAN WHATSAPP
 * =========================
 *
 * Strategi:
 * 1. Newline dinormalisasi jadi spasi — biar 1 baris / multi-baris sama
 * 2. Regex pakai \b word boundary (gak butuh newline)
 * 3. Materi diambil dari "Materi" sampai sebelum "Trainer" / field lain
 */

export function parseWhatsAppReport(text: string): ParsedWhatsAppReport {
  // Normalisasi newline → spasi
  const source = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let trainerNama: string | null = null;
  let materi: string[] = [];

  let jumlahPeserta: number | null = null;
  let jumlahHadir: number | null = null;
  let jumlahTidakHadir: number | null = null;
  let jumlahTambahan = 0;

  /**
   * TRAINER
   * Stop di field berikutnya (jumlah peserta / hadir / tidak hadir / tambahan)
   */
  const trainerMatch = source.match(
    /\btrainer\s*:?\s*(.+?)(?=\s*(?:jumlah\s+peserta|hadir|tidak\s+hadir|tambahan)\s*:?\s*|$)/i,
  );

  if (trainerMatch?.[1]) {
    trainerNama = removeTrailingPunctuation(normalizeText(trainerMatch[1]));
  }

  /**
   * MATERI
   * Stop di: trainer / jumlah peserta / hadir / tidak hadir / tambahan
   */
  const materiMatch = source.match(
    /\bmateri\s*:?\s*(.+?)(?=\s*(?:trainer|jumlah\s+peserta|hadir|tidak\s+hadir|tambahan)\s*:?\s*|$)/i,
  );

  if (materiMatch?.[1]) {
    materi = parseMaterials(materiMatch[1]);
  }

  /**
   * JUMLAH PESERTA
   */
  const jumlahPesertaMatch = source.match(
    /\bjumlah\s+peserta\s*:?\s*([0-9.,]+)/i,
  );
  jumlahPeserta = parseNumber(jumlahPesertaMatch?.[1]);

  /**
   * HADIR — hati-hati jangan match "tidak hadir"
   * Pakai negative lookbehind sederhana: pastikan sebelumnya bukan "tidak"
   */
  const hadirMatch = source.match(
    /(?:^|\s)hadir\s*:?\s*([0-9.,]+)/i,
  );
  jumlahHadir = parseNumber(hadirMatch?.[1]);

  /**
   * TIDAK HADIR
   */
  const tidakHadirMatch = source.match(
    /\btidak\s+hadir\s*:?\s*([0-9.,]+)/i,
  );
  jumlahTidakHadir = parseNumber(tidakHadirMatch?.[1]);

  /**
   * TAMBAHAN — support "-", "0", "2"
   */
  const tambahanMatch = source.match(
    /\btambahan\s*:?\s*([0-9.,-]+|-)/i,
  );

  if (tambahanMatch?.[1]) {
    const rawTambahan = tambahanMatch[1].trim();

    if (
      rawTambahan === "-" ||
      rawTambahan === "–" ||
      rawTambahan === "—"
    ) {
      jumlahTambahan = 0;
    } else {
      jumlahTambahan = parseNumber(rawTambahan) ?? 0;
    }
  }

  return {
    trainerNama,
    materi,
    jumlahPeserta,
    jumlahHadir,
    jumlahTidakHadir,
    jumlahTambahan,
  };
}

/**
 * =========================
 * TRAINER MATCHING
 * =========================
 */

export type WhatsAppTrainerCandidate = {
  id: string;
  nama_lengkap: string;
  nomor_whatsapp?: string | null;
};

export type TrainerMatchResult = {
  status: "matched" | "ambiguous" | "not_found";
  trainer: WhatsAppTrainerCandidate | null;
  candidates: WhatsAppTrainerCandidate[];
  matchedBy: "nomor_whatsapp" | "nama" | null;
};

export function matchWhatsAppTrainer(
  trainerNama: string | null,
  nomorWhatsapp: string | null,
  trainers: WhatsAppTrainerCandidate[],
): TrainerMatchResult {
  // PRIORITAS 1: NOMOR WHATSAPP
  const targetPhone = normalizeWhatsAppNumber(nomorWhatsapp);

  if (targetPhone) {
    const phoneMatches = trainers.filter(
      (trainer) =>
        normalizeWhatsAppNumber(trainer.nomor_whatsapp) === targetPhone,
    );

    if (phoneMatches.length === 1) {
      return {
        status: "matched",
        trainer: phoneMatches[0]!,
        candidates: phoneMatches,
        matchedBy: "nomor_whatsapp",
      };
    }

    if (phoneMatches.length > 1) {
      return {
        status: "ambiguous",
        trainer: null,
        candidates: phoneMatches,
        matchedBy: null,
      };
    }
  }

  // PRIORITAS 2: NAMA TRAINER
  if (trainerNama) {
    const target = normalizeForMatch(trainerNama);

    const exactMatches = trainers.filter(
      (trainer) => normalizeForMatch(trainer.nama_lengkap) === target,
    );

    if (exactMatches.length === 1) {
      return {
        status: "matched",
        trainer: exactMatches[0]!,
        candidates: exactMatches,
        matchedBy: "nama",
      };
    }

    if (exactMatches.length > 1) {
      return {
        status: "ambiguous",
        trainer: null,
        candidates: exactMatches,
        matchedBy: null,
      };
    }

    const containsMatches = trainers.filter((trainer) => {
      const name = normalizeForMatch(trainer.nama_lengkap);
      return name.includes(target) || target.includes(name);
    });

    if (containsMatches.length === 1) {
      return {
        status: "matched",
        trainer: containsMatches[0]!,
        candidates: containsMatches,
        matchedBy: "nama",
      };
    }

    if (containsMatches.length > 1) {
      return {
        status: "ambiguous",
        trainer: null,
        candidates: containsMatches,
        matchedBy: null,
      };
    }
  }

  return {
    status: "not_found",
    trainer: null,
    candidates: [],
    matchedBy: null,
  };
}

/**
 * =========================
 * MATERIAL MATCHING
 * =========================
 */

export type WhatsAppMaterialCandidate = {
  id: string;
  nama: string;
  aktif?: boolean;
};

export type MaterialMatch = {
  input: string;
  status: "matched" | "ambiguous" | "not_found";
  material: WhatsAppMaterialCandidate | null;
  candidates: WhatsAppMaterialCandidate[];
};

export function matchWhatsAppMaterials(
  materiInput: string[],
  materials: WhatsAppMaterialCandidate[],
): MaterialMatch[] {
  return materiInput.map((input) => {
    const target = normalizeForMatch(input);

    const exactMatches = materials.filter(
      (material) => normalizeForMatch(material.nama) === target,
    );

    if (exactMatches.length === 1) {
      return {
        input,
        status: "matched",
        material: exactMatches[0]!,
        candidates: exactMatches,
      };
    }

    if (exactMatches.length > 1) {
      return {
        input,
        status: "ambiguous",
        material: null,
        candidates: exactMatches,
      };
    }

    const containsMatches = materials.filter((material) => {
      const name = normalizeForMatch(material.nama);
      return name.includes(target) || target.includes(name);
    });

    if (containsMatches.length === 1) {
      return {
        input,
        status: "matched",
        material: containsMatches[0]!,
        candidates: containsMatches,
      };
    }

    if (containsMatches.length > 1) {
      return {
        input,
        status: "ambiguous",
        material: null,
        candidates: containsMatches,
      };
    }

    return {
      input,
      status: "not_found",
      material: null,
      candidates: [],
    };
  });
}

/**
 * =========================
 * VALIDASI LAPORAN
 * =========================
 */

export function validateParsedWhatsAppReport(
  report: ParsedWhatsAppReport,
) {
  const errors: string[] = [];

  if (!report.trainerNama) errors.push("Nama trainer tidak ditemukan.");
  if (report.materi.length === 0) errors.push("Materi tidak ditemukan.");
  if (report.jumlahPeserta === null)
    errors.push("Jumlah peserta tidak ditemukan.");
  if (report.jumlahHadir === null) errors.push("Jumlah hadir tidak ditemukan.");
  if (report.jumlahTidakHadir === null)
    errors.push("Jumlah tidak hadir tidak ditemukan.");

  if (
    report.jumlahHadir !== null &&
    report.jumlahPeserta !== null &&
    report.jumlahHadir > report.jumlahPeserta
  ) {
    errors.push("Jumlah hadir lebih besar daripada jumlah peserta.");
  }

  if (
    report.jumlahTidakHadir !== null &&
    report.jumlahPeserta !== null &&
    report.jumlahTidakHadir > report.jumlahPeserta
  ) {
    errors.push("Jumlah tidak hadir lebih besar daripada jumlah peserta.");
  }

  if (
    report.jumlahPeserta !== null &&
    report.jumlahHadir !== null &&
    report.jumlahTidakHadir !== null
  ) {
    const total = report.jumlahHadir + report.jumlahTidakHadir;
    if (total !== report.jumlahPeserta) {
      errors.push(
        `Hadir (${report.jumlahHadir}) + Tidak Hadir (${report.jumlahTidakHadir}) tidak sama dengan Jumlah Peserta (${report.jumlahPeserta}).`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
