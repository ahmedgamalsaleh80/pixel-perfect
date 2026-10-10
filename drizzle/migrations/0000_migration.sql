-- Enums
create type public.app_role as enum ('admin','student');
create type public.account_status as enum ('pending','approved','rejected','suspended');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  phone text check (phone is null or char_length(phone) <= 30),
  student_code text unique,
  account_status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_status_idx on public.profiles(account_status);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- user_roles
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://'),
  is_published boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.courses to anon;
grant select, insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;

-- lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  lesson_order integer not null check (lesson_order >= 0),
  video_url text check (video_url is null or video_url ~ '^https://(drive|docs)\.google\.com/'),
  resource_url text check (resource_url is null or resource_url ~ '^https://'),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, lesson_order) deferrable initially immediate
);
create index lessons_course_idx on public.lessons(course_id, lesson_order);
grant select, insert, update, delete on public.lessons to authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;

-- enrollments
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  unique (student_id, course_id)
);
create index enrollments_course_idx on public.enrollments(course_id);
grant select, insert, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;
alter table public.enrollments enable row level security;

-- lesson_progress
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
create index progress_lesson_idx on public.lesson_progress(lesson_id);
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;

-- Helpers (security definer, fixed search_path, qualified names)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') $$;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = auth.uid() and account_status = 'approved') $$;

create or replace function public.can_access_course(_course_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or (
    public.is_approved() and exists (
      select 1 from public.enrollments e join public.courses c on c.id = e.course_id
      where e.student_id = auth.uid() and e.course_id = _course_id and c.is_published
    )
  )
$$;

create or replace function public.can_access_lesson(_lesson_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.lessons l
    where l.id = _lesson_id and l.is_published and public.can_access_course(l.course_id)
  )
$$;

revoke all on function public.is_admin(), public.is_approved(), public.can_access_course(uuid), public.can_access_lesson(uuid) from public, anon;
grant execute on function public.is_admin(), public.is_approved(), public.can_access_course(uuid), public.can_access_lesson(uuid) to authenticated;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();
create trigger progress_touch before update on public.lesson_progress for each row execute function public.touch_updated_at();

-- Students may only change full_name/phone on their own profile
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if new.id <> old.id or new.account_status <> old.account_status
       or new.student_code is distinct from old.student_code
       or new.email is distinct from old.email or new.created_at <> old.created_at then
      raise exception 'غير مسموح بتعديل هذه الحقول';
    end if;
  end if;
  return new;
end; $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

-- Progress: force student_id and completed_at server-side
create or replace function public.guard_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.student_id := coalesce(case when public.is_admin() then new.student_id end, auth.uid());
  if new.is_completed then new.completed_at := coalesce(new.completed_at, now()); else new.completed_at := null; end if;
  return new;
end; $$;
create trigger progress_guard before insert or update on public.lesson_progress for each row execute function public.guard_progress();

-- Enrollment: assigned_by set server-side
create or replace function public.set_assigned_by()
returns trigger language plpgsql security definer set search_path = '' as $$
begin new.assigned_by := auth.uid(); return new; end; $$;
create trigger enrollments_assigned_by before insert on public.enrollments for each row execute function public.set_assigned_by();

-- Policies: profiles
create policy "profiles read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles update own or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- user_roles: read own; admins read all. No client writes.
create policy "roles read own or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- courses
create policy "courses public read published" on public.courses for select to anon, authenticated
  using (is_published or public.is_admin());
create policy "courses admin insert" on public.courses for insert to authenticated with check (public.is_admin());
create policy "courses admin update" on public.courses for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "courses admin delete" on public.courses for delete to authenticated using (public.is_admin());

-- lessons: only enrolled approved students (published) or admin
create policy "lessons read authorized" on public.lessons for select to authenticated
  using (public.is_admin() or (is_published and public.can_access_course(course_id)));
create policy "lessons admin insert" on public.lessons for insert to authenticated with check (public.is_admin());
create policy "lessons admin update" on public.lessons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lessons admin delete" on public.lessons for delete to authenticated using (public.is_admin());

-- enrollments
create policy "enrollments read own or admin" on public.enrollments for select to authenticated
  using (public.is_admin() or (student_id = auth.uid() and public.is_approved()));
create policy "enrollments admin insert" on public.enrollments for insert to authenticated with check (public.is_admin());
create policy "enrollments admin delete" on public.enrollments for delete to authenticated using (public.is_admin());

-- progress
create policy "progress read own or admin" on public.lesson_progress for select to authenticated
  using (public.is_admin() or student_id = auth.uid());
create policy "progress insert own authorized" on public.lesson_progress for insert to authenticated
  with check (student_id = auth.uid() and public.can_access_lesson(lesson_id));
create policy "progress update own authorized" on public.lesson_progress for update to authenticated
  using (student_id = auth.uid() and public.can_access_lesson(lesson_id))
  with check (student_id = auth.uid() and public.can_access_lesson(lesson_id));
create policy "progress admin delete" on public.lesson_progress for delete to authenticated using (public.is_admin());

-- Signup trigger: pending profile + student role. Never admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data->>'phone', ''), 30), '')
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end; $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin stats (admin only)
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  return json_build_object(
    'students', (select count(*) from public.user_roles where role = 'student'),
    'pending', (select count(*) from public.profiles where account_status = 'pending'),
    'approved', (select count(*) from public.profiles where account_status = 'approved'),
    'published_courses', (select count(*) from public.courses where is_published),
    'enrollments', (select count(*) from public.enrollments)
  );
end; $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- Initial admin setup: callable only from a trusted SQL session (service role / database owner).
create or replace function public.grant_admin_by_email(_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(_email);
  if uid is null then raise exception 'User not found'; end if;
  insert into public.user_roles (user_id, role) values (uid, 'admin') on conflict do nothing;
  update public.profiles set account_status = 'approved' where id = uid;
end; $$;
revoke all on function public.grant_admin_by_email(text) from public, anon, authenticated;