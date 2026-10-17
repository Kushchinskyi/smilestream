-- Additive. Apply only after advertisement_library and the original has_role schema.
create table public.ad_playback_settings (
 id smallint primary key default 1 check (id = 1),
 enabled boolean not null default false,
 interval_minutes integer not null default 30 check (interval_minutes in (15,20,30,45,60)),
 block_count integer not null default 1 check (block_count in (0,1,2,3))
);
insert into public.ad_playback_settings(id) values (1);
alter table public.ad_playback_settings enable row level security;
revoke all on public.ad_playback_settings from public, anon, authenticated;
grant select on public.ad_playback_settings to anon, authenticated;
grant update(enabled,interval_minutes,block_count) on public.ad_playback_settings to authenticated;
grant all on public.ad_playback_settings to service_role;
create policy ad_settings_read on public.ad_playback_settings for select to anon, authenticated using (true);
create policy ad_settings_admin_update on public.ad_playback_settings for update to authenticated
 using (public.has_role((select auth.uid()), 'admin'::public.app_role))
 with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
-- Public playback reads active advertisements only. Existing admin policy preserves CRUD.
grant select on public.advertisements to anon;
create policy advertisements_playback_read on public.advertisements for select to anon, authenticated using (is_active);
-- One consistent configuration snapshot per polling cycle. Invoker retains table RLS.
create function public.read_ad_playback() returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('settings', to_jsonb(s) - 'id', 'advertisements',
   coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order,a.id)
     from (select id,title,url,duration_seconds,sort_order,is_active,original_sound
       from public.advertisements where is_active order by sort_order,id limit 1000) a), '[]'::jsonb))
 from public.ad_playback_settings s where id = 1
$$;
revoke all on function public.read_ad_playback() from public;
grant execute on function public.read_ad_playback() to anon, authenticated, service_role;
