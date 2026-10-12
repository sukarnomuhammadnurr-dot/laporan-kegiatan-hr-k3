/**
 * WhatsApp Report Parser (Cloudflare version)
 */

export type ParsedWhatsAppReport = {
  trainerNama: string | null;
  materi: string[];
  jumlahPeserta: number | null;
  jumlahHadir: number | null;
  jumlahTidakHadir: number | null;
  jumlahTambahan: number;
};

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

export function normalizeWhatsAppNumber(value: string | null | undefined) {
  if (!value) return "";
  let phone = value.replace(/\D/g, "");
  if (phone.startsWith("0")) {
    phone = `62${phone.slice(1)}`;
  }
  return phone;
}

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

function parseMaterials(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((item) => removeTrailingPunctuation(normalizeText(item)))
    .filter(Boolean);
}

export function parseWhatsAppReport(text: string): ParsedWhatsAppReport {
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

  const trainerMatch = source.match(
    /\btrainer\s*:?\s*(.+?)(?=\s*(?:jumlah\s+peserta|total\s+peserta|hadir|tidak\s+hadir|tambahan)\s*:?\s*|$)/i,
  );

  if (trainerMatch?.[1]) {
    trainerNama = removeTrailingPunctuation(normalizeText(trainerMatch[1]));
  }

  const materiMatch = source.match(
    /\bmateri\s*:?\s*(.+?)(?=\s*(?:trainer|jumlah\s+peserta|total\s+peserta|hadir|tidak\s+hadir|tambahan)\s*:?\s*|$)/i,
  );

  if (materiMatch?.[1]) {
    materi = parseMaterials(materiMatch[1]);
  }

  const jumlahPesertaMatch = source.match(
    /\b(?:jumlah|total)\s+peserta\s*:?\s*([0-9.,]+)/i,
  );
  jumlahPeserta = parseNumber(jumlahPesertaMatch?.[1]);

  const hadirMatch = source.match(/(?:^|\s)hadir\s*:?\s*([0-9.,]+)/i);
  jumlahHadir = parseNumber(hadirMatch?.[1]);

  const tidakHadirMatch = source.match(
    /\btidak\s+hadir\s*:?\s*([0-9.,]+)/i,
  );
  jumlahTidakHadir = parseNumber(tidakHadirMatch?.[1]);

  const tambahanMatch = source.match(
    /\btambahan\s*:?\s*([0-9.,-]+|-)/i,
  );

  if (tambahanMatch?.[1]) {
    const rawTambahan = tambahanMatch[1].trim();
    if (rawTambahan === "-" || rawTambahan === "–" || rawTambahan === "—") {
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
  const targetPhone = normalizeWhatsAppNumber(nomorWhatsapp);

  if (targetPhone) {
    const phoneMatches = trainers.filter(
      (t) => normalizeWhatsAppNumber(t.nomor_whatsapp) === targetPhone,
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

  if (trainerNama) {
    const target = normalizeForMatch(trainerNama);

    const exactMatches = trainers.filter(
      (t) => normalizeForMatch(t.nama_lengkap) === target,
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

    const containsMatches = trainers.filter((t) => {
      const name = normalizeForMatch(t.nama_lengkap);
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
      (m) => normalizeForMatch(m.nama) === target,
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

    const containsMatches = materials.filter((m) => {
      const name = normalizeForMatch(m.nama);
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

export function validateParsedWhatsAppReport(report: ParsedWhatsAppReport) {
  const errors: string[] = [];

  if (!report.trainerNama) errors.push("Nama trainer tidak ditemukan.");
  if (report.materi.length === 0) errors.push("Materi tidak ditemukan.");
  if (report.jumlahPeserta === null)
    errors.push("Jumlah peserta tidak ditemukan.");
  if (report.jumlahHadir === null) errors.push("Jumlah hadir tidak ditemukan.");
  if (report.jumlahTidakHadir === null)
    errors.push("Jumlah tidak hadir tidak ditemukan.");

  return {
    valid: errors.length === 0,
    errors,
  };
}
