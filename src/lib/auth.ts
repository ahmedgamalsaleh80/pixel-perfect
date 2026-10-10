import { useEffect, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AccountStatus = Database["public"]["Enums"]["account_status"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type Me = { userId: string; profile: Profile | null; isAdmin: boolean };

/** Reads the current user's profile and admin flag. UI hint only — the database enforces access. */
export async function fetchMe(): Promise<Me | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", u.user.id),
  ]);
  return {
    userId: u.user.id,
    profile: profile ?? null,
    isAdmin: !!roles?.some((r) => r.role === "admin"),
  };
}

export const meQuery = queryOptions({ queryKey: ["me"], queryFn: fetchMe, staleTime: 30_000 });

export function useMe() {
  return useQuery(meQuery);
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export const statusLabels: Record<AccountStatus, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  suspended: "موقوف",
};

/** Arabic translation of common auth errors. */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (m.includes("email not confirmed")) return "لازم تأكد بريدك الإلكتروني الأول من الرسالة اللي وصلتك";
  if (m.includes("already registered")) return "البريد ده مسجل بالفعل، جرّب تسجيل الدخول";
  if (m.includes("password")) return "كلمة المرور ضعيفة أو غير مقبولة، استخدم ٨ أحرف على الأقل";
  if (m.includes("rate limit")) return "محاولات كتير، استنى شوية وجرّب تاني";
  return "حصل خطأ، حاول مرة تانية";
}
