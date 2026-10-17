-- Approved isolated test project only. No retained fixtures or configuration changes.
begin;
insert into public.advertisements(id,title,url,is_active) values
 ('f6000000-0000-4000-8000-000000000001','Visible ad SQL fixture','https://example.invalid/active.mp4',true),
 ('f6000000-0000-4000-8000-000000000002','Hidden ad SQL fixture','https://example.invalid/inactive.mp4',false);
set local role anon;
do $$ begin
 if (select count(*) from public.ad_playback_settings) <> 1 then raise exception 'anon settings read failed';end if;
 if exists(select 1 from public.advertisements where not is_active) then raise exception 'inactive ads exposed';end if;
 if not exists(select 1 from public.advertisements where id='f6000000-0000-4000-8000-000000000001') then raise exception 'active ads hidden';end if;
 if public.read_ad_playback()->'settings' is null then raise exception 'anon RPC read failed';end if;
 begin update public.ad_playback_settings set enabled=true;raise exception 'anon UPDATE accepted';exception when insufficient_privilege then null;end;
 begin insert into public.ad_playback_settings(id) values(1);raise exception 'anon INSERT accepted';exception when insufficient_privilege then null;end;
 begin delete from public.ad_playback_settings;raise exception 'anon DELETE accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local request.jwt.claim.sub='';
set local request.jwt.claims='{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"admin"}}';
set local role authenticated;
do $$ declare n integer;begin
 update public.ad_playback_settings set enabled=not enabled;
 get diagnostics n=row_count; if n<>0 then raise exception 'ordinary UPDATE accepted';end if;
 if public.read_ad_playback()->'settings' is null then raise exception 'ordinary read failed';end if;
 begin insert into public.ad_playback_settings(id) values(1);raise exception 'ordinary INSERT accepted';exception when insufficient_privilege then null;end;
 begin delete from public.ad_playback_settings;raise exception 'ordinary DELETE accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local request.jwt.claims='{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
do $$ declare n integer;begin
 update public.ad_playback_settings set enabled=true,interval_minutes=15,block_count=0;
 get diagnostics n=row_count;if n<>1 then raise exception 'admin update failed';end if;
 begin update public.ad_playback_settings set interval_minutes=1;raise exception 'accelerated interval accepted';exception when check_violation then null;end;
 begin update public.ad_playback_settings set block_count=4;raise exception 'invalid count accepted';exception when check_violation then null;end;
 begin update public.ad_playback_settings set enabled=null;raise exception 'NULL accepted';exception when not_null_violation then null;end;
 begin update public.ad_playback_settings set id=2;raise exception 'id update accepted';exception when insufficient_privilege then null;end;
 begin insert into public.ad_playback_settings(id) values(1);raise exception 'admin INSERT accepted';exception when insufficient_privilege then null;end;
 begin delete from public.ad_playback_settings;raise exception 'admin DELETE accepted';exception when insufficient_privilege then null;end;
 update public.advertisements set cover_url='https://example.invalid/cover.jpg' where id='f6000000-0000-4000-8000-000000000001';
 begin update public.advertisements set cover_url='http://example.invalid/cover.jpg';raise exception 'unsafe cover accepted';exception when check_violation then null;end;
 begin update public.advertisements set cover_url=repeat('x',2049);raise exception 'oversize cover accepted';exception when check_violation then null;end;
 insert into public.media_metadata(kind,source_key,cover_url) values('video','f6000000-0000-4000-8000-000000000001','https://example.invalid/cover.jpg');
 begin update public.media_metadata set cover_url='javascript:alert(1)' where source_key='f6000000-0000-4000-8000-000000000001';raise exception 'unsafe metadata cover accepted';exception when check_violation then null;end;
end $$;
reset role;
rollback;
select 'PASS: ad settings + active-only read/RPC + admin UPDATE + INSERT/DELETE/invalid/cover restrictions; rolled back' as result;
