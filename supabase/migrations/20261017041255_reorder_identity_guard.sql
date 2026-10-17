-- Reject NULL/stale identities before changing order. No rows change during migration.
create or replace function public.reorder_videos(ordered_ids uuid[]) returns void
language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise insufficient_privilege; end if;
  perform id from public.videos order by id for update;
  if ordered_ids is null
    or cardinality(ordered_ids) <> (select count(*) from public.videos)
    or cardinality(ordered_ids) <> (select count(distinct source.id) from unnest(ordered_ids) source(id))
    or exists(select 1 from unnest(ordered_ids) source(id) where not exists(select 1 from public.videos v where v.id=source.id)) then
    raise exception 'Playlist changed; reload before reordering';
  end if;
  update public.videos v set sort_order=q.position::integer,updated_at=now()
    from unnest(ordered_ids) with ordinality q(id,position) where v.id=q.id;
end $$;
