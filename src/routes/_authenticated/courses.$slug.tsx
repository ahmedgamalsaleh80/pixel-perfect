import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ClipboardList, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/States";
import { RequestAccess } from "@/components/RequestAccess";
import { NotFoundPage } from "../not-found";

export const Route = createFileRoute("/_authenticated/courses/$slug")({
  head: () => ({
    meta: [
      { title: "تفاصيل الكورس — منصة المهندس أحمد جمال" },
      { name: "description", content: "دروس الكورس بالترتيب ومتابعة تقدمك." },
      { property: "og:title", content: "تفاصيل الكورس — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "دروس الكورس بالترتيب." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoursePage,
});

function CoursePage() {
  const { slug } = Route.useParams();
  const { me } = Route.useRouteContext();
  const q = useQuery({
    queryKey: ["course", slug],
    queryFn: async () => {
      const { data: course, error } = await supabase.from("courses").select("id,title,description,is_published").eq("slug", slug).maybeSingle();
      if (error) throw error;
      if (!course) return null;
      const [{ data: lessons, error: le }, { data: progress }] = await Promise.all([
        supabase.from("lessons").select("id,title,description,lesson_order,is_published").eq("course_id", course.id).order("lesson_order"),
        supabase.from("lesson_progress").select("lesson_id").eq("student_id", me.userId).eq("is_completed", true),
      ]);
      if (le) throw le;
      // RLS returns no lessons unless the student is approved + enrolled (admins see all)
      if (!me.isAdmin && (lessons ?? []).length === 0) {
        const { count } = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", course.id).eq("student_id", me.userId);
        if (!count) return { course, locked: true as const, lessons: [], quizzes: [], done: new Set<string>() };
      }
      const { data: quizzes } = await supabase.from("quizzes").select("id,title,is_published").eq("course_id", course.id).order("created_at");
      return { course, locked: false as const, quizzes: quizzes ?? [], lessons: lessons ?? [], done: new Set((progress ?? []).map((p) => p.lesson_id)) };
    },
  });

  if (q.isLoading) return <div className="mx-auto max-w-4xl space-y-3 px-4 py-10"><Skeleton className="h-10 w-1/2" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (q.isError) return <div className="mx-auto max-w-4xl px-4 py-10"><ErrorState onRetry={() => q.refetch()} /></div>;
  if (!q.data) return <NotFoundPage />;
  const { course, lessons, done, quizzes, locked } = q.data;
  if (locked) return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{course.title}</h1>
      <p className="mt-2 text-muted-foreground">{course.description}</p>
      <div className="mt-6 rounded-xl border border-border/60 bg-card-gradient p-6"><p className="mb-3">الكورس ده مقفول عليك لحد ما الإدارة توافق.</p><RequestAccess courseId={course.id} slug={slug} /></div>
    </div>
  );
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const pct = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/courses" className="text-sm text-primary hover:underline">→ كورساتي</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">{course.title}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{course.description}</p>
      <div className="mt-6 rounded-xl border border-border/60 bg-card-gradient p-4">
        <div className="flex justify-between text-sm"><span>تقدمك</span><span className="font-semibold text-primary">{pct}%</span></div>
        <Progress value={pct} className="mt-2" />
      </div>
      <h2 className="mt-8 font-display text-xl font-bold">الدروس</h2>
      {lessons.length === 0 ? (
        <div className="mt-4"><EmptyState title="لسه مفيش دروس منشورة في الكورس ده" /></div>
      ) : (
        <ol className="mt-4 space-y-2">
          {lessons.map((l, i) => (
            <li key={l.id}>
              <Link to="/lessons/$id" params={{ id: l.id }} className="flex items-center gap-4 rounded-xl border border-border/60 bg-card-gradient p-4 transition-colors hover:border-primary/50">
                {done.has(l.id) ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="مكتمل" /> : <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="غير مكتمل" />}
                <span className="text-sm text-muted-foreground">{i + 1}</span>
                <span className="flex-1 font-medium">{l.title}{!l.is_published && <span className="ms-2 text-xs text-warning">(غير منشور)</span>}</span>
                <PlayCircle className="size-5 text-primary" />
              </Link>
            </li>
          ))}
        </ol>
      )}
      {quizzes.length > 0 && (<>
        <h2 className="mt-8 font-display text-xl font-bold">الامتحانات والكويزات</h2>
        <ul className="mt-4 space-y-2">
          {quizzes.map((z) => (
            <li key={z.id}><Link to="/quizzes/$id" params={{ id: z.id }} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card-gradient p-4 hover:border-primary/50"><ClipboardList className="size-5 text-primary" /><span className="flex-1 font-medium">{z.title}</span>{!z.is_published && <span className="text-xs text-warning">(غير منشور)</span>}</Link></li>
          ))}
        </ul>
      </>)}
    </div>
  );
}
