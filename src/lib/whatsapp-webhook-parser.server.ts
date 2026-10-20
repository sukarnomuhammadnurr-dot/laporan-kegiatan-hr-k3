/**
 * WhatsApp Report Parser (v3 — support KELAS + schedule matching)
 * ===============================================================
 * Dipakai di route: src/routes/api/public/whatsapp/webhook.ts
 */

export type ParsedWhatsAppReport = {
  trainerNama: string | null;
  materi: string[];
  kelas: string | null;
  tanggalKegiatan: string | null;    // ← BARU (YYYY-MM-DD)
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
  let kelas: string | null = null;
  let tanggalKegiatan: string | null = null;
  let jumlahPeserta: number | null = null;
  let jumlahHadir: number | null = null;
  let jumlahTidakHadir: number | null = null;
  let jumlahTambahan = 0;

  // TRAINER
  const trainerMatch = source.match(
    /\btrainer\s*:?\s*(.+?)(?=\s*(?:kelas|jumlah\s+peserta|total\s+peserta|hadir|tidak\s+hadir|tambahan)\s*:?\s*|$)/i,
  );
  if (trainerMatch?.[1]) {
    trainerNama = removeTrailingPunctuation(normalizeText(trainerMatch[1]));
  }

  // KELAS — support "Kelas : 2A" / "Kelas: 2A" / "Kelas 2A"
  const kelasMatch = source.match(
    /\bkelas\s*:?\s*([A-Za-z0-9][A-Za-z0-9\s\-]*?)(?=\s*(?:jumlah\s+peserta|total\s+peserta|hadir|tidak\s+hadir|tambahan|materi|trainer)\s*:?\s*|$)/i,
  );
    if (kelasMatch?.[1]) {
    kelas = removeTrailingPunctuation(normalizeText(kelasMatch[1]));
  }

  // TANGGAL KEGIATAN — format DD-MM-YYYY
  const tanggalMatch = source.match(
    /\btanggal\s*:?\s*(\d{1,2})[-\s](\d{1,2})[-\s](\d{2,4})/i,
  );

  if (tanggalMatch) {
    const day = Number(tanggalMatch[1]);
    const month = Number(tanggalMatch[2]);
    let year = Number(tanggalMatch[3]);

    // Kalau tahun 2 digit (26) → jadi 2026
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    // Validasi range
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      const pad = (n: number) => String(n).padStart(2, "0");
      tanggalKegiatan = `${year}-${pad(month)}-${pad(day)}`;
    } else {
      console.warn("Tanggal invalid:", tanggalMatch[0]);
    }
  }

  // MATERI
  const materiMatch = source.match(
    /\bmateri\s*:?\s*(.+?)(?=\s*(?:trainer|kelas|jumlah\s+peserta|total\s+peserta|hadir|tidak\s+hadir|tambahan)\s*:?\s*|$)/i,
  );
  if (materiMatch?.[1]) {
    materi = parseMaterials(materiMatch[1]);
  }

  // JUMLAH PESERTA
  const jumlahPesertaMatch = source.match(
    /\b(?:jumlah|total)\s+peserta\s*:?\s*([0-9.,]+)/i,
  );
  jumlahPeserta = parseNumber(jumlahPesertaMatch?.[1]);

  // HADIR
  const hadirMatch = source.match(/(?:^|\s)hadir\s*:?\s*([0-9.,]+)/i);
  jumlahHadir = parseNumber(hadirMatch?.[1]);

  // TIDAK HADIR
  const tidakHadirMatch = source.match(
    /\btidak\s+hadir\s*:?\s*([0-9.,]+)/i,
  );
  jumlahTidakHadir = parseNumber(tidakHadirMatch?.[1]);

  // TAMBAHAN
  const tambahanMatch = source.match(/\btambahan\s*:?\s*([0-9.,-]+|-)/i);
  if (tambahanMatch?.[1]) {
    const raw = tambahanMatch[1].trim();
    if (raw === "-" || raw === "–" || raw === "—") {
      jumlahTambahan = 0;
    } else {
      jumlahTambahan = parseNumber(raw) ?? 0;
    }
  }

    return {
    trainerNama,
    materi,
    kelas,
    tanggalKegiatan,
    jumlahPeserta,
    jumlahHadir,
    jumlahTidakHadir,
    jumlahTambahan,
  };
}

/* =========================
   TRAINER MATCHING
========================= */

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

/* =========================
   MATERIAL MATCHING
========================= */

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

/* =========================
   SCHEDULE MATCHING (BARU)
========================= */

export type WhatsAppScheduleCandidate = {
  id: string;
  nama_kegiatan: string;
  jam_mulai: string | null;
  jam_selesai: string | null;
  kelas: string | null;
  kategori: string | null;
  material_id: string | null;
  training_day_id: string | null;
  aktif: boolean;
};

export type ScheduleMatch = {
  schedule: WhatsAppScheduleCandidate | null;
  matchedBy: "materi" | null;
};

/**
 * Cari jadwal dari Master Jadwal berdasarkan materi WA.
 * Case-insensitive, fuzzy match (substring 2 arah).
 */
export function matchWhatsAppSchedule(
  materiInput: string[],
  schedules: WhatsAppScheduleCandidate[],
): ScheduleMatch {
  if (materiInput.length === 0) {
    return { schedule: null, matchedBy: null };
  }

  const aktifSchedules = schedules.filter((s) => s.aktif);
  if (aktifSchedules.length === 0) {
    return { schedule: null, matchedBy: null };
  }

  for (const materi of materiInput) {
    const target = normalizeForMatch(materi);
    if (!target) continue;

    // 1. Exact match
    const exact = aktifSchedules.filter(
      (s) => normalizeForMatch(s.nama_kegiatan) === target,
    );
    if (exact.length >= 1) {
      return { schedule: exact[0]!, matchedBy: "materi" };
    }

    // 2. Fuzzy match (substring 2 arah)
    const fuzzy = aktifSchedules.filter((s) => {
      const sName = normalizeForMatch(s.nama_kegiatan);
      return sName.includes(target) || target.includes(sName);
    });
    if (fuzzy.length >= 1) {
      return { schedule: fuzzy[0]!, matchedBy: "materi" };
    }
  }

  return { schedule: null, matchedBy: null };
}

/* =========================
   VALIDASI
========================= */

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
