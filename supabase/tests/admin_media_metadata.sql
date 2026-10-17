-- Isolated project ONLY: verify project_id=dhvfrnlxskqjnefndztu before executing via MCP.
begin;
-- Requires the test admin/user fixture identities provisioned in INTEGRATION_TEST.md.
set local role anon;
do $$ begin
 begin perform * from public.media_metadata;raise exception 'anon can read admin metadata';exception when insufficient_privilege then null;end;
 begin perform public.reorder_videos('{}');raise exception 'anon can reorder';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local request.jwt.claim.sub='';
set local request.jwt.claims='{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"admin"}}';
set local role authenticated;
do $$ begin
 if (select count(*) from public.media_metadata)<>0 then raise exception 'non-admin reads metadata';end if;
 begin insert into public.media_metadata(kind,source_key) values('music','https://example.invalid/test.mp3');raise exception 'non-admin can insert';exception when insufficient_privilege then null;end;
 begin perform public.reorder_videos('{}');raise exception 'non-admin can reorder';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local request.jwt.claims='{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
do $$ declare ids uuid[];bad_ids uuid[];begin
 insert into public.media_metadata(kind,source_key,label) values('music','https://example.invalid/rls-test.mp3','Test');
 update public.media_metadata set label='Updated' where source_key='https://example.invalid/rls-test.mp3';
 if (select label from public.media_metadata where source_key='https://example.invalid/rls-test.mp3')<>'Updated' then raise exception 'admin metadata UPDATE failed';end if;
 begin insert into public.media_metadata(kind,source_key) values('video','invalid');raise exception 'invalid UUID accepted';exception when check_violation then null;end;
 begin update public.media_metadata set label=repeat('x',161);raise exception 'label limit missing';exception when check_violation then null;end;
 begin update public.media_metadata set category='unknown';raise exception 'category check missing';exception when check_violation then null;end;
 begin perform public.reorder_videos('{}');raise exception 'incomplete reorder accepted';exception when raise_exception then if SQLERRM<>'Playlist changed; reload before reordering' then raise;end if;end;
 select array_agg(id order by sort_order desc,id desc) into ids from public.videos;
 begin perform public.reorder_videos(null);raise exception 'NULL reorder accepted';exception when raise_exception then if SQLERRM<>'Playlist changed; reload before reordering' then raise;end if;end;
 bad_ids:=ids;bad_ids[1]:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 begin perform public.reorder_videos(bad_ids);raise exception 'unknown identity accepted';exception when raise_exception then if SQLERRM<>'Playlist changed; reload before reordering' then raise;end if;end;
 if cardinality(ids)>1 then
 bad_ids:=ids;bad_ids[1]:=bad_ids[2];
 begin perform public.reorder_videos(bad_ids);raise exception 'duplicate identities accepted';exception when raise_exception then if SQLERRM<>'Playlist changed; reload before reordering' then raise;end if;end;
 end if;
 perform public.reorder_videos(ids);
 if (select array_agg(id order by sort_order) from public.videos)<>ids then raise exception 'Atomic reorder failed';end if;
 delete from public.media_metadata where source_key='https://example.invalid/rls-test.mp3';
end $$;
reset role;
rollback;
select 'PASS: metadata RLS, validation and atomic reorder (fixtures/order rolled back)' as result;
