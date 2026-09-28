CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_trainer_id uuid;
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO v_trainer_id FROM public.trainers WHERE lower(email) = lower(NEW.email) AND user_id IS NULL LIMIT 1;
  IF v_trainer_id IS NOT NULL THEN
    UPDATE public.trainers SET user_id = NEW.id WHERE id = v_trainer_id;
  END IF;
  -- Semua akun baru = trainer. Admin/supervisor hanya ditetapkan lewat database.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'trainer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;