import { useQuery } from "@tanstack/react-query";
import { BookOpen, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequestAccess } from "@/components/RequestAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { gradeLabels } from "@/lib/auth";

/** Public preview of published courses; student's own grade first, others flagged. */
export function PublishedCourses() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-courses"],
    queryFn: async () => {
      const [{ data, error }, { data: u }] = await Promise.all([
        supabase
          .from("courses")
          .select("id,title,slug,description,thumbnail_url,grade")
          .eq("is_published", true)
          .order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      if (error) throw error;
      let myGrade: string | null = null;
      if (u.user) {
        const { data: p } = await supabase.from("profiles").select("grade").eq("id", u.user.id).maybeSingle();
        myGrade = p?.grade ?? null;
      }
      const list = (data ?? []).map((c) => ({ ...c, other: !!myGrade && !!c.grade && c.grade !== myGrade }));
      list.sort((a, b) => Number(a.other) - Number(b.other));
      return list;
    },
  });

  return (
    <section id="courses" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20">
      <h2 className="text-center font-display text-3xl font-bold">الكورسات المتاحة</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">المحتوى متاح للطلاب المعتمدين المسجلين في كل كورس</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        {isError && <p className="col-span-full text-center text-sm text-muted-foreground">تعذر تحميل الكورسات حالياً.</p>}
        {data?.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">الكورسات هتنزل قريب، تابعنا!</p>
        )}
        {data?.map((c) => (
          <article key={c.id} className={`flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card-gradient ${c.other ? "opacity-70" : ""}`}>
            {c.thumbnail_url ? (
              <img src={c.thumbnail_url} alt="" className="aspect-video w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-primary/10"><BookOpen className="size-10 text-primary" /></div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap gap-2">
                {c.grade && <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary">{gradeLabels[c.grade] ?? c.grade}</span>}
                {c.other && <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs text-warning">مش لصفك</span>}
              </div>
              <h3 className="mt-2 font-display text-lg font-bold">{c.title}</h3>
              <p className="mt-2 line-clamp-3 flex-1 whitespace-pre-line text-sm text-muted-foreground">{c.description}</p>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="size-3.5 text-primary" />بيتفتح بعد موافقة الإدارة</p>
              <div className="mt-3"><RequestAccess courseId={c.id} slug={c.slug} /></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
