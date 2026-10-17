-- TEST database only; every fixture and library/screen change rolls back.
begin;
do $$ begin if current_setting('smile.isolated_sql_test',true) is distinct from 'on' then raise exception 'Isolated test confirmation required'; end if; end $$;
insert into auth.users(id,email) values('b9000000-0000-4000-8000-000000000001','profiles-admin@smile.test'),('b9000000-0000-4000-8000-000000000002','profiles-user@smile.test');
insert into public.user_roles(user_id,role) values('b9000000-0000-4000-8000-000000000001','admin');
update public.playback_settings set music_urls=array['https://example.invalid/profiles-a.mp3','https://example.invalid/profiles-b.mp3'] where id=1;
set local request.jwt.claims='{"sub":"b9000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select public.save_music_profile('{"id":"b9100000-0000-4000-8000-000000000001","name":"Default one","description":"","is_active":true,"is_default":true,"sort_order":1,"volume_override":0.2,"track_urls":["https://example.invalid/profiles-b.mp3","https://example.invalid/profiles-a.mp3"]}');
select public.save_music_profile('{"id":"b9100000-0000-4000-8000-000000000002","name":"Default two","description":"","is_active":true,"is_default":true,"sort_order":2,"volume_override":null,"track_urls":[]}');
insert into public.music_profiles(id,name,is_active) values('b9100000-0000-4000-8000-000000000003','Inactive',false);
do $$ declare affected integer; begin
 if(select count(*) from public.music_profiles where is_default)<>1 then raise exception 'Default uniqueness failed'; end if;
 if(select track_urls[1] from public.music_profiles where id='b9100000-0000-4000-8000-000000000001')<>'https://example.invalid/profiles-b.mp3' then raise exception 'Track order lost'; end if;
 begin update public.music_profiles set volume_override=2 where id='b9100000-0000-4000-8000-000000000001'; raise exception 'Invalid volume accepted'; exception when check_violation then null; end;
 begin update public.music_profiles set track_urls=array['https://example.invalid/not-in-library.mp3'] where id='b9100000-0000-4000-8000-000000000001'; raise exception 'External track accepted'; exception when raise_exception then if sqlerrm='External track accepted' then raise; end if; end;
 begin update public.music_profiles set track_urls=array['https://example.invalid/profiles-a.mp3','https://example.invalid/profiles-a.mp3'] where id='b9100000-0000-4000-8000-000000000001'; raise exception 'Duplicate accepted'; exception when raise_exception then if sqlerrm='Duplicate accepted' then raise; end if; end;
 begin perform public.reorder_music_profiles(array['b9100000-0000-4000-8000-000000000001'::uuid]); raise exception 'Partial reorder accepted'; exception when raise_exception then if sqlerrm='Partial reorder accepted' then raise; end if; end;
end $$;
reset role;
set local request.jwt.claims='{"role":"anon"}';
set local role anon;
do $$ declare affected integer; begin
 if(select count(*) from public.music_profiles where id in('b9100000-0000-4000-8000-000000000001','b9100000-0000-4000-8000-000000000002'))<>2 then raise exception 'TV read failed'; end if;
 if exists(select 1 from public.music_profiles where id='b9100000-0000-4000-8000-000000000003') then raise exception 'Inactive exposed'; end if;
 begin insert into public.music_profiles(name) values('forbidden'); raise exception 'Anon insert allowed'; exception when insufficient_privilege then null; end;
 begin update public.music_profiles set name='forbidden'; raise exception 'Anon update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.music_profiles; raise exception 'Anon delete allowed'; exception when insufficient_privilege then null; end;
 begin perform public.save_music_profile('{}'); raise exception 'Anon RPC allowed'; exception when insufficient_privilege then null; end;
 begin update public.screens set last_selected_music_profile_id=null; get diagnostics affected=row_count; if affected<>0 then raise exception 'Anon screen write allowed'; end if; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local request.jwt.claims='{"sub":"b9000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
do $$ declare n integer; begin
 update public.music_profiles set name='forbidden'; get diagnostics n=row_count; if n<>0 then raise exception 'User updated profiles'; end if;
 delete from public.music_profiles; get diagnostics n=row_count; if n<>0 then raise exception 'User deleted profiles'; end if;
 begin insert into public.music_profiles(name)values('forbidden'); raise exception 'User insert allowed'; exception when insufficient_privilege then null; end;
 begin perform public.save_music_profile('{}'); raise exception 'User RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local request.jwt.claims='{"sub":"b9000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
update public.screens set last_selected_music_profile_id='b9100000-0000-4000-8000-000000000002',default_music_profile_id='b9100000-0000-4000-8000-000000000002';
delete from public.music_profiles where id='b9100000-0000-4000-8000-000000000002';
do $$ begin if exists(select 1 from public.screens where last_selected_music_profile_id is not null or default_music_profile_id is not null) then raise exception 'Delete did not clear screen references'; end if; end $$;
reset role;
rollback;
