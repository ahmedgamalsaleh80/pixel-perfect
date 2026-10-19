import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useMe, statusLabels, type AccountStatus } from "@/lib/auth";
import { isValidDriveUrl, isValidVideoUrl, normalizeDriveUrl, normalizeVideoUrl } from "@/lib/drive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestsTab, AddStudentTab, ProgressTab, QuizzesTab, BulkEnrollCard, GradesTab } from "@/components/admin/AdminExtras";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة تحكم الأدمن — منصة المهندس أحمد جمال" },
      { name: "description", content: "إدارة الطلاب والكورسات والدروس والاشتراكات." },
      { property: "og:title", content: "لوحة تحكم الأدمن — منصة المهندس أحمد جمال" },
      { property: "og:description", content: "إدارة الطلاب والكورسات والدروس والاشتراكات." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Stats = {
  students: number;
  pending: number;
  approved: number;
  courses: number;
  lessons: number;
  enrollments: number;
  completed_lessons: number;
};

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  account_status: AccountStatus;
  created_at: string;
};

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string | null;
  is_published: boolean;
  max_students: number | null;
  grade: string | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  lesson_order: number;
  is_published: boolean;
  video_url: string | null;
};

function AdminPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,phone,account_status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const coursesQuery = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,title,slug,description,thumbnail_url,is_published,max_students,grade")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CourseRow[];
    },
  });

  const lessonsQuery = useQuery({
    queryKey: ["admin", "lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id,course_id,title,lesson_order,is_published,video_url")
        .order("lesson_order");
      if (error) throw error;
      return (data ?? []) as LessonRow[];
    },
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["admin", "enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id,student_id,course_id,assigned_at");
      if (error) throw error;
      return (data ?? []) as { id: string; student_id: string; course_id: string; assigned_at: string }[];
    },
  });

  if (!me?.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">غير مصرح</h1>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة دي متاحة للأدمن بس.</p>
      </div>
    );
  }

  const stats = statsQuery.data;
  const students = studentsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
  const lessons = lessonsQuery.data ?? [];
  const enrollments = enrollmentsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold">لوحة تحكم الأدمن</h1>
      <p className="mt-1 text-sm text-muted-foreground">إدارة الطلاب والكورسات والدروس والاشتراكات.</p>

      <Alert className="mt-4 border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="size-4" />
        <AlertTitle>تنبيه مهم عن روابط Google Drive</AlertTitle>
        <AlertDescription>
          روابط Drive المشتركة ممكن يعيد الطالب نشرها خارج المنصة. المنصة بتتحكم في الوصول للدروس، لكن
          مش بتمنع مشاركة الرابط نفسه. لو عايز حماية أقوى، استخدم استضافة فيديو خاصة بدل Drive.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="students">الطلاب</TabsTrigger>
          <TabsTrigger value="courses">الكورسات والدروس</TabsTrigger>
          <TabsTrigger value="enrollments">الاشتراكات</TabsTrigger>
          <TabsTrigger value="requests">طلبات فتح الكورسات</TabsTrigger>
          <TabsTrigger value="add-student">إضافة طالب</TabsTrigger>
          <TabsTrigger value="progress">تقدم الطلاب</TabsTrigger>
          <TabsTrigger value="quizzes">الامتحانات والكويزات</TabsTrigger>
          <TabsTrigger value="grades">درجات الطلاب</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4"><RequestsTab /></TabsContent>
        <TabsContent value="add-student" className="mt-4"><AddStudentTab /></TabsContent>
        <TabsContent value="progress" className="mt-4"><ProgressTab /></TabsContent>
        <TabsContent value="quizzes" className="mt-4"><QuizzesTab courses={courses} /></TabsContent>
        <TabsContent value="grades" className="mt-4"><GradesTab /></TabsContent>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard icon={<Users className="size-5" />} label="إجمالي الطلاب" value={stats?.students} />
            <StatCard icon={<UserCheck className="size-5" />} label="طلاب معتمدين" value={stats?.approved} />
            <StatCard icon={<PauseCircle className="size-5" />} label="قيد المراجعة" value={stats?.pending} />
            <StatCard icon={<BookOpen className="size-5" />} label="الكورسات" value={stats?.courses} />
            <StatCard icon={<GraduationCap className="size-5" />} label="الدروس" value={stats?.lessons} />
            <StatCard icon={<CheckCircle2 className="size-5" />} label="الاشتراكات" value={stats?.enrollments} />
            <StatCard icon={<CheckCircle2 className="size-5" />} label="دروس مكتملة" value={stats?.completed_lessons} />
          </div>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <StudentsTab students={students} onChanged={invalidateAll} />
        </TabsContent>

        <TabsContent value="courses" className="mt-4">
          <CoursesTab courses={courses} lessons={lessons} onChanged={invalidateAll} />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <BulkEnrollCard students={students} courses={courses} enrollments={enrollments} onChanged={invalidateAll} />
          <div className="h-6" />
          <EnrollmentsTab
            students={students}
            courses={courses}
            enrollments={enrollments}
            onChanged={invalidateAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | undefined }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-2xl font-bold">{value ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentsTab({ students, onChanged }: { students: ProfileRow[]; onChanged: () => void }) {
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccountStatus }) => {
      const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الطالب");
      onChanged();
    },
    onError: () => toast.error("حصل خطأ أثناء التحديث"),
  });

  const statusVariant: Record<AccountStatus, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
    suspended: "outline",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>الطلاب ({students.length})</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الموبايل</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name || "—"}</TableCell>
                <TableCell dir="ltr" className="text-right">{s.phone || "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[s.account_status]}>{statusLabels[s.account_status]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {s.account_status !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: s.id, status: "approved" })}
                      >
                        <UserCheck className="size-4" /> اعتماد
                      </Button>
                    )}
                    {s.account_status !== "suspended" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: s.id, status: "suspended" })}
                      >
                        <PauseCircle className="size-4" /> إيقاف
                      </Button>
                    )}
                    {s.account_status === "suspended" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: s.id, status: "approved" })}
                      >
                        <PlayCircle className="size-4" /> إعادة تفعيل
                      </Button>
                    )}
                    {s.account_status === "pending" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setStatus.mutate({ id: s.id, status: "rejected" })}
                      >
                        <UserX className="size-4" /> رفض
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!students.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  مفيش طلاب لسه.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CoursesTab({
  courses,
  lessons,
  onChanged,
}: {
  courses: CourseRow[];
  lessons: LessonRow[];
  onChanged: () => void;
}) {
  const emptyCourse = { title: "", slug: "", description: "", thumbnail_url: "", max_students: "", grade: "" };
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [editingId, setEditingId] = useState<string | null>(null);
  const startEdit = (c: CourseRow) => {
    setEditingId(c.id);
    setCourseForm({ title: c.title, slug: c.slug, description: c.description ?? "", thumbnail_url: c.thumbnail_url ?? "", max_students: c.max_students ? String(c.max_students) : "", grade: c.grade ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [lessonForm, setLessonForm] = useState({
    course_id: "",
    title: "",
    description: "",
    video_url: "",
    resource_url: "",
    lesson_order: "1",
  });
  const [attachText, setAttachText] = useState("");

  const addCourse = useMutation({
    mutationFn: async () => {
      const base = (courseForm.slug.trim() || courseForm.title.trim())
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
      const slug = `${base || "course"}-${Math.random().toString(36).slice(2, 6)}`;
      const max = Number(courseForm.max_students);
      if (editingId) {
        const { error } = await supabase.from("courses").update({
          title: courseForm.title.trim(),
          description: courseForm.description.trim(),
          thumbnail_url: courseForm.thumbnail_url.trim() || null,
          max_students: max > 0 ? max : null,
          grade: courseForm.grade || null,
        }).eq("id", editingId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("courses").insert({
        title: courseForm.title.trim(),
        slug,
        description: courseForm.description.trim(),
        thumbnail_url: courseForm.thumbnail_url.trim() || null,
        max_students: max > 0 ? max : null,
        grade: courseForm.grade || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingId ? "تم حفظ التعديلات" : "تم إضافة الكورس");
      setCourseForm(emptyCourse);
      setEditingId(null);
      onChanged();
    },
    onError: (e) => toast.error(`فشل إضافة الكورس: ${e.message}`),
  });

  const toggleCourse = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase.from("courses").update({ is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: () => toast.error("فشل التحديث"),
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الكورس");
      onChanged();
    },
    onError: () => toast.error("فشل الحذف"),
  });

  const addLesson = useMutation({
    mutationFn: async () => {
      const video = lessonForm.video_url.trim();
      if (video && !isValidVideoUrl(video)) throw new Error("رابط الفيديو لازم يكون رابط YouTube أو Google Drive صحيح");
      const resource = lessonForm.resource_url.trim();
      if (resource && !isValidDriveUrl(resource)) throw new Error("رابط المرفق لازم يكون رابط Google Drive صحيح");
      const attachments = attachText.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const i = l.lastIndexOf("|");
        const title = i >= 0 ? l.slice(0, i).trim() : "ملف";
        const url = (i >= 0 ? l.slice(i + 1) : l).trim();
        if (!/^https:\/\/\S+$/.test(url)) throw new Error(`رابط غير صحيح: ${l}`);
        return { title: title || "ملف", url };
      });
      const { error } = await supabase.from("lessons").insert({
        course_id: lessonForm.course_id,
        title: lessonForm.title.trim(),
        description: lessonForm.description.trim(),
        video_url: video ? normalizeVideoUrl(video) : null,
        resource_url: resource ? normalizeDriveUrl(resource) : null,
        lesson_order: Number(lessonForm.lesson_order) || 1,
        attachments,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إضافة الدرس");
      setAttachText("");
      setLessonForm({ course_id: "", title: "", description: "", video_url: "", resource_url: "", lesson_order: "1" });
      onChanged();
    },
    onError: (e) => toast.error(e.message || "فشل إضافة الدرس"),
  });

  const toggleLesson = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase.from("lessons").update({ is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: () => toast.error("فشل التحديث"),
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الدرس");
      onChanged();
    },
    onError: () => toast.error("فشل الحذف"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "تعديل بيانات الكورس" : "إضافة كورس جديد"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="ct">عنوان الكورس</Label>
            <Input id="ct" dir="auto" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cs">الرابط المختصر (slug)</Label>
            <Input id="cs" dir="ltr" placeholder="python-basics" value={courseForm.slug} onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cd">الوصف</Label>
            <Textarea id="cd" dir="auto" rows={5} placeholder="اكتب تفاصيل الكورس بالعربي: هتتعلم إيه، مين يناسبه..." value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cth">رابط صورة الغلاف (اختياري)</Label>
            <Input id="cth" dir="ltr" value={courseForm.thumbnail_url} onChange={(e) => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cmax">أقصى عدد طلاب (اختياري)</Label>
            <Input id="cmax" type="number" min={1} dir="ltr" placeholder="بدون حد" value={courseForm.max_students} onChange={(e) => setCourseForm({ ...courseForm, max_students: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cgrade">الصف</Label>
            <select id="cgrade" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={courseForm.grade} onChange={(e) => setCourseForm({ ...courseForm, grade: e.target.value })}>
              <option value="">لكل الصفوف</option>
              <option value="bac1">الصف الأول بكالوريا</option>
              <option value="bac2">الصف الثاني بكالوريا</option>
            </select>
          </div>
          <Button onClick={() => addCourse.mutate()} disabled={!courseForm.title.trim() || addCourse.isPending}>
            <Plus className="size-4" /> {editingId ? "حفظ التعديلات" : "إضافة الكورس"}
          </Button>
          {editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setCourseForm(emptyCourse); }}>إلغاء التعديل</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إضافة درس جديد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>الكورس</Label>
            <Select value={lessonForm.course_id} onValueChange={(v) => setLessonForm({ ...lessonForm, course_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختار الكورس" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="lt">عنوان الدرس</Label>
            <Input id="lt" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ld">الوصف</Label>
            <Textarea id="ld" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="lv">رابط فيديو Google Drive</Label>
            <Input id="lv" dir="ltr" placeholder="https://youtube.com/watch?v=... أو https://drive.google.com/file/d/.../view" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="lr">رابط مرفق Google Drive (اختياري)</Label>
            <Input id="lr" dir="ltr" value={lessonForm.resource_url} onChange={(e) => setLessonForm({ ...lessonForm, resource_url: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="la">واجبات وملفات إضافية (اختياري)</Label>
            <textarea id="la" rows={4} className="w-full rounded-md border border-input bg-background p-2 text-sm" placeholder={"كل ملف في سطر: الاسم | الرابط\nمذكرة الشرح | https://drive.google.com/...\nالواجب | https://drive.google.com/..."} value={attachText} onChange={(e) => setAttachText(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lo">ترتيب الدرس</Label>
            <Input id="lo" type="number" min={1} dir="ltr" value={lessonForm.lesson_order} onChange={(e) => setLessonForm({ ...lessonForm, lesson_order: e.target.value })} />
          </div>
          <Button onClick={() => addLesson.mutate()} disabled={!lessonForm.course_id || !lessonForm.title.trim() || addLesson.isPending}>
            <Plus className="size-4" /> إضافة الدرس
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>الكورسات الحالية ({courses.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {courses.map((c) => {
            const courseLessons = lessons.filter((l) => l.course_id === c.id);
            return (
              <div key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">/courses/{c.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      منشور
                      <Switch
                        checked={c.is_published}
                        onCheckedChange={(v) => toggleCourse.mutate({ id: c.id, is_published: v })}
                      />
                    </label>
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>تعديل</Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteCourse.mutate(c.id)}>
                      <Trash2 className="size-4" /> حذف
                    </Button>
                  </div>
                </div>
                {!!courseLessons.length && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                    {courseLessons.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2">
                        <span>
                          {l.lesson_order}. {l.title}
                        </span>
                        <span className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs">
                            منشور
                            <Switch
                              checked={l.is_published}
                              onCheckedChange={(v) => toggleLesson.mutate({ id: l.id, is_published: v })}
                            />
                          </label>
                          <Button size="sm" variant="ghost" onClick={() => deleteLesson.mutate(l.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {!courses.length && <p className="text-center text-sm text-muted-foreground">مفيش كورسات لسه.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function EnrollmentsTab({
  students,
  courses,
  enrollments,
  onChanged,
}: {
  students: ProfileRow[];
  courses: CourseRow[];
  enrollments: { id: string; student_id: string; course_id: string; assigned_at: string }[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ student_id: "", course_id: "" });

  const enroll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("enrollments").insert({
        student_id: form.student_id,
        course_id: form.course_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل الطالب في الكورس");
      setForm({ student_id: "", course_id: "" });
      onChanged();
    },
    onError: (e) => toast.error(e.message.includes("COURSE_FULL") ? "الكورس اكتمل العدد" : "فشل التسجيل — ممكن يكون الطالب مسجل بالفعل"),
  });

  const unenroll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إلغاء الاشتراك");
      onChanged();
    },
    onError: () => toast.error("فشل الإلغاء"),
  });

  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name || "—";
  const courseName = (id: string) => courses.find((c) => c.id === id)?.title || "—";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>تسجيل طالب في كورس</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>الطالب</Label>
            <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختار الطالب" />
              </SelectTrigger>
              <SelectContent>
                {students
                  .filter((s) => s.account_status === "approved")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name || s.id}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الكورس</Label>
            <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختار الكورس" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => enroll.mutate()} disabled={!form.student_id || !form.course_id || enroll.isPending}>
            <Plus className="size-4" /> تسجيل
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>الاشتراكات الحالية ({enrollments.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الكورس</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{studentName(e.student_id)}</TableCell>
                  <TableCell>{courseName(e.course_id)}</TableCell>
                  <TableCell>{new Date(e.assigned_at).toLocaleDateString("ar-EG")}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" onClick={() => unenroll.mutate(e.id)}>
                      <Trash2 className="size-4" /> إلغاء
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!enrollments.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    مفيش اشتراكات لسه.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
