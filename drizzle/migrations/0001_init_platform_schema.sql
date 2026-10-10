do $$ begin
  create type public.account_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('admin', 'student');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  account_status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and account_status = 'approved')
$$;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  thumbnail_url text,
  is_published boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.courses to anon;
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  video_url text,
  resource_url text,
  lesson_order int not null default 1,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lessons to authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);
grant select, insert, update, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;

create or replace function public.can_access_course(_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_approved() and exists (
    select 1 from public.enrollments where course_id = _course_id and student_id = auth.uid()
  ))
$$;

create or replace function public.can_access_lesson(_lesson_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_approved() and exists (
    select 1 from public.lessons l
    join public.enrollments e on e.course_id = l.course_id
    where l.id = _lesson_id and e.student_id = auth.uid()
  ))
$$;

create or replace function public.admin_stats()
returns json language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then json_build_object(
    'students', (select count(*) from public.profiles),
    'pending', (select count(*) from public.profiles where account_status = 'pending'),
    'approved', (select count(*) from public.profiles where account_status = 'approved'),
    'courses', (select count(*) from public.courses),
    'lessons', (select count(*) from public.lessons),
    'enrollments', (select count(*) from public.enrollments),
    'completed_lessons', (select count(*) from public.lesson_progress where is_completed)
  ) else null end
$$;

create or replace function public.grant_admin_by_email(_email text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  select id into _uid from auth.users where email = _email;
  if _uid is null then raise exception 'user not found: %', _email; end if;
  insert into public.user_roles (user_id, role) values (_uid, 'admin') on conflict do nothing;
  update public.profiles set account_status = 'approved' where id = _uid;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'phone');
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists "courses_select_published" on public.courses;
create policy "courses_select_published" on public.courses for select using (is_published or public.is_admin() or public.can_access_course(id));
drop policy if exists "courses_admin_insert" on public.courses;
create policy "courses_admin_insert" on public.courses for insert to authenticated with check (public.is_admin());
drop policy if exists "courses_admin_update" on public.courses;
create policy "courses_admin_update" on public.courses for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "courses_admin_delete" on public.courses;
create policy "courses_admin_delete" on public.courses for delete to authenticated using (public.is_admin());

drop policy if exists "lessons_select" on public.lessons;
create policy "lessons_select" on public.lessons for select to authenticated using (public.can_access_lesson(id) or (is_published and exists (select 1 from public.courses c where c.id = course_id and c.is_published)));
drop policy if exists "lessons_admin_insert" on public.lessons;
create policy "lessons_admin_insert" on public.lessons for insert to authenticated with check (public.is_admin());
drop policy if exists "lessons_admin_update" on public.lessons;
create policy "lessons_admin_update" on public.lessons for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "lessons_admin_delete" on public.lessons;
create policy "lessons_admin_delete" on public.lessons for delete to authenticated using (public.is_admin());

drop policy if exists "enrollments_select" on public.enrollments;
create policy "enrollments_select" on public.enrollments for select to authenticated using (auth.uid() = student_id or public.is_admin());
drop policy if exists "enrollments_admin_insert" on public.enrollments;
create policy "enrollments_admin_insert" on public.enrollments for insert to authenticated with check (public.is_admin());
drop policy if exists "enrollments_admin_update" on public.enrollments;
create policy "enrollments_admin_update" on public.enrollments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "enrollments_admin_delete" on public.enrollments;
create policy "enrollments_admin_delete" on public.enrollments for delete to authenticated using (public.is_admin());

drop policy if exists "progress_select" on public.lesson_progress;
create policy "progress_select" on public.lesson_progress for select to authenticated using (auth.uid() = student_id or public.is_admin());
drop policy if exists "progress_insert" on public.lesson_progress;
create policy "progress_insert" on public.lesson_progress for insert to authenticated with check (auth.uid() = student_id);
drop policy if exists "progress_update" on public.lesson_progress;
create policy "progress_update" on public.lesson_progress for update to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);
drop policy if exists "progress_delete" on public.lesson_progress;
create policy "progress_delete" on public.lesson_progress for delete to authenticated using (auth.uid() = student_id);