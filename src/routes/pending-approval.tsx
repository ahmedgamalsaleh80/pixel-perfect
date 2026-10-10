import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Ban, XCircle, CheckCircle2 } from "lucide-react";
import { useMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/pending-approval")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "حالة الحساب — منصة المهندس أحمد جمال" },
      { name: "description", content: "متابعة حالة مراجعة حسابك على المنصة." },
      { property: "og:title", content: "حالة الحساب — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "متابعة حالة مراجعة حسابك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendingPage,
});

const states = {
  pending: { icon: Clock, tone: "text-warning", title: "حسابك قيد المراجعة", body: "استلمنا طلبك، والإدارة هتراجع حسابك قريب. أول ما يتوافق عليه هتقدر تدخل على كورساتك." },
  rejected: { icon: XCircle, tone: "text-destructive", title: "تم رفض طلب التسجيل", body: "للأسف طلبك اترفض. لو شايف إن ده حصل بالغلط تواصل مع الإدارة." },
  suspended: { icon: Ban, tone: "text-destructive", title: "حسابك موقوف حالياً", body: "تم إيقاف الوصول للمحتوى مؤقتاً. تواصل مع الإدارة لمعرفة التفاصيل." },
  approved: { icon: CheckCircle2, tone: "text-success", title: "حسابك معتمد", body: "تقدر دلوقتي تدخل على كورساتك." },
} as const;

function PendingPage() {
  const { data: me, isLoading, refetch, isFetching } = useMe();
  if (isLoading) return <div className="mx-auto max-w-md px-4 py-24"><Skeleton className="h-60 w-full" /></div>;
  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-muted-foreground">سجّل دخولك الأول عشان تشوف حالة حسابك.</p>
        <Button asChild className="mt-4"><Link to="/login">تسجيل الدخول</Link></Button>
      </div>
    );
  }
  const status = me.profile?.account_status ?? "pending";
  const s = states[status];
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-hero-gradient px-4">
      <div className="max-w-md rounded-2xl border border-border/60 bg-card-gradient p-8 text-center">
        <s.icon className={`mx-auto size-12 ${s.tone}`} />
        <h1 className="mt-4 font-display text-2xl font-bold">{s.title}</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
        {status === "approved" || me.isAdmin ? (
          <Button asChild className="mt-6"><Link to={me.isAdmin ? "/admin" : "/dashboard"}>الذهاب للوحة التحكم</Link></Button>
        ) : (
          <Button variant="outline" className="mt-6" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "جاري التحقق..." : "تحديث الحالة"}</Button>
        )}
      </div>
    </div>
  );
}
