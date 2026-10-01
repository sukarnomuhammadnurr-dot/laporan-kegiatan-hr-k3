DROP POLICY IF EXISTS "notifikasi dibuat login" ON public.notifications;
CREATE POLICY "notifikasi dibuat sendiri atau staf" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "pengaturan dibaca login" ON public.settings;
CREATE POLICY "pengaturan dibaca login" ON public.settings
  FOR SELECT TO authenticated
  USING (key = 'branding' OR public.is_staff(auth.uid()));