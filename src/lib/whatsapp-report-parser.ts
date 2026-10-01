/**
 * WhatsApp Report Parser
 * =======================
 *
 * Parser laporan trainer dari WhatsApp.
 *
 * Format contoh:
 *
 * Materi K3 H1A, PERATURAN PERUSAHAAN, PEDOMAN PERILAKU,
 * Trainer Sufri Hi Rajak
 * Jumlah peserta: 34
 * Hadir: 32
 * Tidak Hadir: 2
 * Tambahan:-
 *
 * Identifikasi trainer:
 * 1. Nomor WhatsApp = prioritas utama
 * 2. Nama trainer = fallback
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
 *
 * 08123456789
 * +628123456789
 * 628123456789
 *
 * semuanya akan dianggap:
 *
 * 628123456789
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

function parseNumber(
  value: string | undefined,
): number | null {
  if (!value) return null;

  const cleaned = value
    .replace(/[^\d-]/g, "")
    .trim();

  if (!cleaned) return null;

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function removeTrailingPunctuation(value: string) {
  return value
    .replace(/[,\s;:]+$/g, "")
    .trim();
}

/**
 * =========================
 * PARSE MATERI
 * =========================
 */

function parseMaterials(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((item) =>
      removeTrailingPunctuation(
        normalizeText(item),
      ),
    )
    .filter(Boolean);
}

/**
 * =========================
 * PARSE LAPORAN WHATSAPP
 * =========================
 */

