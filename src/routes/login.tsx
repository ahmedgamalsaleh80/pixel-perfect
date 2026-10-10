import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, fetchMe } from "@/lib/auth";
import { AuthCard, FieldError } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — منصة المهندس أحمد جمال" },
      { name: "description", content: "سجّل دخولك لمتابعة كورساتك على منصة المهندس أحمد جمال." },
      { property: "og:title", content: "تسجيل الدخول — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "سجّل دخولك لمتابعة كورساتك." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs["email"] = "اكتب بريد إلكتروني صحيح";
    if (!password) errs["password"] = "اكتب كلمة المرور";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      toast.error(authErrorMessage(error.message));
      return;
    }
    const me = await fetchMe();
    qc.setQueryData(["me"], me);
    setLoading(false);
    if (me?.isAdmin) navigate({ to: "/admin" });
    else if (me?.profile?.account_status === "approved") navigate({ to: "/dashboard" });
    else navigate({ to: "/pending-approval" });
  }

  return (
    <AuthCard title="أهلاً بيك تاني" subtitle="سجّل دخولك عشان تكمل كورساتك">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError msg={errors["email"]} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">كلمة المرور</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">نسيت كلمة المرور؟</Link>
          </div>
          <Input id="password" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <FieldError msg={errors["password"]} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "جاري الدخول..." : "تسجيل الدخول"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        معندكش حساب؟ <Link to="/register" className="font-semibold text-primary hover:underline">أنشئ حساب جديد</Link>
      </p>
    </AuthCard>
  );
}
