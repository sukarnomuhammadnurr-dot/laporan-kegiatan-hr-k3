-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'trainer');
CREATE TYPE public.report_status AS ENUM ('draft','menunggu_konfirmasi','terkirim','menunggu_verifikasi','terverifikasi','perlu_revisi');
CREATE TYPE public.report_source AS ENUM ('manual','whatsapp','import');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========== ROLES ==========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','supervisor'));
$$;

-- ========== TRAINERS ==========
CREATE TABLE public.trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nomor_id_trainer text NOT NULL UNIQUE,
  nama_lengkap text NOT NULL,
  departemen text NOT NULL DEFAULT 'HRD',
  jabatan text NOT NULL DEFAULT 'Trainer',
  status_trainer text NOT NULL DEFAULT 'Aktif',
  nomor_whatsapp text,
  email text,
  foto_profil text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainers TO authenticated;
GRANT ALL ON public.trainers TO service_role;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_trainer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.trainers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ========== MASTER MATERI ==========
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE,
  kategori text,
  aktif boolean NOT NULL DEFAULT true,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- ========== MASTER JENIS KEGIATAN ==========
CREATE TABLE public.activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE,
  keterangan text,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_types TO authenticated;
GRANT ALL ON public.activity_types TO service_role;
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

-- ========== HARI TRAINING ==========
CREATE TABLE public.training_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE,
  urutan int NOT NULL DEFAULT 1,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_days TO authenticated;
GRANT ALL ON public.training_days TO service_role;
ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;

-- ========== MASTER JADWAL ==========
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_day_id uuid REFERENCES public.training_days(id) ON DELETE SET NULL,
  urutan int NOT NULL DEFAULT 1,
  jam_mulai time,
  jam_selesai time,
  nama_kegiatan text NOT NULL,
  kelas text,
  kategori text,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  materi_lanjutan_dari text,
  aktif boolean NOT NULL DEFAULT true,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- ========== LAPORAN ==========
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  tanggal_kegiatan date NOT NULL,
  jam_mulai time,
  jam_selesai time,
  jam_perlu_konfirmasi boolean NOT NULL DEFAULT false,
  jenis_kegiatan text,
  materi text NOT NULL,
  kelas text,
  lokasi text,
  penanggung_jawab text,
  jumlah_peserta int NOT NULL DEFAULT 0,
  jumlah_hadir int NOT NULL DEFAULT 0,
  jumlah_tidak_hadir int NOT NULL DEFAULT 0,
  jumlah_tambahan int NOT NULL DEFAULT 0,
  keterangan text,
  sumber_laporan public.report_source NOT NULL DEFAULT 'manual',
  waktu_laporan_dikirim timestamptz,
  status_laporan public.report_status NOT NULL DEFAULT 'draft',
  catatan_revisi text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_trainer_tanggal ON public.reports (trainer_id, tanggal_kegiatan);
CREATE INDEX idx_reports_tanggal ON public.reports (tanggal_kegiatan);
CREATE INDEX idx_reports_status ON public.reports (status_laporan);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ========== FOTO ==========
CREATE TABLE public.report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nama_file text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_photos_report ON public.report_photos (report_id);
GRANT SELECT, INSERT, DELETE ON public.report_photos TO authenticated;
GRANT ALL ON public.report_photos TO service_role;
ALTER TABLE public.report_photos ENABLE ROW LEVEL SECURITY;

-- ========== VERIFIKASI ==========
CREATE TABLE public.report_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  verifier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hasil public.report_status NOT NULL,
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.report_verifications TO authenticated;
GRANT ALL ON public.report_verifications TO service_role;
ALTER TABLE public.report_verifications ENABLE ROW LEVEL SECURITY;

-- ========== AUDIT LOG ==========
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  aksi text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_sebelum jsonb,
  data_sesudah jsonb,
  alasan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_record ON public.audit_logs (table_name, record_id);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ========== WHATSAPP ==========
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text UNIQUE,
  nomor_pengirim text NOT NULL,
  nama_pengirim text,
  pesan text,
  caption text,
  media_url text,
  media_storage_path text,
  timestamp_pesan timestamptz,
  trainer_id uuid REFERENCES public.trainers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'baru',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  input_teks text,
  hasil jsonb NOT NULL,
  confidence numeric,
  fields_needing_confirmation text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_extractions TO authenticated;
GRANT ALL ON public.ai_extractions TO service_role;
ALTER TABLE public.ai_extractions ENABLE ROW LEVEL SECURITY;

-- ========== NOTIFIKASI ==========
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  judul text NOT NULL,
  pesan text,
  tipe text NOT NULL DEFAULT 'info',
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  dibaca boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications (user_id, dibaca);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ========== SETTINGS ==========
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  keterangan text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ========== POLICIES ==========
CREATE POLICY "profil sendiri dibaca" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profil sendiri diubah" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profil sendiri dibuat" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "role sendiri dibaca" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "trainer dibaca semua login" ON public.trainers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin kelola trainer" ON public.trainers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "materi dibaca semua login" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin kelola materi" ON public.materials FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "kegiatan dibaca semua login" ON public.activity_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin kelola kegiatan" ON public.activity_types FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "hari dibaca semua login" ON public.training_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin kelola hari" ON public.training_days FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "jadwal dibaca semua login" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin kelola jadwal" ON public.schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "laporan dibaca pemilik atau staf" ON public.reports FOR SELECT TO authenticated
  USING (trainer_id = public.current_trainer_id() OR public.is_staff(auth.uid()));
