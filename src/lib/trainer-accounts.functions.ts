import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function pastikanAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Hanya Admin yang dapat mengelola akun trainer.");
}

async function ambilTrainer(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase
    .from("trainers").select("id, user_id, nama_lengkap, email").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Data trainer tidak ditemukan.");
  return data as { id: string; user_id: string | null; nama_lengkap: string; email: string | null };
}

export const buatAkunTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ trainerId: z.string().uuid(), email: z.string().trim().toLowerCase().email(), password: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await pastikanAdmin(context);
    const t = await ambilTrainer(context, data.trainerId);
    if (t.user_id) throw new Error("Trainer ini sudah memiliki akun login.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bentrok } = await supabaseAdmin
      .from("trainers").select("id").ilike("email", data.email).neq("id", t.id);
    if (bentrok?.length) throw new Error("Email sudah digunakan oleh trainer lain.");

    // Simpan email di data trainer lebih dulu agar trigger pendaftaran menautkannya.
    await supabaseAdmin.from("trainers").update({ email: data.email }).eq("id", t.id);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nama_lengkap: t.nama_lengkap, wajib_ganti_password: true },
    });
    if (error || !created.user) {
      const m = (error?.message ?? "").toLowerCase();
      if (m.includes("already") || m.includes("exists")) throw new Error("Email sudah digunakan oleh akun lain.");
      throw new Error("Gagal membuat akun. Silakan coba lagi.");
    }
    const uid = created.user.id;
    await supabaseAdmin.from("trainers").update({ user_id: uid, role: "trainer", akun_aktif: true }).eq("id", t.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).neq("role", "trainer");
    await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "trainer" }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("audit_logs").insert({
      table_name: "trainers", record_id: t.id, aksi: "BUAT_AKUN", actor_id: context.userId,
      data_sesudah: { email: data.email, user_id: uid },
    });
    return { ok: true };
  });

export const ubahStatusAkun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trainerId: z.string().uuid(), aktif: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await pastikanAdmin(context);
    const t = await ambilTrainer(context, data.trainerId);
    if (!t.user_id) throw new Error("Trainer belum memiliki akun.");
    if (t.user_id === context.userId) throw new Error("Tidak dapat menonaktifkan akun Anda sendiri.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(t.user_id, {
      ban_duration: data.aktif ? "none" : "876000h",
    });
    if (error) throw new Error("Gagal mengubah status akun.");
    await supabaseAdmin.from("trainers").update({ akun_aktif: data.aktif }).eq("id", t.id);
    await supabaseAdmin.from("audit_logs").insert({
      table_name: "trainers", record_id: t.id, aksi: data.aktif ? "AKTIFKAN_AKUN" : "NONAKTIFKAN_AKUN", actor_id: context.userId,
    });
    return { ok: true };
  });


export const hapusAkunTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ trainerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await pastikanAdmin(context);
    const t = await ambilTrainer(context, data.trainerId);
    if (!t.user_id) throw new Error("Trainer belum memiliki akun.");
    if (t.user_id === context.userId) {
      throw new Error("Tidak dapat menghapus akun Anda sendiri.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Hapus dari auth.users (otomatis hapus identities, sessions, dst)
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(t.user_id);
    if (authErr) throw new Error(`Gagal menghapus akun: ${authErr.message}`);

    // Reset user_id & akun_aktif di trainers
    await supabaseAdmin
      .from("trainers")
      .update({ user_id: null, akun_aktif: false })
      .eq("id", t.id);

    // Hapus user_roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", t.user_id);

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      table_name: "trainers",
      record_id: t.id,
      aksi: "HAPUS_AKUN",
      actor_id: context.userId,
      data_sesudah: { user_id: t.user_id },
    });

    return { ok: true };
  });

export const setPasswordSementara = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ trainerId: z.string().uuid(), password: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await pastikanAdmin(context);
    const t = await ambilTrainer(context, data.trainerId);
    if (!t.user_id) throw new Error("Trainer belum memiliki akun.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(t.user_id, {
      password: data.password,
      user_metadata: { wajib_ganti_password: true },
    });
    if (error) throw new Error("Gagal mengatur password sementara.");
    await supabaseAdmin.from("audit_logs").insert({
      table_name: "trainers", record_id: t.id, aksi: "RESET_PASSWORD", actor_id: context.userId,
    });
    return { ok: true };
  });