export function parseWhatsAppReport(
  text: string,
): ParsedWhatsAppReport {
  const source = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  let trainerNama: string | null = null;
  let materi: string[] = [];

  let jumlahPeserta: number | null = null;
  let jumlahHadir: number | null = null;
  let jumlahTidakHadir: number | null = null;
  let jumlahTambahan = 0;

  /**
   * =========================
   * TRAINER
   * =========================
   */

  const trainerMatch = source.match(
    /(?:^|\n)\s*trainer\s*:?\s*(.+?)(?=\n|$)/i,
  );

  if (trainerMatch?.[1]) {
    trainerNama = removeTrailingPunctuation(
      normalizeText(trainerMatch[1]),
    );
  }

  /**
   * =========================
   * MATERI
   * =========================
   *
   * Mendukung:
   *
   * Materi K3 H1A, PERATURAN PERUSAHAAN
   *
   * maupun:
   *
   * Materi: K3 H1A, PERATURAN PERUSAHAAN
   */

  const materiMatch = source.match(
    /(?:^|\n)\s*materi\s*:?\s*(.+?)(?=\n\s*(?:trainer|jumlah\s+peserta|hadir|tidak\s+hadir|tambahan)\s*:?\s*|$)/is,
  );

  if (materiMatch?.[1]) {
    materi = parseMaterials(materiMatch[1]);
  }

  /**
   * =========================
   * JUMLAH PESERTA
   * =========================
   */

  const jumlahPesertaMatch = source.match(
    /jumlah\s+peserta\s*:?\s*([0-9.,]+)/i,
  );

  jumlahPeserta = parseNumber(
    jumlahPesertaMatch?.[1],
  );

  /**
   * =========================
   * HADIR
   * =========================
   */

  const hadirMatch = source.match(
    /(?:^|\n)\s*hadir\s*:?\s*([0-9.,]+)/i,
  );

  jumlahHadir = parseNumber(
    hadirMatch?.[1],
  );

  /**
   * =========================
   * TIDAK HADIR
   * =========================
   */

  const tidakHadirMatch = source.match(
    /(?:^|\n)\s*tidak\s+hadir\s*:?\s*([0-9.,]+)/i,
  );

  jumlahTidakHadir = parseNumber(
    tidakHadirMatch?.[1],
  );

  /**
   * =========================
   * TAMBAHAN
   * =========================
   *
   * Mendukung:
   *
   * Tambahan:-
   * Tambahan: -
   * Tambahan: 0
   * Tambahan: 2
   */

  const tambahanMatch = source.match(
    /(?:^|\n)\s*tambahan\s*:?\s*([0-9.,-]+)/i,
  );

  if (tambahanMatch?.[1]) {
    const rawTambahan =
      tambahanMatch[1].trim();

    if (
      rawTambahan === "-" ||
      rawTambahan === "–" ||
      rawTambahan === "—"
    ) {
      jumlahTambahan = 0;
    } else {
      jumlahTambahan =
        parseNumber(rawTambahan) ?? 0;
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
  status:
    | "matched"
    | "ambiguous"
    | "not_found";

  trainer:
    | WhatsAppTrainerCandidate
    | null;

  candidates: WhatsAppTrainerCandidate[];

  matchedBy:
    | "nomor_whatsapp"
    | "nama"
    | null;
};

/**
 * Cocokkan trainer.
 *
 * PRIORITAS:
 *
 * 1. Nomor WhatsApp
 * 2. Nama trainer
 *
 * Jadi nomor WA menjadi identitas utama.
 */

export function matchWhatsAppTrainer(
  trainerNama: string | null,
  nomorWhatsapp: string | null,
  trainers: WhatsAppTrainerCandidate[],
): TrainerMatchResult {
  /**
   * =========================
   * PRIORITAS 1
   * NOMOR WHATSAPP
   * =========================
   */

  const targetPhone =
    normalizeWhatsAppNumber(
      nomorWhatsapp,
    );

  if (targetPhone) {
    const phoneMatches =
      trainers.filter(
        (trainer) =>
          normalizeWhatsAppNumber(
            trainer.nomor_whatsapp,
          ) === targetPhone,
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

  /**
   * =========================
   * PRIORITAS 2
   * NAMA TRAINER
   * =========================
   */

  if (trainerNama) {
    const target =
      normalizeForMatch(trainerNama);

    /**
     * Cocok persis
     */

    const exactMatches =
      trainers.filter(
        (trainer) =>
          normalizeForMatch(
            trainer.nama_lengkap,
          ) === target,
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

    /**
     * Cocok sebagian
     */

    const containsMatches =
      trainers.filter((trainer) => {
        const name =
          normalizeForMatch(
            trainer.nama_lengkap,
          );

        return (
          name.includes(target) ||
          target.includes(name)
        );
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

  /**
   * Tidak ditemukan
   */

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

  status:
    | "matched"
    | "ambiguous"
    | "not_found";

  material:
    | WhatsAppMaterialCandidate
    | null;

  candidates: WhatsAppMaterialCandidate[];
};

/**
 * Cocokkan semua materi yang dikirim trainer
 * dengan Master Materi.
 */

export function matchWhatsAppMaterials(
  materiInput: string[],
  materials: WhatsAppMaterialCandidate[],
): MaterialMatch[] {
  return materiInput.map((input) => {
    const target =
      normalizeForMatch(input);

    /**
     * Cocok persis
     */

    const exactMatches =
      materials.filter(
        (material) =>
          normalizeForMatch(
            material.nama,
          ) === target,
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

    /**
     * Cocok sebagian
     */

    const containsMatches =
      materials.filter((material) => {
        const name =
          normalizeForMatch(
            material.nama,
          );

        return (
          name.includes(target) ||
          target.includes(name)
        );
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

  if (!report.trainerNama) {
    errors.push(
      "Nama trainer tidak ditemukan.",
    );
  }

  if (report.materi.length === 0) {
    errors.push(
      "Materi tidak ditemukan.",
    );
  }

  if (report.jumlahPeserta === null) {
    errors.push(
      "Jumlah peserta tidak ditemukan.",
    );
  }

  if (report.jumlahHadir === null) {
    errors.push(
      "Jumlah hadir tidak ditemukan.",
    );
  }

  if (
    report.jumlahTidakHadir === null
  ) {
    errors.push(
      "Jumlah tidak hadir tidak ditemukan.",
    );
  }

  /**
   * Hadir tidak boleh lebih besar
   * daripada jumlah peserta.
   */

  if (
    report.jumlahHadir !== null &&
    report.jumlahPeserta !== null &&
    report.jumlahHadir >
      report.jumlahPeserta
  ) {
    errors.push(
      "Jumlah hadir lebih besar daripada jumlah peserta.",
    );
  }

  /**
   * Tidak hadir tidak boleh lebih besar
   * daripada jumlah peserta.
   */

  if (
    report.jumlahTidakHadir !== null &&
    report.jumlahPeserta !== null &&
    report.jumlahTidakHadir >
      report.jumlahPeserta
  ) {
    errors.push(
      "Jumlah tidak hadir lebih besar daripada jumlah peserta.",
    );
  }

  /**
   * Validasi jumlah peserta.
   *
   * Hadir + Tidak Hadir harus sama
   * dengan Jumlah Peserta.
   *
   * Tambahan tidak dihitung sebagai
   * bagian dari peserta awal.
   */

  if (
    report.jumlahPeserta !== null &&
    report.jumlahHadir !== null &&
    report.jumlahTidakHadir !== null
  ) {
    const total =
      report.jumlahHadir +
      report.jumlahTidakHadir;

    if (
      total !== report.jumlahPeserta
    ) {
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
