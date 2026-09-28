import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Trainer = Database["public"]["Tables"]["trainers"]["Row"];

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      if (!active) return;
      setSession(d.session);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

/** Peran, profil, dan data trainer milik pengguna yang sedang masuk. */
export function useCurrentUser() {
  const { session, loading } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["current-user", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [roles, profile, trainer] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId!),
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("trainers").select("*").eq("user_id", userId!).maybeSingle(),
      ]);
      return {
        roles: (roles.data ?? []).map((r) => r.role as AppRole),
        profile: profile.data,
        trainer: (trainer.data ?? null) as Trainer | null,
      };
    },
  });

  const roles = query.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isSupervisor = roles.includes("supervisor");

  return {
    session,
    user: session?.user ?? null,
    loading: loading || (!!userId && query.isLoading),
    roles,
    isAdmin,
    isSupervisor,
    isStaff: isAdmin || isSupervisor,
    isTrainer: roles.includes("trainer"),
    profile: query.data?.profile ?? null,
    trainer: query.data?.trainer ?? null,
    nama:
      query.data?.trainer?.nama_lengkap ??
      query.data?.profile?.nama_lengkap ??
      session?.user.email ??
      "",
  };
}
