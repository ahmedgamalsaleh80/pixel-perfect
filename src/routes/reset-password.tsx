import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth";
import { AuthCard, FieldError } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — منصة المهندس أحمد جمال" },
      { name: "description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة" },
      { property: "og:description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr("كلمة المرور لازم تكون ٨ أحرف على الأقل");
    if (pw !== confirm) return setErr("كلمتين المرور مش متطابقين");
    setErr(undefined);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return void toast.error(error.message.includes("session") ? "الرابط انتهت صلاحيته، اطلب رابط جديد" : authErrorMessage(error.message));
    toast.success("تم تغيير كلمة المرور بنجاح");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthCard title="تعيين كلمة مرور جديدة">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="pw">كلمة المرور الجديدة</Label>
          <Input id="pw" type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
          <Input id="confirm" type="password" dir="ltr" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <FieldError msg={err} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}</Button>
      </form>
    </AuthCard>
  );
}
