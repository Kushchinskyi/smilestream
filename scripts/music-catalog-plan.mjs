import { createHash } from "node:crypto";

const digest = (text) => createHash("sha256").update(text).digest("hex");
const https = (text) => {
  if (typeof text !== "string" || /[\s\\]/.test(text)) return false;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password && text.length <= 2048;
  } catch {
    return false;
  }
};

export function admitted(track, evidenceIds) {
  return (
    track.status === "verified" &&
    https(track.url) &&
    https(track.sourceUrl) &&
    https(track.licenseUrl) &&
    ["CC-BY-4.0", "CC0-1.0"].includes(track.license) &&
    track.rights?.composition &&
    track.rights?.recording &&
    track.rights?.commercialPermission &&
    track.rights.evidenceIds?.length > 0 &&
    track.rights.evidenceIds.every((id) => evidenceIds.has(id)) &&
    (!track.rights.attributionRequired || Boolean(track.attribution)) &&
    track.technical?.decoded === true &&
    track.technical.codec?.codec_name === "mp3" &&
    [1, 2].includes(track.technical.codec.channels) &&
    [200, 206].includes(track.technical.http?.status) &&
    track.technical.http.url === track.url &&
    track.technical.durationSeconds > 60 &&
    /^[a-f0-9]{64}$/.test(track.technical.sha256)
  );
}

function uuid(name) {
  const hex = digest("smilestream-music-catalog-2026-10-17:" + name).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

// A reproducible initial order, not a new runtime scheduler. Each profile stays ordered in DB.
function order(tracks) {
  const remaining = [...tracks].sort((a, b) => digest(a.id).localeCompare(digest(b.id)));
  const result = [];
  while (remaining.length) {
    const previous = result.at(-1);
    const candidates = remaining.map((track, i) => ({
      i,
      score: previous
        ? Math.abs(track.technical.integratedLufs - previous.technical.integratedLufs) +
          (track.artist === previous.artist ? 1 : 0)
        : 0,
    }));
    candidates.sort((a, b) => a.score - b.score || a.i - b.i);
    result.push(remaining.splice(candidates[0].i, 1)[0]);
  }
  return result;
}

export function prepareMusicCatalog(registry) {
  const evidenceIds = new Set(registry.evidence.map((item) => item.id));
  const verified = registry.tracks.filter((track) => track.status === "verified");
  if (!verified.every((track) => admitted(track, evidenceIds)))
    throw new Error("Verified track lacks rights evidence, attribution or successful audio checks");
  if (new Set(verified.map((track) => track.url)).size !== verified.length)
    throw new Error("Duplicate source URL");
  if (new Set(verified.map((track) => track.technical.sha256)).size !== verified.length)
    throw new Error("Duplicate recording bytes");
  if (verified.length > 500) throw new Error("Music library capacity exceeded");
  const names = registry.profiles;
  if (names.length !== 7 || names[6] !== "Автомікс") throw new Error("Expected seven profiles");
  const main = names.slice(0, 6).map((name) => ({
    name,
    tracks: order(verified.filter((track) => track.candidateProfile === name)).slice(0, 50),
  }));
  if (main.reduce((sum, profile) => sum + profile.tracks.length, 0) !== verified.length)
    throw new Error("Unassigned verified track or profile capacity exceeded");
  const queues = main.map((profile) =>
    profile.tracks.filter((t) => t.technical.durationSeconds <= 600),
  );
  const mix = [];
  while (mix.length < 50 && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      if (mix.length < 50 && queue.length) mix.push(queue.shift());
    }
  }
  const profiles = [...main, { name: "Автомікс", tracks: order(mix) }].map((profile, index) => ({
    id: uuid(profile.name),
    name: profile.name,
    description:
      profile.name === "Автомікс"
        ? "Добірка з шести музичних профілів · інструментальне тло для клініки."
        : `${profile.tracks.length} перевірених записів · ${profile.name.includes("Deep House") ? "Спокійна електроніка; добірка поки без deep-house записів." : "Добірка для спокійного фонового прослуховування."}`,
    is_active: profile.tracks.length > 0,
    is_default: profile.name === "Автомікс" && profile.tracks.length > 0,
    sort_order: index + 1,
    volume_override: null,
    track_urls: profile.tracks.map((track) => track.url),
  }));
  return { tracks: verified, profiles };
}

