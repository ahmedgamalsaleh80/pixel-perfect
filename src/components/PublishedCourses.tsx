import { useQuery } from "@tanstack/react-query";
import { BookOpen, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

/** Public preview of published courses (title/description only — lessons stay private). */
export function PublishedCourses() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,title,description,thumbnail_url")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
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
          <article key={c.id} className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card-gradient">
            {c.thumbnail_url ? (
              <img src={c.thumbnail_url} alt="" className="aspect-video w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-primary/10"><BookOpen className="size-10 text-primary" /></div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-lg font-bold">{c.title}</h3>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{c.description}</p>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="size-3.5 text-primary" />متاح بعد الموافقة والتسجيل في الكورس</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
