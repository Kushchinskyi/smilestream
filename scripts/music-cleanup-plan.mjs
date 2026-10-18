// Generates reviewable SQL only. Storage bytes must be deleted through Storage,
// never DELETE FROM storage.objects (which would leave orphaned physical files).
export function musicCleanupSql(snapshot) {
  const urls = snapshot.audio?.music_urls;
  if (
    !Array.isArray(urls) ||
    urls.length !== 59 ||
    new Set(urls).size !== 59 ||
    snapshot.profiles?.length !== 7 ||
    snapshot.metadata?.length !== 59 ||
    snapshot.objects?.length !== 59 ||
    snapshot.other_references !== null ||
    snapshot.protected?.video_count !== 25
  )
    throw Error("Expected complete inspected legacy inventory without external references");
  const prefix =
    "https://ieytvixchndxnxsxpcot.supabase.co/storage/v1/object/public/smilestream-music/";
  if (
    urls.some(
      (url) => !url.startsWith(prefix) || !/^[a-f0-9]{16}\.mp3$/.test(url.slice(prefix.length)),
    ) ||
    snapshot.metadata.some((row) => row.kind !== "music" || !urls.includes(row.source_key)) ||
    snapshot.objects.some((obj) => !urls.includes(prefix + obj.name)) ||
    snapshot.profiles.some((p) => p.track_urls.some((url) => !urls.includes(url)))
  )
    throw Error("Unknown URLs, objects or dependencies: inspect again");
  const literal = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  const protectedSql = `jsonb_build_object('videos',(select md5(jsonb_agg(to_jsonb(v) order by id)::text) from public.videos v),'video_count',(select count(*) from public.videos),'screens',(select md5(jsonb_agg(to_jsonb(s) order by id)::text) from public.screens s),'roles',(select md5(jsonb_agg(to_jsonb(r) order by user_id)::text) from public.user_roles r),'auth_count',(select count(*) from auth.users),'ads',(select jsonb_agg(to_jsonb(a) order by id) from public.advertisements a),'ad_settings',(select jsonb_agg(to_jsonb(a)) from public.ad_playback_settings a))`;
  return `-- Authorized legacy music removal only. Not a schema migration. No Storage SQL deletion.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(702103);
lock table public.playback_settings, public.music_profiles, public.media_metadata,
 public.videos, public.screens, public.user_roles, public.advertisements, public.ad_playback_settings
 in share row exclusive mode;
do $cleanup$
declare before_audio jsonb := ${literal(snapshot.audio)};
 before_profiles jsonb := ${literal(snapshot.profiles)};
 before_metadata jsonb := ${literal(snapshot.metadata)};
 protected jsonb := ${literal(snapshot.protected)};
begin
 if (select to_jsonb(s) from public.playback_settings s where id=1) is distinct from before_audio
 or (select jsonb_agg(to_jsonb(p) order by sort_order,id) from public.music_profiles p) is distinct from before_profiles
 or (select jsonb_agg(to_jsonb(m) order by kind,source_key) from public.media_metadata m) is distinct from before_metadata
 or ${protectedSql} is distinct from protected
 then raise exception 'Snapshot changed: inspect again'; end if;
 update public.playback_settings set music_urls='{}'::text[] where id=1;
 update public.music_profiles set track_urls='{}'::text[] where id in
 (select (p->>'id')::uuid from jsonb_array_elements(before_profiles) p);
 delete from public.media_metadata where kind='music' and source_key in
 (select jsonb_array_elements_text(before_audio->'music_urls'));
 if (select to_jsonb(s)-'music_urls' from public.playback_settings s where id=1) is distinct from before_audio-'music_urls'
 or exists(select 1 from public.playback_settings where cardinality(music_urls)>0)
 or exists(select 1 from public.music_profiles where cardinality(track_urls)>0)
 or (select jsonb_agg(to_jsonb(p)-'track_urls' order by sort_order,id) from public.music_profiles p)
 is distinct from (select jsonb_agg(p-'track_urls' order by (p->>'sort_order')::integer,p->>'id') from jsonb_array_elements(before_profiles) p)
 or exists(select 1 from public.media_metadata where kind='music')
 or ${protectedSql} is distinct from protected
 then raise exception 'Cleanup postcondition failed'; end if;
end $cleanup$;
commit;
`;
}
