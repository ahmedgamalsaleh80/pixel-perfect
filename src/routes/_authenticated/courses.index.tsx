import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { fetchMyCourses } from "@/lib/courses";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/States";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({
    meta: [
      { title: "كورساتي — منصة المهندس أحمد جمال" },
      { name: "description", content: "الكورسات المتاحة لك على المنصة." },
      { property: "og:title", content: "كورساتي — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "الكورسات المتاحة لك على المنصة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoursesPage,
});

function CoursesPage() {
  const { me } = Route.useRouteContext();
  const q = useQuery({ queryKey: ["my-courses", me.userId], queryFn: () => fetchMyCourses(me.userId) });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">كورساتي</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {q.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        {q.data?.map((c) => (
          <Link key={c.id} to="/courses/$slug" params={{ slug: c.slug }} className="overflow-hidden rounded-2xl border border-border/60 bg-card-gradient transition-colors hover:border-primary/50">
            {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-primary/10"><BookOpen className="size-10 text-primary" /></div>}
            <div className="p-5">
              <h2 className="font-display text-lg font-bold">{c.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              <Progress value={c.percent} className="mt-4" />
              <p className="mt-2 text-xs text-muted-foreground">{c.completed} / {c.total} درس · {c.percent}%</p>
            </div>
          </Link>
        ))}
      </div>
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <EmptyState title="مفيش كورسات متاحة ليك حالياً" body="تواصل مع الإدارة لو محتاج تتسجل في كورس." />}
    </div>
  );
}
