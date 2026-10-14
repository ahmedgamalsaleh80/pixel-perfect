ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE public.enrollment_requests DROP CONSTRAINT IF EXISTS enrollment_requests_student_id_course_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS enrollment_requests_one_pending ON public.enrollment_requests (student_id, course_id) WHERE status = 'pending';