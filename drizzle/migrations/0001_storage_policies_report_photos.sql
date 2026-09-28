CREATE POLICY "foto laporan dibaca pemilik atau staf"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'report-photos' AND (
    public.is_staff(auth.uid())
    OR (storage.foldername(name))[1] = public.current_trainer_id()::text
  )
);

CREATE POLICY "foto laporan diunggah pemilik atau staf"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'report-photos' AND (
    public.is_staff(auth.uid())
    OR (storage.foldername(name))[1] = public.current_trainer_id()::text
  )
);

CREATE POLICY "foto laporan dihapus pemilik atau admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'report-photos' AND (
    public.has_role(auth.uid(),'admin')
    OR (storage.foldername(name))[1] = public.current_trainer_id()::text
  )
);