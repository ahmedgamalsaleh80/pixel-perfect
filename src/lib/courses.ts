import { supabase } from "@/integrations/supabase/client";

/** Courses the current student can access (RLS returns only allowed rows). */
export async function fetchMyCourses(userId: string) {
  const { data: enr, error } = await supabase
    .from("enrollments")
    .select("course_id, courses(id,title,slug,description,thumbnail_url,is_published)")
    .eq("student_id", userId);
  if (error) throw error;
  const courses = (enr ?? []).map((e) => e.courses).filter((c): c is NonNullable<typeof c> => !!c && c.is_published);
  if (!courses.length) return [];
  const ids = courses.map((c) => c.id);
  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabase.from("lessons").select("id,course_id,lesson_order,title").in("course_id", ids).order("lesson_order"),
    supabase.from("lesson_progress").select("lesson_id,is_completed").eq("student_id", userId).eq("is_completed", true),
  ]);
  const done = new Set((progress ?? []).map((p) => p.lesson_id));
  return courses.map((c) => {
    const ls = (lessons ?? []).filter((l) => l.course_id === c.id);
    const completed = ls.filter((l) => done.has(l.id)).length;
    const next = ls.find((l) => !done.has(l.id)) ?? ls[0];
    return { ...c, total: ls.length, completed, percent: ls.length ? Math.round((completed / ls.length) * 100) : 0, nextLesson: next };
  });
}
