ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS foto_url text;

INSERT INTO public.settings (key, value, keterangan)
VALUES ('branding', '{}'::jsonb, 'Gambar branding & tampilan (path storage)')
ON CONFLICT (key) DO NOTHING;

GRANT SELECT ON public.settings TO anon;
CREATE POLICY "branding dibaca publik" ON public.settings FOR SELECT TO anon USING (key = 'branding');

CREATE POLICY "branding dibaca publik" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = 'branding');
CREATE POLICY "branding dibaca login" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'branding');
CREATE POLICY "admin unggah branding" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin ubah branding" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin hapus branding" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));