CREATE POLICY "trainer membuat laporan" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (trainer_id = public.current_trainer_id() OR public.is_staff(auth.uid()));
CREATE POLICY "laporan diubah pemilik atau staf" ON public.reports FOR UPDATE TO authenticated
  USING (trainer_id = public.current_trainer_id() OR public.is_staff(auth.uid()))
  WITH CHECK (trainer_id = public.current_trainer_id() OR public.is_staff(auth.uid()));
CREATE POLICY "laporan dihapus pemilik draft atau admin" ON public.reports FOR DELETE TO authenticated
  USING ((trainer_id = public.current_trainer_id() AND status_laporan = 'draft') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "foto dibaca pemilik atau staf" ON public.report_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND (r.trainer_id = public.current_trainer_id() OR public.is_staff(auth.uid()))));
CREATE POLICY "foto ditambah pemilik atau staf" ON public.report_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND (r.trainer_id = public.current_trainer_id() OR public.is_staff(auth.uid()))));
CREATE POLICY "foto dihapus pemilik atau admin" ON public.report_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND (r.trainer_id = public.current_trainer_id() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "verifikasi dibaca pemilik atau staf" ON public.report_verifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND (r.trainer_id = public.current_trainer_id() OR public.is_staff(auth.uid()))));
CREATE POLICY "staf membuat verifikasi" ON public.report_verifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "audit dibaca staf" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "audit ditulis login" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "wa dibaca staf" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "wa diubah staf" ON public.whatsapp_messages FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "ekstraksi dibaca login" ON public.ai_extractions FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "ekstraksi dibuat login" ON public.ai_extractions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "ekstraksi diubah pembuat" ON public.ai_extractions FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "notifikasi sendiri" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifikasi dibuat login" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifikasi diubah sendiri" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "pengaturan dibaca login" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin kelola pengaturan" ON public.settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== TRIGGERS ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_trainers_upd BEFORE UPDATE ON public.trainers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_materials_upd BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_activity_upd BEFORE UPDATE ON public.activity_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_schedules_upd BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_reports_upd BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- laporan: catat riwayat perubahan
CREATE OR REPLACE FUNCTION public.log_report_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (table_name, record_id, aksi, actor_id, data_sebelum, data_sesudah)
  VALUES ('reports', COALESCE(NEW.id, OLD.id), TG_OP, auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER t_reports_audit AFTER INSERT OR UPDATE OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.log_report_change();

-- user baru: buat profil, tautkan ke trainer via email, beri role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trainer_id uuid;
  v_is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO v_is_first;

  SELECT id INTO v_trainer_id FROM public.trainers WHERE lower(email) = lower(NEW.email) AND user_id IS NULL LIMIT 1;
  IF v_trainer_id IS NOT NULL THEN
    UPDATE public.trainers SET user_id = NEW.id WHERE id = v_trainer_id;
  END IF;

  IF v_is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'trainer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== SEED: TRAINER ==========
INSERT INTO public.trainers (nomor_id_trainer, nama_lengkap, departemen) VALUES
  ('8240728053','Sukarno M. Nur','HRD'),
  ('8220919121','Sahri M. Nur','HRD'),
  ('8220418071','Safin','HRD'),
  ('8240221203','Doni Payer','HRD'),
  ('8230206016','Risky Sandro Mogot','HRD'),
  ('8230716070','Sutamo Talib','HRD'),
  ('8240409103','Wa Ode Muliana','HRD'),
  ('8240124025','Fadel M. Intje','HRD'),
  ('8220418070','Sufri Hi. Rajak','HRD'),
  ('8220219001','AAN WIRA WAHYUDI','HRD');

-- ========== SEED: MATERI ==========
INSERT INTO public.materials (nama) VALUES
  ('Pengenalan Aturan-Aturan Selama Mengikuti Pelatihan'),
  ('Materi Peraturan Perusahaan / PKB'),
  ('Materi Kekerasan Seksual'),
  ('Materi Company Profile'),
  ('Materi Code of Conduct'),
  ('Smart Salary'),
  ('Media Sosial'),
  ('Pengarahan Apel Pulang Peserta'),
  ('Pengambilan APD'),
  ('Safety Riding'),
  ('K3 Umum'),
  ('Perilaku Safety'),
  ('Post Test Safety'),
  ('Pengoperasian Alat Berat'),
  ('Bekerja di Ketinggian & Pengelasan'),
  ('Environmental'),
  ('Apel Pagi'),
  ('Apel Pulang'),
  ('Pembagian Makan Siang'),
  ('Periksa Post Test');

-- ========== SEED: JENIS KEGIATAN ==========
INSERT INTO public.activity_types (nama) VALUES
  ('Apel'),('Materi Kelas'),('Post Test'),('Periksa Post Test'),('Pembagian Makan'),('Kegiatan Tambahan'),('Sosialisasi');

-- ========== SEED: HARI ==========
INSERT INTO public.training_days (nama, urutan) VALUES ('Hari 1',1), ('Hari 2',2), ('Hari Lainnya',3);

-- ========== SEED: JADWAL HARI 1 ==========
INSERT INTO public.schedules (training_day_id, urutan, jam_mulai, jam_selesai, nama_kegiatan, kategori)
SELECT d.id, v.urutan, v.mulai::time, v.selesai::time, v.nama, v.kategori
FROM public.training_days d,
(VALUES
  (1,'06:15','06:30','APEL PAGI K3-H1','Apel'),
  (2,'07:30','08:00','PENGENALAN ATURAN-ATURAN K3 DAN P2D','Materi Kelas'),
  (3,'08:00','10:00','MATERI PERATURAN PERUSAHAAN','Materi Kelas'),
  (4,'10:00','10:30','COMPANY PROFILE','Materi Kelas'),
  (5,'10:30','11:30','MATERI CODE OF CONDUCT','Materi Kelas'),
  (6,'11:30','12:00','POSTES PERATURAN PERUSAHAAN','Post Test'),
  (7,'12:00','12:30','PEMBAGIAN MAKAN SIANG','Pembagian Makan'),
  (8,'14:00','14:30','PERIKSA POST TEST PERATURAN PERUSAHAAN K3 H1','Periksa Post Test'),
  (9,'14:30','15:30','MATERI SMART SALARY','Materi Kelas'),
  (10,'15:00','16:00','MATERI MEDIA SOSIAL','Materi Kelas'),
  (11,'16:30','16:45','APEL PULANG K3-H1','Apel')
) AS v(urutan,mulai,selesai,nama,kategori)
WHERE d.nama = 'Hari 1';

-- ========== SEED: JADWAL HARI 2 ==========
INSERT INTO public.schedules (training_day_id, urutan, jam_mulai, jam_selesai, nama_kegiatan, kelas, kategori, materi_lanjutan_dari)
SELECT d.id, v.urutan, v.mulai::time, v.selesai::time, v.nama, v.kelas, v.kategori, v.lanjutan
FROM public.training_days d,
(VALUES
  (1,'06:00','07:00','APEL PAGI',NULL,'Apel',NULL),
  (2,'07:00','08:00','SAFETY RIDING',NULL,'Materi Kelas',NULL),
  (3,'08:10','10:10','K3 UMUM',NULL,'Materi Kelas',NULL),
  (4,'10:10','11:00','PERILAKU SAFETY',NULL,'Materi Kelas',NULL),
  (5,'11:00','11:50','POST TEST SAFETY',NULL,'Post Test',NULL),
  (6,'11:50','12:00','PEMBAGIAN MAKAN SIANG',NULL,'Pembagian Makan',NULL),
  (7,'14:00','15:30','PENGOPERASIAN ALAT BERAT','Kelas A','Materi Kelas',NULL),
  (8,'14:00','15:30','BEKERJA DI KETINGGIAN & PENGELASAN','Kelas B','Materi Kelas',NULL),
  (9,'15:30','16:30','ENVIRONMENTAL','Kelas B','Materi Kelas','BEKERJA DI KETINGGIAN & PENGELASAN'),
  (10,'16:30','16:50','APEL PULANG',NULL,'Apel',NULL)
) AS v(urutan,mulai,selesai,nama,kelas,kategori,lanjutan)
WHERE d.nama = 'Hari 2';

-- PERIKSA POST TEST Hari 2: jam belum ditentukan, admin mengisi
INSERT INTO public.schedules (training_day_id, urutan, jam_mulai, jam_selesai, nama_kegiatan, kategori, catatan)
SELECT d.id, 11, NULL, NULL, 'PERIKSA POST TEST SAFETY K3 H2', 'Periksa Post Test', 'Jam resmi belum ditentukan. Admin harus mengisi jam kegiatan.'
FROM public.training_days d WHERE d.nama = 'Hari 2';

-- Kegiatan tambahan (belum dikunci ke hari tertentu)
INSERT INTO public.schedules (training_day_id, urutan, jam_mulai, jam_selesai, nama_kegiatan, kategori, catatan)
SELECT d.id, 1, '16:30'::time, '17:00'::time, 'PENGARAHAN APEL PULANG PESERTA PENGAMBILAN APD', 'Kegiatan Tambahan', 'Kegiatan tambahan / configurable. Admin dapat menentukan berlaku untuk hari mana.'
FROM public.training_days d WHERE d.nama = 'Hari Lainnya';

-- ========== SEED: PENGATURAN ==========
INSERT INTO public.settings (key, value, keterangan) VALUES
  ('whatsapp_integration', '{"terhubung": false, "catatan": "Belum terhubung. Menunggu kredensial WhatsApp Business API."}'::jsonb, 'Status integrasi WhatsApp'),
  ('perusahaan', '{"nama":"PT IWIP","unit":"TRAINER DEVELOPMENT","judul_laporan":"LAPORAN KEGIATAN K3"}'::jsonb, 'Identitas laporan');