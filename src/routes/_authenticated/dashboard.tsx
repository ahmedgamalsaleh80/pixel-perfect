import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, CheckCircle2, BookOpen } from "lucide-react";
import { fetchMyCourses } from "@/lib/courses";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/States";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة الطالب — منصة المهندس أحمد جمال" },
      { name: "description", content: "تابع كورساتك وتقدمك في الدروس." },
      { property: "og:title", content: "لوحة الطالب — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "تابع كورساتك وتقدمك في الدروس." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { me } = Route.useRouteContext();
  const q = useQuery({ queryKey: ["my-courses", me.userId], queryFn: () => fetchMyCourses(me.userId) });
  const totalDone = q.data?.reduce((a, c) => a + c.completed, 0) ?? 0;
  const resume = q.data?.find((c) => c.percent < 100 && c.nextLesson) ?? q.data?.find((c) => c.nextLesson);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">أهلاً يا {me.profile?.full_name?.split(" ")[0] || "هندسة"} 👋</h1>
      <p className="mt-1 text-muted-foreground">نفهم قبل ما نبرمج — كمّل من مكان ما وقفت.</p>

      {resume?.nextLesson && (
        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-muted-foreground">كمّل التعلم</p>
            <p className="mt-1 font-display text-lg font-bold">{resume.nextLesson.title}</p>
            <p className="text-sm text-muted-foreground">{resume.title}</p>
          </div>
          <Button asChild><Link to="/lessons/$id" params={{ id: resume.nextLesson.id }}><PlayCircle className="size-4" />متابعة الدرس</Link></Button>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card-gradient p-5"><BookOpen className="size-5 text-primary" /><p className="mt-2 font-display text-2xl font-bold">{q.data?.length ?? "—"}</p><p className="text-sm text-muted-foreground">كورسات مسجل فيها</p></div>
        <div className="rounded-xl border border-border/60 bg-card-gradient p-5"><CheckCircle2 className="size-5 text-success" /><p className="mt-2 font-display text-2xl font-bold">{q.data ? totalDone : "—"}</p><p className="text-sm text-muted-foreground">دروس خلصتها</p></div>
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">كورساتي</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {q.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <EmptyState title="لسه مفيش كورسات متسجلة ليك" body="أول ما الإدارة تسجلك في كورس هيظهر هنا." />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {q.data?.map((c) => (
          <Link key={c.id} to="/courses/$slug" params={{ slug: c.slug }} className="rounded-2xl border border-border/60 bg-card-gradient p-5 transition-colors hover:border-primary/50">
            <h3 className="font-display font-bold">{c.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{c.completed} من {c.total} درس</p>
            <Progress value={c.percent} className="mt-3" aria-label={`نسبة الإنجاز ${c.percent}%`} />
            <p className="mt-2 text-xs font-semibold text-primary">{c.percent}%</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
