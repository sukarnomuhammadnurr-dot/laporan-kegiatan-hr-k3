DROP POLICY IF EXISTS "authenticated_upload_branding" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select_branding" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_branding" ON storage.objects;
DROP POLICY IF EXISTS "trainer_upload_photos" ON storage.objects;
DROP POLICY IF EXISTS "trainer_select_photos" ON storage.objects;
DROP POLICY IF EXISTS "trainer_update_photos" ON storage.objects;
CREATE POLICY "foto trainer diunggah admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trainer-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "foto trainer diubah admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trainer-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'trainer-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "foto trainer dibaca staf" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trainer-photos' AND public.is_staff(auth.uid()));