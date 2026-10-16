GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_approved() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_lesson(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.course_seats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_quiz(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_admin() TO authenticated, service_role;