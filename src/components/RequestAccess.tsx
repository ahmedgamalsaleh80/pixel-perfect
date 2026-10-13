import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Shows enrol status for a course and lets a signed-in student request access. */
export function RequestAccess({ courseId, slug }: { courseId: string; slug: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["access", courseId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { user: null as string | null, enrolled: false, req: null as string | null };
      const [{ count }, { data: r }] = await Promise.all([
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("student_id", u.user.id),
        supabase.from("enrollment_requests").select("status").eq("course_id", courseId).eq("student_id", u.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { user: u.user.id, enrolled: !!count, req: r?.status ?? null };
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("enrollment_requests").insert({ course_id: courseId, student_id: q.data!.user!, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("طلبك اتبعت، هيتفتحلك الكورس بعد موافقة الإدارة"); qc.invalidateQueries({ queryKey: ["access", courseId] }); },
    onError: () => toast.error("مقدرناش نبعت الطلب، يمكن بعته قبل كده"),
  });

  if (q.isLoading) return null;
  if (!q.data?.user) return <Button asChild size="sm" variant="outline"><Link to="/login">سجّل دخولك لطلب فتح الكورس</Link></Button>;
  if (q.data.enrolled) return <Button asChild size="sm"><Link to="/courses/$slug" params={{ slug }}>ادخل الكورس</Link></Button>;
  if (q.data.req === "pending") return <p className="text-sm text-warning">طلبك قيد المراجعة</p>;
  return (
    <div className="space-y-1">
      {q.data.req === "rejected" && <p className="text-xs text-destructive">طلبك السابق اترفض</p>}
      <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>اطلب فتح الكورس</Button>
    </div>
  );
}
