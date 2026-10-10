import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { statusLabels } from "@/lib/auth";
import { FieldError } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "الملف الشخصي — منصة المهندس أحمد جمال" },
      { name: "description", content: "عدّل بياناتك الشخصية." },
      { property: "og:title", content: "الملف الشخصي — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "عدّل بياناتك الشخصية." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(me.profile?.full_name ?? "");
  const [phone, setPhone] = useState(me.profile?.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (fullName.trim().length < 3 || fullName.length > 120) errs["fullName"] = "الاسم لازم يكون بين ٣ و ١٢٠ حرف";
    if (phone && !/^\+?[0-9\s-]{7,20}$/.test(phone)) errs["phone"] = "رقم الموبايل غير صحيح";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    // Only these two fields are allowed for students; the database rejects others.
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() || null }).eq("id", me.userId);
    setSaving(false);
    if (error) return void toast.error("مقدرناش نحفظ التعديلات");
    toast.success("تم حفظ بياناتك");
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">الملف الشخصي</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-card-gradient p-4 text-sm">
        <div><p className="text-muted-foreground">البريد الإلكتروني</p><p dir="ltr" className="text-end font-medium">{me.profile?.email}</p></div>
        <div><p className="text-muted-foreground">حالة الحساب</p><p className="font-medium">{statusLabels[me.profile?.account_status ?? "pending"]}</p></div>
        {me.profile?.student_code && <div><p className="text-muted-foreground">كود الطالب</p><p className="font-medium">{me.profile.student_code}</p></div>}
      </div>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div><Label htmlFor="fn">الاسم بالكامل</Label><Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} /><FieldError msg={errors["fullName"]} /></div>
        <div><Label htmlFor="ph">رقم الموبايل</Label><Input id="ph" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /><FieldError msg={errors["phone"]} /></div>
        <Button type="submit" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</Button>
      </form>
    </div>
  );
}
