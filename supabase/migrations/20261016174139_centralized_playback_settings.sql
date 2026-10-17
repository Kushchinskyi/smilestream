-- Prepared only. Apply on staging first; production requires separate approval.
-- Requires the existing public.has_role(uuid, public.app_role) function.
begin;

create table public.playback_settings (
  id smallint primary key default 1 check (id = 1),
  music_urls text[] not null default '{}',
  music_volume double precision not null default 0.35 check (music_volume between 0 and 1),
  video_volume double precision not null default 1 check (video_volume between 0 and 1),
  duck_volume double precision not null default 0.15 check (duck_volume between 0 and 1),
  original_video_ids uuid[] not null default '{}',
  constraint music_urls_no_nulls check (array_position(music_urls, null) is null),
  constraint original_ids_no_nulls check (array_position(original_video_ids, null) is null),
  constraint music_urls_limit check (cardinality(music_urls) <= 500),
  constraint original_ids_limit check (cardinality(original_video_ids) <= 10000)
);

alter table public.playback_settings enable row level security;
-- Remove inherited/default grants before granting the exact intended operations.
revoke all on public.playback_settings from public, anon, authenticated;
grant select on public.playback_settings to anon, authenticated;
grant update (music_urls, music_volume, video_volume, duck_volume, original_video_ids)
  on public.playback_settings to authenticated;
grant all on public.playback_settings to service_role;

create policy "TVs read playback settings"
  on public.playback_settings for select to anon, authenticated
  using (id = 1);
create policy "admins update playback settings"
  on public.playback_settings for update to authenticated
  using ((select public.has_role((select auth.uid()), 'admin'::public.app_role)))
  with check (id = 1 and (select public.has_role((select auth.uid()), 'admin'::public.app_role)));

-- Singleton only, no video rows, ordering, roles, auth triggers or old policies touched.
-- Existing browser-local settings are imported explicitly by an admin after review.
insert into public.playback_settings (id) values (1);
commit;
