-- TEST PROJECT ONLY. Transactional fixtures. Never run against production.
begin;
create function pg_temp.assert_true(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',msg;end if;end$$;
insert into auth.users(id,email) values('f01d0000-0000-4000-8000-000000000001','taxonomy-admin@example.invalid'),('f01d0000-0000-4000-8000-000000000002','taxonomy-user@example.invalid');
insert into public.user_roles(user_id,role) values('f01d0000-0000-4000-8000-000000000001','admin') on conflict do nothing;
delete from public.user_roles where user_id='f01d0000-0000-4000-8000-000000000002';
insert into public.videos(id,title,url,duration_seconds,sort_order,is_active,is_test) values
 ('f01d0000-0000-4000-8000-000000000011','Taxonomy fixture A','https://example.invalid/shared.mp4',30,99991,true,true),
 ('f01d0000-0000-4000-8000-000000000012','Taxonomy fixture B','https://example.invalid/shared.mp4',45,99992,true,true);
select pg_temp.assert_true((select count(*)=12 from public.video_categories),'12 categories');
select pg_temp.assert_true((select count(*)=65 from public.video_tags),'65 tags');
select pg_temp.assert_true((select count(*)=7 from public.video_content_formats),'7 formats');
set local role anon;
do $$begin
 begin perform count(*) from public.video_tags;raise exception 'anon read unexpectedly allowed';exception when insufficient_privilege then null;end;
 begin perform public.classify_videos(array['f01d0000-0000-4000-8000-000000000011']::uuid[],'{}');raise exception 'anon mutation unexpectedly allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"f01d0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.video_tags),'normal user cannot read taxonomy');
do $$declare n integer;begin
 begin insert into public.video_tags(slug,name,group_key) values('forbidden','Forbidden','feature');raise exception 'normal insert allowed';exception when insufficient_privilege then null;end;
 update public.video_categories set description='forbidden';get diagnostics n=row_count;if n<>0 then raise exception 'normal update allowed';end if;
 delete from public.video_tags;get diagnostics n=row_count;if n<>0 then raise exception 'normal delete allowed';end if;
 begin perform public.classify_videos(array['f01d0000-0000-4000-8000-000000000011']::uuid[],'{}');raise exception 'normal RPC allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"f01d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.video_categories(id,slug,name) values('f01d0000-0000-4000-8000-000000000021','fixture-category','Fixture category');
update public.video_categories set description='Edited',sort_order=99 where slug='fixture-category';
insert into public.video_tags(id,slug,name,group_key,aliases) values
 ('f01d0000-0000-4000-8000-000000000031','fixture-tag-a','Fixture tag A','feature',array['Fixture alias A']),
 ('f01d0000-0000-4000-8000-000000000032','fixture-tag-b','Fixture tag B','feature','{}');
do $$begin
 begin insert into public.video_tags(slug,name,group_key) values('fixture-duplicate',' fixture ALIAS A ','feature');raise exception 'alias collision allowed';exception when unique_violation then null;end;
end$$;
select public.classify_videos(array['f01d0000-0000-4000-8000-000000000011','f01d0000-0000-4000-8000-000000000012']::uuid[],jsonb_build_object('category_id','f01d0000-0000-4000-8000-000000000021','format_id',(select id from public.video_content_formats where slug='clinical-process'),'review_status','classified','wow_score',80,'tags_add',jsonb_build_array('f01d0000-0000-4000-8000-000000000031','f01d0000-0000-4000-8000-000000000032')));
select pg_temp.assert_true((select count(*)=4 from public.video_tag_relations where video_id in('f01d0000-0000-4000-8000-000000000011','f01d0000-0000-4000-8000-000000000012')),'multi-tag bulk');
select public.merge_video_tags('f01d0000-0000-4000-8000-000000000031','f01d0000-0000-4000-8000-000000000032');
select pg_temp.assert_true((select count(*)=2 from public.video_tag_relations where tag_id='f01d0000-0000-4000-8000-000000000032'),'merge preserves unique links');
select pg_temp.assert_true(exists(select 1 from public.video_tag_aliases where normalized='fixture alias a' and tag_id='f01d0000-0000-4000-8000-000000000032'),'merge preserves synonyms');
do $$begin
 begin perform public.classify_videos(array['f01d0000-0000-4000-8000-000000000011']::uuid[],'{"wow_score":101}');raise exception 'WOW constraint missing';exception when check_violation then null;end;
 begin perform public.classify_videos(array['f01d0000-0000-4000-8000-000000000011']::uuid[],'{"category_id":null,"review_status":"classified"}');raise exception 'classified nullable category allowed';exception when check_violation then null;end;
 begin perform public.classify_videos(array['f01d0000-0000-4000-8000-000000000011']::uuid[],'{"tags_replace":["f01d0000-0000-4000-8000-000000000099"]}');raise exception 'invalid tag allowed';exception when foreign_key_violation then null;end;
end$$;
select pg_temp.assert_true((select count(*)=1 from public.video_tag_relations where video_id='f01d0000-0000-4000-8000-000000000011'),'failed replace rolls back');
select public.classify_videos(array['f01d0000-0000-4000-8000-000000000012']::uuid[],'{"category_id":null,"format_id":null,"review_status":"needs_classification","tags_replace":[]}');
select pg_temp.assert_true(exists(select 1 from public.videos where id='f01d0000-0000-4000-8000-000000000012' and is_active),'unclassified video remains playable');
update public.videos set is_active=false where id='f01d0000-0000-4000-8000-000000000012';
select pg_temp.assert_true(exists(select 1 from public.videos where id='f01d0000-0000-4000-8000-000000000012' and not is_active),'disable does not delete');
do $$begin
 begin perform public.delete_video_records(array['f01d0000-0000-4000-8000-000000000011']::uuid[],'wrong');raise exception 'delete without confirmation allowed';exception when raise_exception then if sqlerrm='delete without confirmation allowed' then raise;end if;end;
end$$;
select public.delete_video_records(array['f01d0000-0000-4000-8000-000000000011']::uuid[],'ВИДАЛИТИ 1');
select pg_temp.assert_true(not exists(select 1 from public.video_tag_relations where video_id='f01d0000-0000-4000-8000-000000000011'),'delete cascades relations');
select pg_temp.assert_true(exists(select 1 from public.videos where id='f01d0000-0000-4000-8000-000000000012' and url='https://example.invalid/shared.mp4'),'shared file reference survives');
reset role;
rollback;
select 'PASS: anon/user/admin RLS, 12/65/7 seeds, aliases, merge, atomic bulk, limits, nullable fields, disable, guarded delete, shared MP4' result;
