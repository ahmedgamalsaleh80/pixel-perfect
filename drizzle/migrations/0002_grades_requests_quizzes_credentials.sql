-- profiles: grade + parent phone
alter table public.profiles add column if not exists grade text check (grade in ('bac1','bac2'));
alter table public.profiles add column if not exists parent_phone text;

-- course capacity
alter table public.courses add column if not exists max_students integer check (max_students is null or max_students > 0);

-- close leak: lessons readable only by authorized users
drop policy if exists lessons_select on public.lessons;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.profiles (id, full_name, email, phone, parent_phone, grade)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data->>'phone', ''), 30), ''),
    nullif(left(coalesce(new.raw_user_meta_data->>'parent_phone', ''), 30), ''),
    case when new.raw_user_meta_data->>'grade' in ('bac1','bac2') then new.raw_user_meta_data->>'grade' end
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end; $$;

-- capacity enforcement
create or replace function public.enforce_course_capacity()
returns trigger language plpgsql security definer set search_path to '' as $$
declare _max int; _cnt int;
begin
  select max_students into _max from public.courses where id = new.course_id;
  if _max is not null then
    select count(*) into _cnt from public.enrollments where course_id = new.course_id;
    if _cnt >= _max then raise exception 'COURSE_FULL'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists enrollments_capacity on public.enrollments;
create trigger enrollments_capacity before insert on public.enrollments for each row execute function public.enforce_course_capacity();

-- public enrollment counts
create or replace function public.course_seats()
returns table(course_id uuid, enrolled bigint, max_students int)
language sql stable security definer set search_path to 'public' as $$
  select c.id, (select count(*) from public.enrollments e where e.course_id = c.id), c.max_students
  from public.courses c where c.is_published
$$;
grant execute on function public.course_seats() to anon, authenticated;

-- enrollment requests
create table if not exists public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);
grant select, insert, update, delete on public.enrollment_requests to authenticated;
grant all on public.enrollment_requests to service_role;
alter table public.enrollment_requests enable row level security;
create policy "req read own or admin" on public.enrollment_requests for select to authenticated using (student_id = auth.uid() or public.is_admin());
create policy "req insert own" on public.enrollment_requests for insert to authenticated with check (student_id = auth.uid() and status = 'pending');
create policy "req admin update" on public.enrollment_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "req delete own pending or admin" on public.enrollment_requests for delete to authenticated using (public.is_admin() or (student_id = auth.uid() and status = 'pending'));

-- stored credentials for admin-created students (admin only)
create table if not exists public.student_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.student_credentials to authenticated;
grant all on public.student_credentials to service_role;
alter table public.student_credentials enable row level security;
create policy "cred admin all" on public.student_credentials for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- quizzes
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quizzes to authenticated;
grant all on public.quizzes to service_role;
alter table public.quizzes enable row level security;
create policy "quiz read" on public.quizzes for select to authenticated using (public.is_admin() or (is_published and public.can_access_course(course_id)));
create policy "quiz admin write" on public.quizzes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  question_order integer not null default 0
);
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant all on public.quiz_questions to service_role;
alter table public.quiz_questions enable row level security;
create policy "qq read" on public.quiz_questions for select to authenticated using (
  public.is_admin() or exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_published and public.can_access_course(q.course_id)));
create policy "qq admin write" on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_index integer not null
);
grant select, insert, update, delete on public.quiz_answer_keys to authenticated;
grant all on public.quiz_answer_keys to service_role;
alter table public.quiz_answer_keys enable row level security;
create policy "keys admin" on public.quiz_answer_keys for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null,
  total integer not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, delete on public.quiz_attempts to authenticated;
grant all on public.quiz_attempts to service_role;
alter table public.quiz_attempts enable row level security;
create policy "attempt read" on public.quiz_attempts for select to authenticated using (student_id = auth.uid() or public.is_admin());
create policy "attempt admin delete" on public.quiz_attempts for delete to authenticated using (public.is_admin());

create or replace function public.submit_quiz(_quiz_id uuid, _answers jsonb)
returns json language plpgsql security definer set search_path to 'public' as $$
declare _course uuid; _score int; _total int;
begin
  select course_id into _course from quizzes where id = _quiz_id and is_published;
  if _course is null or not can_access_course(_course) then raise exception 'not allowed'; end if;
  select count(*), count(*) filter (where (_answers->>(q.id::text))::int = k.correct_index)
    into _total, _score
  from quiz_questions q join quiz_answer_keys k on k.question_id = q.id where q.quiz_id = _quiz_id;
  insert into quiz_attempts (quiz_id, student_id, score, total, answers) values (_quiz_id, auth.uid(), _score, _total, _answers);
  return json_build_object('score', _score, 'total', _total);
end; $$;
revoke execute on function public.submit_quiz(uuid, jsonb) from anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;