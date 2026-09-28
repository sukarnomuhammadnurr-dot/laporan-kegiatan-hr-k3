ALTER TABLE public.trainers ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'trainer';

UPDATE public.trainers t SET role = ur.role
FROM public.user_roles ur WHERE ur.user_id = t.user_id AND t.user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trainers_email_unique ON public.trainers (lower(email)) WHERE email IS NOT NULL AND email <> '';

CREATE OR REPLACE FUNCTION public.sync_trainer_role()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;
  -- Saat akun baru tertaut (user_id berubah), pertahankan role trainer dari master.
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() AND TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Tidak dapat mengubah role akun Anda sendiri.';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role <> NEW.role;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, NEW.role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_trainers_role_sync ON public.trainers;
CREATE TRIGGER t_trainers_role_sync AFTER INSERT OR UPDATE ON public.trainers
FOR EACH ROW EXECUTE FUNCTION public.sync_trainer_role();

DROP POLICY IF EXISTS "trainer dibaca semua login" ON public.trainers;
CREATE POLICY "trainer dibaca staf atau diri sendiri" ON public.trainers FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "trainer membuat laporan" ON public.reports;
CREATE POLICY "trainer aktif membuat laporan" ON public.reports FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff(auth.uid())
  OR (trainer_id = public.current_trainer_id()
      AND EXISTS (SELECT 1 FROM public.trainers t WHERE t.id = trainer_id AND t.aktif))
);