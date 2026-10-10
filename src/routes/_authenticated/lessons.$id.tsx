import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { driveEmbedUrl, driveViewUrl } from "@/lib/drive";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { NotFoundPage } from "../not-found";

export const Route = createFileRoute("/_authenticated/lessons/$id")({
  head: () => ({
    meta: [
      { title: "الدرس — منصة المهندس أحمد جمال" },
      { name: "description", content: "شاهد الدرس وتابع تقدمك." },
      { property: "og:title", content: "الدرس — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "شاهد الدرس وتابع تقدمك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LessonPage,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LessonPage() {
  const { id } = Route.useParams();
  const { me } = Route.useRouteContext();
  const qc = useQueryClient();
  const [watching, setWatching] = useState(false);

  // RLS only returns this row (and its video URL) when the user is an admin, or an
  // approved student enrolled in the published course and the lesson is published.
  const q = useQuery({
    queryKey: ["lesson", id],
    enabled: UUID_RE.test(id),
    queryFn: async () => {
      const { data: lesson, error } = await supabase
        .from("lessons")
        .select("id,title,description,video_url,resource_url,course_id,lesson_order,is_published,courses(title,slug)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!lesson) return null;
      const [{ data: siblings }, { data: prog }] = await Promise.all([
        supabase.from("lessons").select("id,lesson_order").eq("course_id", lesson.course_id).order("lesson_order"),
        supabase.from("lesson_progress").select("is_completed").eq("lesson_id", id).eq("student_id", me.userId).maybeSingle(),
      ]);
      const idx = (siblings ?? []).findIndex((s) => s.id === id);
      return { lesson, completed: !!prog?.is_completed, prev: siblings?.[idx - 1], next: siblings?.[idx + 1] };
    },
  });

  const toggle = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase
        .from("lesson_progress")
        .upsert({ lesson_id: id, student_id: me.userId, is_completed: value }, { onConflict: "student_id,lesson_id" });
      if (error) throw error;
    },
    onSuccess: (_d, value) => {
      toast.success(value ? "عاش! الدرس اتسجل كمكتمل" : "تم إلغاء إكمال الدرس");
      qc.invalidateQueries({ queryKey: ["lesson", id] });
      qc.invalidateQueries({ queryKey: ["my-courses"] });
      qc.invalidateQueries({ queryKey: ["course"] });
    },
    onError: () => toast.error("مقدرناش نحفظ التقدم، حاول تاني"),
  });

  if (!UUID_RE.test(id)) return <NotFoundPage />;
  if (q.isLoading) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-10"><Skeleton className="h-8 w-1/2" /><Skeleton className="aspect-video w-full" /></div>;
  if (q.isError) return <div className="mx-auto max-w-4xl px-4 py-10"><ErrorState onRetry={() => q.refetch()} /></div>;
  if (!q.data) return <NotFoundPage />;

  const { lesson, completed, prev, next } = q.data;
  const embed = lesson.video_url ? driveEmbedUrl(lesson.video_url) : null;
  const view = lesson.video_url ? driveViewUrl(lesson.video_url) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {lesson.courses && <Link to="/courses/$slug" params={{ slug: lesson.courses.slug }} className="text-sm text-primary hover:underline">→ {lesson.courses.title}</Link>}
      <h1 className="mt-3 font-display text-2xl font-bold md:text-3xl">{lesson.title}</h1>
      {me.isAdmin && !lesson.is_published && <p className="mt-2 text-sm text-warning">معاينة أدمن — الدرس ده غير منشور للطلاب</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card-gradient">
        {!embed ? (
          <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">الفيديو هيتاح قريب</div>
        ) : watching ? (
          <iframe src={embed} title={lesson.title} className="aspect-video w-full" allow="autoplay; fullscreen" allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-4">
            <Button size="lg" onClick={() => setWatching(true)}><PlayCircle className="size-5" />مشاهدة الدرس</Button>
          </div>
        )}
      </div>
      {watching && view && (
        <p className="mt-2 text-xs text-muted-foreground">
          الفيديو مش ظاهر؟ <a href={view} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">افتحه على Google Drive <ExternalLink className="size-3" /></a>
        </p>
      )}

      {lesson.description && <p className="mt-6 whitespace-pre-line leading-relaxed text-muted-foreground">{lesson.description}</p>}
      {lesson.resource_url && /^https:\/\//.test(lesson.resource_url) && (
        <a href={lesson.resource_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"><FileText className="size-4" />ملفات الدرس</a>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
        <Button variant={completed ? "outline" : "default"} onClick={() => toggle.mutate(!completed)} disabled={toggle.isPending}>
          <CheckCircle2 className="size-4" />{completed ? "إلغاء الإكمال" : "تم إنهاء الدرس"}
        </Button>
        <div className="flex gap-2">
          {prev && <Button asChild variant="ghost"><Link to="/lessons/$id" params={{ id: prev.id }}>الدرس السابق</Link></Button>}
          {next && <Button asChild variant="secondary"><Link to="/lessons/$id" params={{ id: next.id }}>الدرس التالي</Link></Button>}
        </div>
      </div>
    </div>
  );
}
