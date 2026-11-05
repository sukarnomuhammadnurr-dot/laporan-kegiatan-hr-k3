-- Hapus 3 policy lama pada storage.objects (bucket branding) yang mengizinkan
-- semua authenticated tanpa dibatasi admin: trainer_upload_photos (INSERT),
-- trainer_select_photos (SELECT), trainer_update_photos (UPDATE).
-- Bucket branding sudah punya policy admin (unggah/ubah/hapus) + baca login/publik.
DROP POLICY IF EXISTS "trainer_upload_photos" ON storage.objects;
DROP POLICY IF EXISTS "trainer_select_photos" ON storage.objects;
DROP POLICY IF EXISTS "trainer_update_photos" ON storage.objects;