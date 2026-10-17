-- Run only in the pinned integration project or disposable equivalent.
begin;
insert into public.advertisements(title,url,is_active)
 select 'SQL capacity fixture ' || n, 'https://example.invalid/capacity.mp4', true
 from generate_series(1,1001) n;
set local role anon;
do $$ begin
 if jsonb_array_length(public.read_ad_playback()->'advertisements') <> 1001 then
   raise exception 'RPC silently truncates the all-ads block; missing overflow sentinel';
 end if;
end $$;
reset role;
rollback;
select 'PASS: oversized active library has overflow sentinel; all 1001 fixtures rolled back' as result;
