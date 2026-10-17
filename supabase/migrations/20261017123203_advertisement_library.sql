-- Independent inventory only. No scheduled insertion or normal playlist changes.
begin;
create table public.advertisements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 200),
 url text not null check(length(url)<=2048 and url ~ '^https://[^[:space:]]+$'),
 duration_seconds integer not null default 0 check(duration_seconds between 0 and 86400),
 sort_order integer not null default 0 check(sort_order between -1000000 and 1000000),
 is_active boolean not null default false,
 original_sound boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.advertisements enable row level security;
revoke all on public.advertisements from public,anon,authenticated;
grant select,insert,update,delete on public.advertisements to authenticated;
grant all on public.advertisements to service_role;
create policy "admins manage advertisement inventory" on public.advertisements for all to authenticated
 using ((select public.has_role((select auth.uid()),'admin')))
 with check ((select public.has_role((select auth.uid()),'admin')));
create function public.reorder_advertisements(ordered_ids uuid[]) returns void
language plpgsql security invoker set search_path=public as $$
begin
 if not public.has_role(auth.uid(),'admin') then raise insufficient_privilege; end if;
 perform id from public.advertisements order by id for update;
 if ordered_ids is null or cardinality(ordered_ids)<>(select count(*) from public.advertisements)
  or cardinality(ordered_ids)<>(select count(distinct source.id) from unnest(ordered_ids) source(id))
  or exists(select 1 from unnest(ordered_ids) source(id) where not exists(select 1 from public.advertisements a where a.id=source.id)) then
   raise exception 'Advertisement inventory changed; reload before reordering';
 end if;
 update public.advertisements a set sort_order=q.position::integer from unnest(ordered_ids) with ordinality q(id,position) where a.id=q.id;
end $$;
revoke all on function public.reorder_advertisements(uuid[]) from public,anon;
grant execute on function public.reorder_advertisements(uuid[]) to authenticated;
commit;
