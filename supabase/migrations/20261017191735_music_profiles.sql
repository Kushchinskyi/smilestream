begin;
create table public.music_profiles (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 100),
 description text not null default '' check(length(description)<=500),
 is_active boolean not null default true,
 is_default boolean not null default false check(not is_default or is_active),
 sort_order integer not null default 0 check(sort_order between -1000000 and 1000000),
 volume_override double precision check(volume_override between 0 and 1),
 track_urls text[] not null default '{}' check(cardinality(track_urls)<=500 and array_position(track_urls,null) is null)
);
create unique index music_profiles_one_default on public.music_profiles(is_default) where is_default;
alter table public.music_profiles enable row level security;
revoke all on public.music_profiles from public,anon,authenticated;
grant select on public.music_profiles to anon,authenticated;
grant insert,update,delete on public.music_profiles to authenticated;
grant all on public.music_profiles to service_role;
create policy music_profiles_tv_read on public.music_profiles for select to anon,authenticated using(is_active);
create policy music_profiles_admin on public.music_profiles for all to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role))
 with check(public.has_role((select auth.uid()),'admin'::public.app_role));
create function public.validate_music_profile() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(702103);
 if tg_op='INSERT' and not exists(select 1 from public.music_profiles where id=new.id) and (select count(*) from public.music_profiles)>=1000 then raise exception 'Profile capacity is 1000'; end if;
 if exists(select 1 from unnest(new.track_urls) t(url) where length(url)>2048 or url !~ '^https://[^[:space:]@]+$' or position(chr(92) in url)>0)
 or cardinality(new.track_urls)<>(select count(distinct url) from unnest(new.track_urls)t(url))
 or exists(select 1 from unnest(new.track_urls)t(url) where not exists(select 1 from public.playback_settings s where s.id=1 and url=any(s.music_urls))) then
  raise exception 'Profile tracks must be unique HTTPS references from the music library';
 end if;
 return new;
end $$;
revoke all on function public.validate_music_profile() from public,anon,authenticated;
create trigger validate_music_profile before insert or update of track_urls on public.music_profiles for each row execute function public.validate_music_profile();
create function public.save_music_profile(profile jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; tracks text[];
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(702103);
 if jsonb_typeof(profile->'track_urls') is distinct from 'array' then raise exception 'Invalid track list'; end if;
 select coalesce(array_agg(value order by ordinality),'{}'::text[]) into tracks from jsonb_array_elements_text(profile->'track_urls') with ordinality;
 if (profile->>'is_default')::boolean then update public.music_profiles set is_default=false where is_default; end if;
 result := coalesce(nullif(profile->>'id','')::uuid,gen_random_uuid());
 insert into public.music_profiles(id,name,description,is_active,is_default,sort_order,volume_override,track_urls)
 values(result,profile->>'name',coalesce(profile->>'description',''),(profile->>'is_active')::boolean,(profile->>'is_default')::boolean,(profile->>'sort_order')::integer,(profile->>'volume_override')::double precision,tracks)
 on conflict(id) do update set name=excluded.name,description=excluded.description,is_active=excluded.is_active,is_default=excluded.is_default,sort_order=excluded.sort_order,volume_override=excluded.volume_override,track_urls=excluded.track_urls;
 return result;
end $$;
revoke all on function public.save_music_profile(jsonb) from public,anon;
grant execute on function public.save_music_profile(jsonb) to authenticated;
create function public.reorder_music_profiles(ordered_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(702103);
 perform id from public.music_profiles order by id for update;
 if ordered_ids is null or cardinality(ordered_ids)<>(select count(*) from public.music_profiles)
 or cardinality(ordered_ids)<>(select count(distinct id) from unnest(ordered_ids)t(id))
 or exists(select 1 from unnest(ordered_ids)t(id) where not exists(select 1 from public.music_profiles p where p.id=t.id)) then raise exception 'Profiles changed; reload'; end if;
 update public.music_profiles p set sort_order=t.n::integer from unnest(ordered_ids) with ordinality t(id,n) where p.id=t.id;
end $$;
revoke all on function public.reorder_music_profiles(uuid[]) from public,anon;
grant execute on function public.reorder_music_profiles(uuid[]) to authenticated;
-- Reserved for future authenticated device pairing. No public screens policy or write RPC.
alter table public.screens add column last_selected_music_profile_id uuid references public.music_profiles(id) on delete set null;
alter table public.screens add column default_music_profile_id uuid references public.music_profiles(id) on delete set null;
commit;
