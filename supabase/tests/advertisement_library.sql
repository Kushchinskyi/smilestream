-- ONLY the approved disposable integration project dhvfrnlxskqjnefndztu.
-- Uses existing test admin/user identities. Everything, including order, rolls back.
begin;
insert into public.advertisements(id,title,url) values('f5000000-0000-4000-8000-000000000001','SQL ad fixture','https://example.invalid/ad.mp4');
set local role anon;
do $$ begin
 begin perform * from public.advertisements;raise exception 'anon advertisement read allowed';exception when insufficient_privilege then null;end;
 begin perform public.reorder_advertisements(null);raise exception 'anon reorder allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local request.jwt.claim.sub='';
set local request.jwt.claims='{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
do $$ begin
 if (select count(*) from public.advertisements)<>0 then raise exception 'ordinary user sees ads';end if;
 begin insert into public.advertisements(title,url) values('Denied','https://example.invalid/a.mp4');raise exception 'ordinary insert allowed';exception when insufficient_privilege then null;end;
 begin perform public.reorder_advertisements(null);raise exception 'ordinary reorder allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local request.jwt.claims='{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
do $$ declare ids uuid[];begin
 if (select original_sound from public.advertisements where id='f5000000-0000-4000-8000-000000000001') then raise exception 'Original sound should default OFF';end if;
 update public.advertisements set title='Updated',original_sound=true where id='f5000000-0000-4000-8000-000000000001';
 if not (select original_sound from public.advertisements where id='f5000000-0000-4000-8000-000000000001') then raise exception 'Admin update failed';end if;
 begin update public.advertisements set duration_seconds=-1;raise exception 'negative duration accepted';exception when check_violation then null;end;
 begin update public.advertisements set url='http://example.invalid/a.mp4';raise exception 'HTTP accepted';exception when check_violation then null;end;
 begin update public.advertisements set original_sound=null;raise exception 'NULL sound accepted';exception when not_null_violation then null;end;
 begin perform public.reorder_advertisements(null);raise exception 'NULL reorder accepted';exception when raise_exception then if SQLERRM<>'Advertisement inventory changed; reload before reordering' then raise;end if;end;
 select array_agg(id order by sort_order,id) into ids from public.advertisements;
 perform public.reorder_advertisements(ids);
 delete from public.advertisements where id='f5000000-0000-4000-8000-000000000001';
end $$;
reset role;
rollback;
select 'PASS: advertisement admin RLS, defaults, constraints and reorder; no media retained' as result;
