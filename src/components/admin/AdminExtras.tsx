import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Eye, EyeOff, KeyRound, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminCreateStudent, adminSetPassword } from "@/lib/admin.functions";
import { gradeLabels } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Student = { id: string; full_name: string; account_status: string };
type Course = { id: string; title: string };
type Enr = { id: string; student_id: string; course_id: string };

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin"] });
}

/* ---------- Bulk enroll ---------- */
export function BulkEnrollCard({ students, courses, enrollments, onChanged }: { students: Student[]; courses: (Course & { max_students?: number | null })[]; enrollments: Enr[]; onChanged: () => void }) {
  const [courseId, setCourseId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const { data: maxMap } = useQuery({
    queryKey: ["admin", "course-max"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id,max_students");
      return Object.fromEntries((data ?? []).map((c) => [c.id, c.max_students]));
    },
  });
  const enrolledIds = new Set(enrollments.filter((e) => e.course_id === courseId).map((e) => e.student_id));
  const max = courseId ? maxMap?.[courseId] ?? null : null;
  const remaining = max != null ? max - enrolledIds.size : null;
  const list = students.filter((s) => s.account_status === "approved" && !enrolledIds.has(s.id) && s.full_name.includes(filter));

  const run = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      if (remaining != null && ids.length > remaining) throw new Error(`فاضل ${remaining} مكان بس في الكورس`);
      const { error } = await supabase.from("enrollments").insert(ids.map((student_id) => ({ student_id, course_id: courseId })));
      if (error) throw new Error(error.message.includes("COURSE_FULL") ? "الكورس اكتمل العدد" : "فشل التسجيل");
    },
    onSuccess: () => { toast.success("تم فتح الكورس للطلاب المحددين"); setSelected(new Set()); onChanged(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>فتح كورس لمجموعة طلاب</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Select value={courseId} onValueChange={(v) => { setCourseId(v); setSelected(new Set()); }}>
          <SelectTrigger><SelectValue placeholder="اختار الكورس" /></SelectTrigger>
          <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
        {courseId && (
          <>
            <p className="text-sm text-muted-foreground">
              مسجلين: {enrolledIds.size}{max != null ? ` من ${max} — فاضل ${remaining}` : " (بدون حد أقصى)"} · محدد: {selected.size}
            </p>
            <Input placeholder="ابحث باسم الطالب" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {list.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={(v) => { const n = new Set(selected); v ? n.add(s.id) : n.delete(s.id); setSelected(n); }} />
                  {s.full_name || s.id}
                </label>
              ))}
              {!list.length && <p className="p-2 text-center text-sm text-muted-foreground">مفيش طلاب متاحين</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set(list.slice(0, remaining ?? list.length).map((s) => s.id)))}>تحديد الكل</Button>
              <Button onClick={() => run.mutate()} disabled={!selected.size || run.isPending}><Plus className="size-4" /> فتح الكورس ({selected.size})</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Requests ---------- */
export function RequestsTab() {
  const invalidate = useInvalidate();
  const q = useQuery({
    queryKey: ["admin", "requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollment_requests")
        .select("id,student_id,course_id,status,created_at,profiles(full_name,grade,phone),courses(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const decide = useMutation({
    mutationFn: async ({ r, ok }: { r: { id: string; student_id: string; course_id: string }; ok: boolean }) => {
      if (ok) {
        const { error } = await supabase.from("enrollments").insert({ student_id: r.student_id, course_id: r.course_id });
        if (error && !error.message.includes("duplicate")) throw new Error(error.message.includes("COURSE_FULL") ? "الكورس اكتمل العدد" : error.message);
      }
      const { error } = await supabase.from("enrollment_requests").update({ status: ok ? "approved" : "rejected" }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.ok ? "تم قبول الطلب وفتح الكورس" : "تم رفض الطلب"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const rows = q.data ?? [];
  const label: Record<string, string> = { pending: "منتظر", approved: "مقبول", rejected: "مرفوض" };
  return (
    <Card>
      <CardHeader><CardTitle>طلبات فتح الكورسات ({rows.filter((r) => r.status === "pending").length} منتظر)</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>الطالب</TableHead><TableHead>الصف</TableHead><TableHead>الكورس</TableHead><TableHead>الحالة</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.profiles?.full_name || "—"}</TableCell>
                <TableCell>{gradeLabels[r.profiles?.grade ?? ""] ?? "—"}</TableCell>
                <TableCell>{r.courses?.title}</TableCell>
                <TableCell><Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"}>{label[r.status]}</Badge></TableCell>
                <TableCell>
                  {r.status === "pending" && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => decide.mutate({ r, ok: true })}><Check className="size-4" /> قبول</Button>
                      <Button size="sm" variant="destructive" onClick={() => decide.mutate({ r, ok: false })}><X className="size-4" /> رفض</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">مفيش طلبات.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------- Add student + credentials ---------- */
export function AddStudentTab() {
  const invalidate = useInvalidate();
  const create = useServerFn(adminCreateStudent);
  const setPw = useServerFn(adminSetPassword);
  const empty = { fullName: "", email: "", password: "", phone: "", parentPhone: "", grade: "" };
  const [f, setF] = useState(empty);
  const [show, setShow] = useState<Record<string, boolean>>({});

  const list = useQuery({
    queryKey: ["admin", "students-full"],
    queryFn: async () => {
      const [{ data: ps }, { data: creds }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,phone,parent_phone,grade").order("created_at", { ascending: false }),
        supabase.from("student_credentials").select("user_id,password"),
      ]);
      const pw = Object.fromEntries((creds ?? []).map((c) => [c.user_id, c.password]));
      return (ps ?? []).map((p) => ({ ...p, password: pw[p.id] as string | undefined }));
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!f.grade) throw new Error("اختار الصف");
      const r = await create({ data: { ...f, grade: f.grade as "bac1" | "bac2" } });
      if (!r.ok) throw new Error(r.error.includes("already") ? "البريد ده مسجل بالفعل" : "فشل إنشاء الحساب");
    },
    onSuccess: () => { toast.success("تم إضافة الطالب واعتماده"); setF(empty); invalidate(); },
    onError: (e) => toast.error(e.message.includes("[") ? "راجع البيانات: كل الخانات مطلوبة وكلمة المرور ٨ أحرف على الأقل" : e.message),
  });

  const changePw = useMutation({
    mutationFn: async (userId: string) => {
      const password = window.prompt("اكتب كلمة المرور الجديدة (٨ أحرف على الأقل)");
      if (!password) return false;
      if (password.length < 8) throw new Error("كلمة المرور قصيرة");
      const r = await setPw({ data: { userId, password } });
      if (!r.ok) throw new Error("فشل تغيير كلمة المرور");
      return true;
    },
    onSuccess: (ok) => { if (ok) { toast.success("تم تغيير كلمة المرور"); invalidate(); } },
    onError: (e) => toast.error(e.message),
  });

  const field = (k: keyof typeof f, label: string, type = "text", ltr = true) => (
    <div>
      <Label htmlFor={`as-${k}`}>{label}</Label>
      <Input id={`as-${k}`} type={type} dir={ltr ? "ltr" : undefined} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>إضافة طالب يدوي</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {field("fullName", "الاسم بالكامل", "text", false)}
          {field("email", "البريد الإلكتروني", "email")}
          {field("password", "كلمة المرور")}
          {field("phone", "رقم الطالب", "tel")}
          {field("parentPhone", "رقم ولي الأمر", "tel")}
          <div>
            <Label>الصف</Label>
            <Select value={f.grade} onValueChange={(v) => setF({ ...f, grade: v })}>
              <SelectTrigger><SelectValue placeholder="اختار الصف" /></SelectTrigger>
              <SelectContent><SelectItem value="bac1">الصف الأول بكالوريا</SelectItem><SelectItem value="bac2">الصف الثاني بكالوريا</SelectItem></SelectContent>
            </Select>
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="size-4" /> إضافة الطالب</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>بيانات الطلاب وكلمات المرور</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الصف</TableHead><TableHead>الطالب / ولي الأمر</TableHead><TableHead>البريد</TableHead><TableHead>كلمة المرور</TableHead></TableRow></TableHeader>
            <TableBody>
              {(list.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.full_name || "—"}</TableCell>
                  <TableCell>{gradeLabels[s.grade ?? ""] ?? "—"}</TableCell>
                  <TableCell dir="ltr" className="text-right text-xs">{s.phone || "—"}<br />{s.parent_phone || "—"}</TableCell>
                  <TableCell dir="ltr" className="text-right text-xs">{s.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {s.password ? (
                        <>
                          <span dir="ltr" className="font-mono text-xs">{show[s.id] ? s.password : "••••••"}</span>
                          <Button size="icon" variant="ghost" onClick={() => setShow({ ...show, [s.id]: !show[s.id] })}>{show[s.id] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                        </>
                      ) : <span className="text-xs text-muted-foreground">غير محفوظة</span>}
                      <Button size="icon" variant="ghost" title="تغيير كلمة المرور" onClick={() => changePw.mutate(s.id)}><KeyRound className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">كلمات المرور بتظهر للطلاب اللي اتضافوا يدوي أو اتغيرت كلمة مرورهم من هنا. الطلاب اللي سجلوا بنفسهم: غيّر كلمة مرورهم عشان تظهر.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Progress ---------- */
export function ProgressTab() {
  const [sid, setSid] = useState("");
  const q = useQuery({
    queryKey: ["admin", "progress-all"],
    queryFn: async () => {
      const [ps, en, ls, pr, at] = await Promise.all([
        supabase.from("profiles").select("id,full_name,grade").order("full_name"),
        supabase.from("enrollments").select("student_id,course_id,courses(title)"),
        supabase.from("lessons").select("id,course_id,title,lesson_order").order("lesson_order"),
        supabase.from("lesson_progress").select("student_id,lesson_id,completed_at").eq("is_completed", true),
        supabase.from("quiz_attempts").select("student_id,score,total,created_at,quizzes(title)").order("created_at", { ascending: false }),
      ]);
      return { ps: ps.data ?? [], en: en.data ?? [], ls: ls.data ?? [], pr: pr.data ?? [], at: at.data ?? [] };
    },
  });
  const d = q.data;
  if (!d) return <p className="text-sm text-muted-foreground">جاري التحميل...</p>;
  const doneSet = (id: string) => new Set(d.pr.filter((p) => p.student_id === id).map((p) => p.lesson_id));
  const summary = (id: string) => {
    const courseIds = d.en.filter((e) => e.student_id === id).map((e) => e.course_id);
    const ls = d.ls.filter((l) => courseIds.includes(l.course_id));
    const done = doneSet(id);
    const c = ls.filter((l) => done.has(l.id)).length;
    return { total: ls.length, done: c, pct: ls.length ? Math.round((c / ls.length) * 100) : 0 };
  };
  const sel = d.ps.find((p) => p.id === sid);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>كل الطلاب</CardTitle></CardHeader>
        <CardContent className="max-h-[32rem] space-y-1 overflow-y-auto">
          {d.ps.map((p) => {
            const s = summary(p.id);
            return (
              <button key={p.id} onClick={() => setSid(p.id)} className={`w-full rounded-md p-2 text-right text-sm hover:bg-muted ${sid === p.id ? "bg-muted" : ""}`}>
                <div className="flex justify-between"><span>{p.full_name || "—"}</span><span className="text-xs text-muted-foreground">{s.pct}%</span></div>
                <Progress value={s.pct} className="mt-1 h-1.5" />
              </button>
            );
          })}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>{sel ? `تقدم ${sel.full_name}` : "اختار طالب"}</CardTitle></CardHeader>
        {sel && (
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">{gradeLabels[sel.grade ?? ""] ?? ""}</p>
            {d.en.filter((e) => e.student_id === sel.id).map((e) => {
              const ls = d.ls.filter((l) => l.course_id === e.course_id);
              const done = doneSet(sel.id);
              const c = ls.filter((l) => done.has(l.id)).length;
              return (
                <div key={e.course_id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between text-sm font-semibold"><span>{e.courses?.title}</span><span>{c}/{ls.length}</span></div>
                  <Progress value={ls.length ? (c / ls.length) * 100 : 0} className="mt-2" />
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {ls.map((l) => <li key={l.id} className={done.has(l.id) ? "text-primary" : "text-muted-foreground"}>{done.has(l.id) ? "✓" : "○"} {l.lesson_order}. {l.title}</li>)}
                  </ul>
                </div>
              );
            })}
            <div>
              <p className="mb-2 text-sm font-semibold">نتائج الامتحانات</p>
              {d.at.filter((a) => a.student_id === sel.id).map((a, i) => (
                <p key={i} className="text-sm">{a.quizzes?.title}: <b>{a.score}/{a.total}</b> <span className="text-xs text-muted-foreground">— {new Date(a.created_at).toLocaleDateString("ar-EG")}</span></p>
              ))}
              {!d.at.some((a) => a.student_id === sel.id) && <p className="text-xs text-muted-foreground">لسه مدخلش امتحانات.</p>}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/* ---------- Quizzes ---------- */
type QDraft = { question: string; options: string[]; correct: number };
export function QuizzesTab({ courses }: { courses: Course[] }) {
  const invalidate = useInvalidate();
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [qs, setQs] = useState<QDraft[]>([{ question: "", options: ["", "", "", ""], correct: 0 }]);

  const list = useQuery({
    queryKey: ["admin", "quizzes"],
    queryFn: async () => {
      const { data } = await supabase.from("quizzes").select("id,title,is_published,course_id,courses(title),quiz_questions(count)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const clean = qs.map((q) => ({ ...q, options: q.options.map((o) => o.trim()) })).filter((q) => q.question.trim());
      if (!courseId || !title.trim() || !clean.length) throw new Error("اختار الكورس واكتب العنوان وسؤال واحد على الأقل");
      for (const q of clean) if (q.options.filter(Boolean).length < 2 || !q.options[q.correct]) throw new Error("كل سؤال محتاج اختيارين على الأقل والإجابة الصحيحة مكتوبة");
      const { data: quiz, error } = await supabase.from("quizzes").insert({ course_id: courseId, title: title.trim(), description: desc.trim() }).select("id").single();
      if (error) throw error;
      for (const [i, q] of clean.entries()) {
        const opts = q.options.filter(Boolean);
        const correct = opts.indexOf(q.options[q.correct]!);
        const { data: row, error: e1 } = await supabase.from("quiz_questions").insert({ quiz_id: quiz.id, question: q.question.trim(), options: opts, question_order: i }).select("id").single();
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("quiz_answer_keys").insert({ question_id: row.id, correct_index: correct });
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("تم حفظ الامتحان — فعّل النشر عشان يظهر للطلاب"); setTitle(""); setDesc(""); setQs([{ question: "", options: ["", "", "", ""], correct: 0 }]); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: boolean }) => { await supabase.from("quizzes").update({ is_published: v }).eq("id", id); },
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("quizzes").delete().eq("id", id); },
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
  });

  const upd = (i: number, patch: Partial<QDraft>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>امتحان / كويز جديد</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue placeholder="اختار الكورس" /></SelectTrigger>
            <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="عنوان الامتحان" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="تعليمات (اختياري)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          {qs.map((q, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input placeholder={`السؤال ${i + 1}`} value={q.question} onChange={(e) => upd(i, { question: e.target.value })} />
                {qs.length > 1 && <Button size="icon" variant="ghost" onClick={() => setQs(qs.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>}
              </div>
              {q.options.map((o, k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name={`c-${i}`} checked={q.correct === k} onChange={() => upd(i, { correct: k })} aria-label="الإجابة الصحيحة" />
                  <Input placeholder={`اختيار ${k + 1}`} value={o} onChange={(e) => upd(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                </label>
              ))}
              <p className="text-xs text-muted-foreground">علّم على الإجابة الصحيحة</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setQs([...qs, { question: "", options: ["", "", "", ""], correct: 0 }])}><Plus className="size-4" /> سؤال</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>حفظ الامتحان</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>الامتحانات الحالية</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(list.data ?? []).map((z) => (
            <div key={z.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div><p className="font-semibold">{z.title}</p><p className="text-xs text-muted-foreground">{z.courses?.title} · {(z.quiz_questions as unknown as { count: number }[])?.[0]?.count ?? 0} سؤال</p></div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">منشور<Switch checked={z.is_published} onCheckedChange={(v) => toggle.mutate({ id: z.id, v })} /></label>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(z.id)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
          {!list.data?.length && <p className="text-center text-sm text-muted-foreground">مفيش امتحانات لسه.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
