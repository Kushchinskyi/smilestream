-- Additive admin metadata only. No video/audio sources, order, auth or TV logic changed.
begin;
create table public.media_metadata (
  kind text not null check (kind in ('video','music')),
  source_key text not null check (length(source_key) between 1 and 2048),
  label text not null default '' check (length(label) <= 160),
  category text not null default 'other' check (category in ('digital','cadcam','printing','implants','prosthetics','orthodontics','hygiene','sterilization','other')),
  primary key (kind,source_key),
  check ((kind='video' and source_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or (kind='music' and source_key ~ '^https://[^[:space:]]+$'))
);
alter table public.media_metadata enable row level security;
revoke all on public.media_metadata from public,anon,authenticated;
grant select,insert,update,delete on public.media_metadata to authenticated;
grant all on public.media_metadata to service_role;
create policy "admins manage media metadata" on public.media_metadata for all to authenticated
  using ((select public.has_role((select auth.uid()),'admin')))
  with check ((select public.has_role((select auth.uid()),'admin')));
-- Atomic, permission-checked full-library reorder; stale/incomplete snapshots fail closed.
create function public.reorder_videos(ordered_ids uuid[]) returns void
language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise insufficient_privilege; end if;
  perform id from public.videos order by id for update;
  if cardinality(ordered_ids) <> (select count(*) from public.videos)
    or cardinality(ordered_ids) <> (select count(distinct id) from unnest(ordered_ids) id)
    or exists(select 1 from unnest(ordered_ids) id where not exists(select 1 from public.videos v where v.id=id)) then
    raise exception 'Playlist changed; reload before reordering';
  end if;
  update public.videos v set sort_order=q.position::integer,updated_at=now()
    from unnest(ordered_ids) with ordinality q(id,position) where v.id=q.id;
end $$;
revoke all on function public.reorder_videos(uuid[]) from public,anon;
grant execute on function public.reorder_videos(uuid[]) to authenticated;
commit;
