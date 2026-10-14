create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- First registered user becomes admin; later signups get no rights.
create or replace function public.assign_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.assign_first_admin();

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  duration_seconds integer not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.videos to anon;
grant select, insert, update, delete on public.videos to authenticated;
grant all on public.videos to service_role;
alter table public.videos enable row level security;
create policy "public reads active videos" on public.videos for select to anon, authenticated using (is_active = true);
create policy "admins read all videos" on public.videos for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins insert videos" on public.videos for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update videos" on public.videos for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete videos" on public.videos for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  diagonal_inches integer,
  -- reserved for future device pairing by code and heartbeat; not used in MVP
  pairing_code text unique,
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.screens to authenticated;
grant all on public.screens to service_role;
alter table public.screens enable row level security;
create policy "admins manage screens" on public.screens for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.screens (name, diagonal_inches) values
  ('Кабінет 1', 43), ('Кабінет 2', 43), ('Ресепшн', 65);

insert into public.videos (title, url, duration_seconds, sort_order, is_active, is_test) values
  ('ТЕСТ · Big Buck Bunny (Blender Foundation, CC BY)', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 596, 1, true, true),
  ('ТЕСТ · Elephants Dream (Blender Foundation, CC BY)', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 653, 2, true, true),
  ('ТЕСТ · Sintel (Blender Foundation, CC BY)', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', 888, 3, true, true),
  ('ТЕСТ · Tears of Steel (Blender Foundation, CC BY)', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', 734, 4, true, true);