// Offline export only: no credentials, client, network or automatic execution.
// Guards deliberately refuse to overwrite a live library/profile set populated since inspection.
export function musicImportSql(plan, guard) {
  if (
    !guard ||
    !/^[a-f0-9]{32}$/.test(guard.videoFingerprint) ||
    !/^[a-f0-9]{32}$/.test(guard.rolesFingerprint)
  )
    throw new Error("Fresh production fingerprints required");
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const payload = literal(
    JSON.stringify({
      urls: plan.tracks.map((track) => track.url),
      metadata: plan.tracks.map((track) => ({
        url: track.url,
        label: `${track.title} — ${track.artist}`,
      })),
      profiles: plan.profiles,
    }),
  );
  return `-- CONTENT ONLY. Manually reviewed production batch; not a schema migration.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(702103);
lock table public.playback_settings, public.music_profiles, public.media_metadata in share row exclusive mode;
do $import$
declare payload jsonb := ${payload}::jsonb; row_data jsonb; urls text[]; before_settings jsonb;
begin
 if (select md5(jsonb_agg(to_jsonb(v) order by id)::text) from public.videos v) is distinct from ${literal(guard.videoFingerprint)}
 or (select md5(jsonb_agg(to_jsonb(r) order by user_id)::text) from public.user_roles r) is distinct from ${literal(guard.rolesFingerprint)}
 then raise exception 'Protected data changed: inspect again'; end if;
 select to_jsonb(s) into before_settings from public.playback_settings s where id=1;
 if before_settings is distinct from ${literal(JSON.stringify(guard.audio))}::jsonb
 or exists(select 1 from public.music_profiles)
 or exists(select 1 from public.advertisements)
 or (select jsonb_agg(to_jsonb(a)) from public.ad_playback_settings a) is distinct from ${literal(JSON.stringify(guard.adSettings))}::jsonb
 then raise exception 'Library/profiles/advertisements changed: inspect again'; end if;
 select array_agg(value order by ordinality) into urls from jsonb_array_elements_text(payload->'urls') with ordinality;
 if cardinality(urls)>500 or cardinality(urls)<>(select count(distinct x) from unnest(urls)t(x)) then raise exception 'Invalid batch'; end if;
 update public.playback_settings set music_urls=music_urls || urls where id=1;
 for row_data in select value from jsonb_array_elements(payload->'metadata') loop
  insert into public.media_metadata(kind,source_key,label,category)
  values('music',row_data->>'url',row_data->>'label','other') on conflict(kind,source_key) do nothing;
 end loop;
 for row_data in select value from jsonb_array_elements(payload->'profiles') loop
  insert into public.music_profiles(id,name,description,is_active,is_default,sort_order,volume_override,track_urls)
  values((row_data->>'id')::uuid,row_data->>'name',row_data->>'description',(row_data->>'is_active')::boolean,(row_data->>'is_default')::boolean,(row_data->>'sort_order')::integer,null,array(select jsonb_array_elements_text(row_data->'track_urls')));
 end loop;
 if (select to_jsonb(s)-'music_urls' from public.playback_settings s where id=1) is distinct from before_settings-'music_urls' then raise exception 'Protected audio settings changed'; end if;
 if (select md5(jsonb_agg(to_jsonb(v) order by id)::text) from public.videos v) is distinct from ${literal(guard.videoFingerprint)}
 or (select md5(jsonb_agg(to_jsonb(r) order by user_id)::text) from public.user_roles r) is distinct from ${literal(guard.rolesFingerprint)} then raise exception 'Protected data changed'; end if;
end $import$;
commit;
`;
}
