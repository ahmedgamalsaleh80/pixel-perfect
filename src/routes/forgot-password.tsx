import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth";
import { AuthCard, FieldError } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "استعادة كلمة المرور — منصة المهندس أحمد جمال" },
      { name: "description", content: "استعد كلمة المرور الخاصة بحسابك على المنصة." },
      { property: "og:title", content: "استعادة كلمة المرور — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "استعد كلمة المرور الخاصة بحسابك." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("اكتب بريد إلكتروني صحيح");
    setErr(undefined);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return void toast.error(authErrorMessage(error.message));
    setSent(true);
  }

  return (
    <AuthCard title="نسيت كلمة المرور؟" subtitle="اكتب بريدك وهنبعتلك رابط لتعيين كلمة مرور جديدة">
      {sent ? (
        <p className="text-center text-sm text-muted-foreground">لو البريد ده مسجل عندنا، هتوصلك رسالة فيها رابط إعادة التعيين خلال دقايق.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldError msg={err} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-primary hover:underline">الرجوع لتسجيل الدخول</Link></p>
    </AuthCard>
  );
}
