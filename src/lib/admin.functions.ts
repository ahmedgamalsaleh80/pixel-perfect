import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  phone: z.string().trim().min(7).max(30),
  parentPhone: z.string().trim().min(7).max(30),
  grade: z.enum(["bac1", "bac2"]),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("مش مسموح: الحساب ده مش أدمن");
}

export const adminCreateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone, parent_phone: data.parentPhone, grade: data.grade },
    });
    if (error || !created.user) return { ok: false as const, error: error?.message ?? "error" };
    const id = created.user.id;
    const { error: pe } = await supabaseAdmin.from("profiles").upsert({ id, email: data.email, full_name: data.fullName, phone: data.phone, parent_phone: data.parentPhone, grade: data.grade, account_status: "approved" });
    if (pe) return { ok: false as const, error: pe.message };
    const { error: ce } = await supabaseAdmin.from("student_credentials").upsert({ user_id: id, password: data.password });
    if (ce) return { ok: false as const, error: ce.message };
    return { ok: true as const, id };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) return { ok: false as const, error: error.message };
    const { error: ce } = await supabaseAdmin.from("student_credentials").upsert({ user_id: data.userId, password: data.password, updated_at: new Date().toISOString() });
    if (ce) return { ok: false as const, error: ce.message };
    return { ok: true as const };
  });
