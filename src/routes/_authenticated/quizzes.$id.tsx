import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { NotFoundPage } from "../not-found";

export const Route = createFileRoute("/_authenticated/quizzes/$id")({
  head: () => ({
    meta: [
      { title: "امتحان — منصة المهندس أحمد جمال" },
      { name: "description", content: "حل الامتحان واعرف درجتك." },
      { property: "og:title", content: "امتحان — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "حل الامتحان واعرف درجتك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { id } = Route.useParams();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const q = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("id,title,description,duration_minutes,courses(slug,title),quiz_questions(id,question,options,question_order)").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: attempts } = await supabase.from("quiz_attempts").select("score,total,created_at").eq("quiz_id", id).order("created_at", { ascending: false });
      return { ...data, questions: [...(data.quiz_questions ?? [])].sort((a, b) => a.question_order - b.question_order), attempts: attempts ?? [] };
    },
  });
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || result) return;
    if (left <= 0) { if (!submit.isPending) { toast.info("الوقت خلص، اتسلمت إجاباتك"); submit.mutate(); } return; }
    const t = setTimeout(() => setLeft((v) => (v ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result]);
  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("submit_quiz", { _quiz_id: id, _answers: answers });
      if (error) throw error;
      return data as unknown as { score: number; total: number };
    },
    onSuccess: (r) => { setResult(r); setLeft(null); q.refetch(); },
    onError: () => toast.error("مقدرناش نسجل إجاباتك، حاول تاني"),
  });

  if (q.isLoading) return <div className="mx-auto max-w-3xl space-y-3 px-4 py-10"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /></div>;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState onRetry={() => q.refetch()} /></div>;
  if (!q.data) return <NotFoundPage />;
  const z = q.data;
  const allAnswered = z.questions.every((x) => answers[x.id] !== undefined);
  const timed = !!z.duration_minutes && !result;
  if (timed && !started) return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-center">
      <h1 className="font-display text-3xl font-bold">{z.title}</h1>
      {z.description && <p className="mt-2 text-muted-foreground">{z.description}</p>}
      <p className="mt-6 text-lg">مدة الامتحان: <b>{z.duration_minutes} دقيقة</b> — الإجابات هتتسلم تلقائي لما الوقت يخلص.</p>
      <Button className="mt-6" onClick={() => { setStarted(true); setLeft(z.duration_minutes! * 60); }}>ابدأ الامتحان</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {z.courses && <Link to="/courses/$slug" params={{ slug: z.courses.slug }} className="text-sm text-primary hover:underline">→ {z.courses.title}</Link>}
      <h1 className="mt-3 font-display text-3xl font-bold">{z.title}</h1>
      {z.description && <p className="mt-2 text-muted-foreground">{z.description}</p>}
      {timed && left !== null && <div className={`sticky top-16 z-10 mt-4 rounded-lg border p-3 text-center font-bold ${left < 60 ? "border-destructive text-destructive" : "border-primary/50 text-primary"} bg-background`} dir="ltr">⏱ {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}</div>}
      {result && <div className="mt-6 rounded-xl border border-primary/50 bg-primary/10 p-5 text-center text-lg">درجتك: <b>{result.score} / {result.total}</b></div>}
      <ol className="mt-6 space-y-5">
        {z.questions.map((x, i) => (
          <li key={x.id} className="rounded-xl border border-border/60 bg-card-gradient p-5">
            <p className="font-semibold">{i + 1}. {x.question}</p>
            <div className="mt-3 space-y-2">
              {((x.options as string[]) ?? []).map((opt, oi) => (
                <label key={oi} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-3 hover:border-primary/50">
                  <input type="radio" name={x.id} checked={answers[x.id] === oi} onChange={() => setAnswers({ ...answers, [x.id]: oi })} />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-6 w-full" disabled={!allAnswered || submit.isPending || !!result} onClick={() => submit.mutate()}>{submit.isPending ? "جاري التصحيح..." : "تسليم الإجابات"}</Button>
      {z.attempts.length > 0 && (
        <div className="mt-8"><h2 className="font-display font-bold">محاولاتك السابقة</h2>
          {z.attempts.map((a, i) => <p key={i} className="mt-1 text-sm text-muted-foreground">{a.score}/{a.total} — {new Date(a.created_at).toLocaleDateString("ar-EG")}</p>)}
        </div>
      )}
    </div>
  );
}
