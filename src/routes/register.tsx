import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth";
import { AuthCard, FieldError } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "إنشاء حساب — منصة المهندس أحمد جمال" },
      { name: "description", content: "سجّل حساب طالب جديد على منصة المهندس أحمد جمال." },
      { property: "og:title", content: "إنشاء حساب — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "سجّل حساب طالب جديد وابدأ رحلتك في البرمجة." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.fullName.trim().length < 3) errs["fullName"] = "اكتب اسمك بالكامل (٣ أحرف على الأقل)";
    if (form.fullName.length > 120) errs["fullName"] = "الاسم طويل جداً";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs["email"] = "اكتب بريد إلكتروني صحيح";
    if (form.phone && !/^\+?[0-9\s-]{7,20}$/.test(form.phone)) errs["phone"] = "رقم الموبايل غير صحيح";
    if (form.password.length < 8) errs["password"] = "كلمة المرور لازم تكون ٨ أحرف على الأقل";
    if (form.password !== form.confirm) errs["confirm"] = "كلمتين المرور مش متطابقين";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/pending-approval`,
        data: { full_name: form.fullName.trim(), phone: form.phone.trim() },
      },
    });
    setLoading(false);
    if (error) return void toast.error(authErrorMessage(error.message));
    setDone(true);
  }

  if (done) {
    return (
      <AuthCard title="تم إنشاء حسابك" subtitle="خطوتين وتبدأ">
        <div className="space-y-4 text-center text-sm text-muted-foreground">
          <MailCheck className="mx-auto size-10 text-primary" />
          <p>بعتنالك رسالة تأكيد على <span dir="ltr" className="font-semibold text-foreground">{form.email}</span>. افتحها واضغط على رابط التأكيد.</p>
          <p>بعد التأكيد، حسابك هيكون <b className="text-warning">قيد المراجعة</b> لحد ما الإدارة توافق عليه.</p>
          <Button asChild variant="outline" className="w-full"><Link to="/login">الذهاب لتسجيل الدخول</Link></Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="إنشاء حساب جديد" subtitle="سجّل بياناتك وهيتم مراجعة حسابك من الإدارة">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="fullName">الاسم بالكامل</Label>
          <Input id="fullName" autoComplete="name" value={form.fullName} onChange={set("fullName")} />
          <FieldError msg={errors["fullName"]} />
        </div>
        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" dir="ltr" autoComplete="email" value={form.email} onChange={set("email")} />
          <FieldError msg={errors["email"]} />
        </div>
        <div>
          <Label htmlFor="phone">رقم الموبايل (اختياري)</Label>
          <Input id="phone" type="tel" dir="ltr" autoComplete="tel" value={form.phone} onChange={set("phone")} />
          <FieldError msg={errors["phone"]} />
        </div>
        <div>
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" type="password" dir="ltr" autoComplete="new-password" value={form.password} onChange={set("password")} />
          <FieldError msg={errors["password"]} />
        </div>
        <div>
          <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
          <Input id="confirm" type="password" dir="ltr" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
          <FieldError msg={errors["confirm"]} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        عندك حساب بالفعل؟ <Link to="/login" className="font-semibold text-primary hover:underline">سجّل دخولك</Link>
      </p>
    </AuthCard>
  );
}
