-- One extra row is an overflow sentinel: clients reject >1000 instead of silently
-- interpreting a truncated inventory as "all". Preserve invoker/RLS/grants.
create or replace function public.read_ad_playback() returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('settings', to_jsonb(s) - 'id', 'advertisements',
   coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order,a.id)
     from (select id,title,url,duration_seconds,sort_order,is_active,original_sound
       from public.advertisements where is_active order by sort_order,id limit 1001) a), '[]'::jsonb))
 from public.ad_playback_settings s where id = 1
$$;
create index advertisements_playback_order on public.advertisements(sort_order,id) where is_active;
