-- Run ONLY through scripts/test-sql.mjs against a disposable/local or explicit staging database.
-- Standard PostgreSQL assertions: any unexpected outcome raises an exception and fails the runner.
-- Requires original Drizzle schema + the prepared playback_settings migration.
begin;
do $$ begin
  if current_setting('smile.isolated_sql_test', true) is distinct from 'on' then
    raise exception 'Use the isolated SQL test runner; never run this on production';
  end if;
  if to_regprocedure('public.has_role(uuid,public.app_role)') is null then raise exception 'Incompatible has_role signature'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.playback_settings'::regclass) then raise exception 'RLS is disabled'; end if;
  if not has_column_privilege('anon', 'public.playback_settings', 'id', 'SELECT') then raise exception 'TV SELECT grant missing'; end if;
  if not has_column_privilege('authenticated', 'public.playback_settings', 'music_volume', 'UPDATE') then raise exception 'Admin column UPDATE grant missing'; end if;
  if has_column_privilege('authenticated', 'public.playback_settings', 'id', 'UPDATE') then raise exception 'Singleton id is writable'; end if;
  begin insert into public.playback_settings (id) values (2); raise exception 'Singleton id check missing'; exception when check_violation then null; end;
  begin insert into public.playback_settings (id) values (1); raise exception 'Duplicate singleton accepted'; exception when unique_violation then null; end;
end $$;

-- These users have no passwords and are never used for network login. All fixtures roll back.
insert into auth.users (id, email) values ('f1000000-0000-4000-8000-00000000000a', 'sql-admin@smile.test');
insert into public.user_roles (user_id, role) values ('f1000000-0000-4000-8000-00000000000a', 'admin') on conflict (user_id, role) do nothing;
insert into auth.users (id, email) values ('f1000000-0000-4000-8000-00000000000b', 'sql-user@smile.test');
insert into public.videos (id, title, url, is_active) values
  ('f2000000-0000-4000-8000-000000000001', 'SQL active fixture', 'https://example.invalid/sql-active.mp4', true),
  ('f2000000-0000-4000-8000-000000000002', 'SQL inactive fixture', 'https://example.invalid/sql-inactive.mp4', false);

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
do $$ begin
  if current_user <> 'anon' or auth.uid() is not null then raise exception 'Anon impersonation failed'; end if;
  if (select count(*) from public.playback_settings where id = 1) <> 1 then raise exception 'Anon cannot read singleton'; end if;
  if (select count(*) from public.videos where id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002')) <> 1 then raise exception 'Anon active-video read policy mismatch'; end if;
  begin update public.playback_settings set music_volume = 0.5 where id = 1; raise exception 'Anon UPDATE unexpectedly allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.playback_settings (id) values (1); raise exception 'Anon INSERT unexpectedly allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.playback_settings where id = 1; raise exception 'Anon DELETE unexpectedly allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-00000000000b","role":"authenticated","user_metadata":{"role":"admin"}}';
set local role authenticated;
do $$ declare affected integer; begin
  if current_user <> 'authenticated' or auth.uid() is distinct from 'f1000000-0000-4000-8000-00000000000b'::uuid then raise exception 'User impersonation failed'; end if;
  if public.has_role(auth.uid(), 'admin') then raise exception 'Ordinary fixture has admin role'; end if;
  if (select count(*) from public.playback_settings where id = 1) <> 1 then raise exception 'User SELECT failed'; end if;
  if (select count(*) from public.videos where id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002')) <> 1 then raise exception 'User active-video policy mismatch'; end if;
  update public.playback_settings set music_volume = 0.9 where id = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Non-admin UPDATE bypassed RLS'; end if;
  begin insert into public.playback_settings (id) values (1); raise exception 'User INSERT unexpectedly allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.playback_settings where id = 1; raise exception 'User DELETE unexpectedly allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-00000000000a","role":"authenticated"}';
set local role authenticated;
do $$ declare affected integer; column_name text; bad_value text; begin
  if current_user <> 'authenticated' or auth.uid() is distinct from 'f1000000-0000-4000-8000-00000000000a'::uuid then raise exception 'Admin impersonation failed'; end if;
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admin role lookup failed'; end if;
  if (select count(*) from public.playback_settings where id = 1) <> 1 then raise exception 'Admin SELECT failed'; end if;
  if (select count(*) from public.videos where id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002')) <> 2 then raise exception 'Admin all-video read policy mismatch'; end if;
  -- Same column-limited UPDATE + RETURNING used by the browser API.
  update public.playback_settings set music_urls = array['https://example.invalid/sql.mp3'], music_volume = 0.5, video_volume = 0.7, duck_volume = 0.2, original_video_ids = array['f2000000-0000-4000-8000-000000000001'::uuid] where id = 1 returning id into affected;
  if affected <> 1 then raise exception 'Admin UPDATE RETURNING failed'; end if;
  if (select music_volume from public.playback_settings where id = 1) <> 0.5 then raise exception 'Admin update not stored'; end if;
  begin update public.playback_settings set id = 2 where id = 1; raise exception 'Admin id UPDATE unexpectedly allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.playback_settings (id) values (1); raise exception 'Admin INSERT unexpectedly allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.playback_settings where id = 1; raise exception 'Admin DELETE unexpectedly allowed'; exception when insufficient_privilege then null; end;
  foreach column_name in array array['music_volume','video_volume','duck_volume'] loop
    execute format('update public.playback_settings set %I = 0 where id = 1', column_name);
    execute format('update public.playback_settings set %I = 1 where id = 1', column_name);
    foreach bad_value in array array['-0.01','1.01','NaN','Infinity','-Infinity'] loop
      begin execute format('update public.playback_settings set %I = $1::double precision where id = 1', column_name) using bad_value; raise exception 'Invalid volume accepted: %', column_name; exception when check_violation then null; end;
    end loop;
    begin execute format('update public.playback_settings set %I = null where id = 1', column_name); raise exception 'NULL volume accepted'; exception when not_null_violation then null; end;
  end loop;
  begin update public.playback_settings set music_urls = null where id = 1; raise exception 'NULL music list accepted'; exception when not_null_violation then null; end;
  begin update public.playback_settings set music_urls = array[null::text] where id = 1; raise exception 'NULL music element accepted'; exception when check_violation then null; end;
  update public.playback_settings set music_urls = array_fill('https://example.invalid/sql.mp3'::text, array[500]) where id = 1;
  begin update public.playback_settings set music_urls = array_fill('https://example.invalid/sql.mp3'::text, array[501]) where id = 1; raise exception 'Music count limit bypassed'; exception when check_violation then null; end;
  begin update public.playback_settings set original_video_ids = array['bad-id'::uuid] where id = 1; raise exception 'Invalid UUID accepted'; exception when invalid_text_representation then null; end;
  begin update public.playback_settings set original_video_ids = null where id = 1; raise exception 'NULL IDs list accepted'; exception when not_null_violation then null; end;
  begin update public.playback_settings set original_video_ids = array[null::uuid] where id = 1; raise exception 'NULL UUID element accepted'; exception when check_violation then null; end;
  update public.playback_settings set original_video_ids = array_fill('f2000000-0000-4000-8000-000000000001'::uuid, array[10000]) where id = 1;
  begin update public.playback_settings set original_video_ids = array_fill('f2000000-0000-4000-8000-000000000001'::uuid, array[10001]) where id = 1; raise exception 'ID count limit bypassed'; exception when check_violation then null; end;
end $$;
reset role;
-- No test fixture, settings update or role assignment is retained.
rollback;
