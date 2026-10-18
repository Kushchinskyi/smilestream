-- Additive taxonomy. No changes to videos, playback order, Auth or Storage.
begin;
set local lock_timeout='5s';
create table if not exists public.video_categories (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{0,79}$'),
 name text not null check(length(btrim(name)) between 1 and 120), description text not null default '' check(length(description)<=1000),
 sort_order integer not null default 0, is_active boolean not null default true
);
create table if not exists public.video_content_formats (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{0,79}$'),
 name text not null check(length(btrim(name)) between 1 and 120), sort_order integer not null default 0, is_active boolean not null default true
);
create table if not exists public.video_tags (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{0,79}$'),
 name text not null check(length(btrim(name)) between 1 and 120),
 group_key text not null check(group_key in ('direction','procedure','technology','material','stage','feature')),
 aliases text[] not null default '{}' check(cardinality(aliases)<=30), is_active boolean not null default true
);
create table if not exists public.video_tag_aliases (
 group_key text not null, normalized text not null check(length(normalized) between 1 and 120),
 tag_id uuid not null references public.video_tags(id) on delete cascade,
 primary key(group_key,normalized)
);
create index if not exists video_tag_aliases_tag_idx on public.video_tag_aliases(tag_id);
create unique index if not exists video_categories_name_idx on public.video_categories(lower(btrim(name)));
create unique index if not exists video_content_formats_name_idx on public.video_content_formats(lower(btrim(name)));
create table if not exists public.video_classification (
 video_id uuid primary key references public.videos(id) on delete cascade,
 category_id uuid references public.video_categories(id) on delete restrict,
 format_id uuid references public.video_content_formats(id) on delete restrict,
 wow_score smallint check(wow_score between 0 and 100),
 -- No cases table exists yet: optional UUID reference reserved for that future entity.
 case_id uuid,
 review_status text not null default 'needs_classification' check(review_status in ('needs_classification','classified')),
 evidence text not null default '' check(length(evidence)<=1000)
);
create index if not exists video_classification_category_idx on public.video_classification(category_id);
create index if not exists video_classification_format_idx on public.video_classification(format_id);
create index if not exists video_classification_case_idx on public.video_classification(case_id) where case_id is not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.video_classification'::regclass and conname='classified_has_category_format') then
  alter table public.video_classification add constraint classified_has_category_format check(review_status<>'classified' or (category_id is not null and format_id is not null));
 end if;
end $$;
create table if not exists public.video_tag_relations (
 video_id uuid not null references public.videos(id) on delete cascade,
 tag_id uuid not null references public.video_tags(id) on delete restrict,
 primary key(video_id,tag_id)
);
create index if not exists video_tag_relations_tag_video_idx on public.video_tag_relations(tag_id,video_id);
do $security$
declare tbl text;
begin
 foreach tbl in array array['video_categories','video_content_formats','video_tags','video_tag_aliases','video_classification','video_tag_relations'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select,insert,update,delete on public.%I to authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname='taxonomy_admin') then
   execute format('create policy taxonomy_admin on public.%I for all to authenticated using ((select public.has_role((select auth.uid()),''admin''))) with check ((select public.has_role((select auth.uid()),''admin'')))',tbl);
  end if;
 end loop;
end $security$;

create or replace function public.protect_video_taxonomy_identity() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.id is distinct from old.id or new.slug is distinct from old.slug then raise exception 'Dictionary ID and slug are permanent';end if;
 return new;
end $$;
revoke all on function public.protect_video_taxonomy_identity() from public,anon;
do $$declare tbl text;begin
 foreach tbl in array array['video_categories','video_content_formats','video_tags'] loop
  execute format('drop trigger if exists taxonomy_identity on public.%I',tbl);
  execute format('create trigger taxonomy_identity before update of id,slug on public.%I for each row execute function public.protect_video_taxonomy_identity()',tbl);
 end loop;
end $$;

create or replace function public.sync_video_tag_aliases() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(702105);
 delete from public.video_tag_aliases where tag_id=new.id;
 insert into public.video_tag_aliases(group_key,normalized,tag_id)
 select new.group_key,lower(regexp_replace(btrim(x),'\s+',' ','g')),new.id
 from (select distinct unnest(array_prepend(new.name,new.aliases)) x) names
 group by 1,2;
 return new;
end $$;
drop trigger if exists video_tags_alias_sync on public.video_tags;
create trigger video_tags_alias_sync after insert or update of name,aliases,group_key on public.video_tags for each row execute function public.sync_video_tag_aliases();
revoke all on function public.sync_video_tag_aliases() from public,anon;

create or replace function public.classify_videos(p_ids uuid[],p_patch jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare vid uuid; item text;
begin
 if not public.has_role(auth.uid(),'admin') then raise insufficient_privilege;end if;
 if cardinality(p_ids) not between 1 and 500 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids)x)
 or exists(select 1 from unnest(p_ids)x where not exists(select 1 from public.videos v where v.id=x))
 or jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid batch';end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('category_id','format_id','wow_score','case_id','review_status','evidence','tags_add','tags_remove','tags_replace')) then raise exception 'Unexpected patch field';end if;
 if jsonb_array_length(coalesce(p_patch->'tags_add','[]'))>100 or jsonb_array_length(coalesce(p_patch->'tags_remove','[]'))>100 or jsonb_array_length(coalesce(p_patch->'tags_replace','[]'))>100 then raise exception 'Too many tags';end if;
 perform id from public.videos where id=any(p_ids) order by id for update;
 foreach vid in array p_ids loop
  insert into public.video_classification(video_id) values(vid) on conflict do nothing;
  update public.video_classification set
   category_id=case when p_patch?'category_id' then (p_patch->>'category_id')::uuid else category_id end,
   format_id=case when p_patch?'format_id' then (p_patch->>'format_id')::uuid else format_id end,
   wow_score=case when p_patch?'wow_score' then (p_patch->>'wow_score')::smallint else wow_score end,
   case_id=case when p_patch?'case_id' then (p_patch->>'case_id')::uuid else case_id end,
   review_status=coalesce(p_patch->>'review_status',review_status), evidence=coalesce(p_patch->>'evidence',evidence)
  where video_id=vid;
  if p_patch?'tags_replace' then delete from public.video_tag_relations where video_id=vid;end if;
  delete from public.video_tag_relations where video_id=vid and tag_id in(select value::uuid from jsonb_array_elements_text(coalesce(p_patch->'tags_remove','[]')));
  insert into public.video_tag_relations(video_id,tag_id) select vid,value::uuid from jsonb_array_elements_text(coalesce(p_patch->'tags_replace',p_patch->'tags_add','[]')) on conflict do nothing;
 end loop;
end $$;

create or replace function public.merge_video_tags(p_source uuid,p_target uuid) returns void
language plpgsql security invoker set search_path=public as $$
declare src public.video_tags; dst public.video_tags;
begin
 if not public.has_role(auth.uid(),'admin') then raise insufficient_privilege;end if;
 if p_source=p_target then raise exception 'Choose different tags';end if;
 perform pg_advisory_xact_lock(702105);
 select * into strict src from public.video_tags where id=p_source for update;
 select * into strict dst from public.video_tags where id=p_target for update;
 if src.group_key<>dst.group_key then raise exception 'Merge only within the same group';end if;
 insert into public.video_tag_relations(video_id,tag_id) select video_id,p_target from public.video_tag_relations where tag_id=p_source on conflict do nothing;
 delete from public.video_tag_relations where tag_id=p_source;
 delete from public.video_tags where id=p_source;
 update public.video_tags set aliases=array(select distinct x from unnest(dst.aliases||src.aliases||array[src.name])x where lower(btrim(x))<>lower(btrim(dst.name))) where id=p_target;
end $$;

create or replace function public.delete_video_records(p_ids uuid[],p_confirmation text) returns void
language plpgsql security invoker set search_path=public as $$
declare n integer:=cardinality(p_ids);
begin
 if not public.has_role(auth.uid(),'admin') then raise insufficient_privilege;end if;
 if n not between 1 and 500 or n<>(select count(distinct x) from unnest(p_ids)x) or p_confirmation is distinct from ('ВИДАЛИТИ '||n) then raise exception 'Explicit record count confirmation required';end if;
 perform id from public.videos where id=any(p_ids) order by id for update;
 if (select count(*) from public.videos where id=any(p_ids))<>n then raise exception 'Library changed';end if;
 delete from public.media_metadata where kind='video' and source_key=any(array(select x::text from unnest(p_ids)x));
 update public.playback_settings set original_video_ids=array(select x from unnest(original_video_ids)x where not x=any(p_ids)) where id=1;
 delete from public.videos where id=any(p_ids);
 -- No Storage API call or storage.objects mutation. External/R2 MP4 files remain intact.
end $$;
revoke all on function public.classify_videos(uuid[],jsonb),public.merge_video_tags(uuid,uuid),public.delete_video_records(uuid[],text) from public,anon;
grant execute on function public.classify_videos(uuid[],jsonb),public.merge_video_tags(uuid,uuid),public.delete_video_records(uuid[],text) to authenticated;
-- Seed data appended below by scripts/prepare-video-taxonomy.mjs.

-- BEGIN GENERATED DICTIONARY SEED (insert missing slugs; preserve administrator edits)
insert into public.video_categories(slug,name,description,sort_order) select x->>'slug',x->>'name',x->>'description',(x->>'sort_order')::integer from jsonb_array_elements('[{"slug":"diagnostics","name":"Діагностика та планування","description":"КЛКТ, рентгенографія, діагностичне сканування, аналіз та планування лікування.","sort_order":1},{"slug":"hygiene","name":"Профілактика та гігієна","description":"Професійна гігієна, щітки, пасти, іригатори, ополіскувачі, домашній догляд та профілактика.","sort_order":2},{"slug":"restorative","name":"Терапевтична стоматологія","description":"Карієс, композитні реставрації, адгезивні технології та пряме відновлення зубів.","sort_order":3},{"slug":"endodontics","name":"Ендодонтія","description":"Кореневі канали, ендодонтичні інструменти, обтурація та робота під мікроскопом.","sort_order":4},{"slug":"periodontics","name":"Пародонтологія","description":"Пародонт, ясна, м’які тканини та підтримувальна терапія.","sort_order":5},{"slug":"surgery","name":"Хірургія та імплантологія","description":"Видалення зубів, імплантація, кісткова пластика, синус-ліфтинг та хірургічні процедури.","sort_order":6},{"slug":"prosthodontics","name":"Ортопедична стоматологія","description":"Коронки, вініри, мости, знімні та незнімні протези, ортопедична реабілітація.","sort_order":7},{"slug":"orthodontics","name":"Ортодонтія","description":"Брекети, елайнери, апарати, розширення щелеп та цифрове планування переміщень.","sort_order":8},{"slug":"aesthetic","name":"Естетична стоматологія","description":"Відбілювання, естетичні реставрації, дизайн посмішки та естетичні перетворення.","sort_order":9},{"slug":"digital","name":"Цифрова стоматологія та CAD/CAM","description":"Інтраоральне сканування, CEREC, Exocad, Smile Design, CAD/CAM, 3D-друк та фрезерування.","sort_order":10},{"slug":"laboratory","name":"Зуботехнічна лабораторія","description":"Виготовлення коронок і протезів, кераміка, цирконій, полірування та постобробка.","sort_order":11},{"slug":"equipment","name":"Обладнання, матеріали та інфекційний контроль","description":"Установки, мікроскопи, інструменти, стерилізація, дезінфекція та стоматологічні матеріали.","sort_order":12}]'::jsonb) x on conflict(slug) do nothing;
insert into public.video_content_formats(slug,name,sort_order) select x->>'slug',x->>'name',(x->>'sort_order')::integer from jsonb_array_elements('[{"slug":"clinical-process","name":"Реальний клінічний процес","sort_order":1},{"slug":"clinical-case","name":"Клінічний кейс","sort_order":2},{"slug":"animation","name":"3D-анімація","sort_order":3},{"slug":"technology-process","name":"Технологічний процес","sort_order":4},{"slug":"equipment-demo","name":"Демонстрація обладнання","sort_order":5},{"slug":"wow","name":"WOW-візуалізація","sort_order":6},{"slug":"education","name":"Освітнє відео","sort_order":7}]'::jsonb) x on conflict(slug) do nothing;
insert into public.video_tags(slug,name,group_key,aliases) select x->>'slug',x->>'name',x->>'group_key',array(select jsonb_array_elements_text(x->'aliases')) from jsonb_array_elements('[{"slug":"direction-implantology","name":"Імплантологія","group_key":"direction","aliases":["Імплантація","implantology"]},{"slug":"direction-prosthodontics","name":"Протезування","group_key":"direction","aliases":["prosthodontics"]},{"slug":"direction-orthodontics","name":"Ортодонтія","group_key":"direction","aliases":["orthodontics"]},{"slug":"direction-endodontics","name":"Ендодонтія","group_key":"direction","aliases":["endodontics"]},{"slug":"direction-periodontics","name":"Пародонтологія","group_key":"direction","aliases":["periodontics"]},{"slug":"direction-restorative","name":"Терапевтична стоматологія","group_key":"direction","aliases":["restorative"]},{"slug":"direction-prevention","name":"Профілактика","group_key":"direction","aliases":["prevention"]},{"slug":"direction-surgery","name":"Хірургія","group_key":"direction","aliases":["surgery"]},{"slug":"direction-aesthetic","name":"Естетична стоматологія","group_key":"direction","aliases":["aesthetic"]},{"slug":"direction-dental-lab","name":"Зуботехніка","group_key":"direction","aliases":["dental lab"]},{"slug":"procedure-crowns","name":"Коронки","group_key":"procedure","aliases":["crowns"]},{"slug":"procedure-veneers","name":"Вініри","group_key":"procedure","aliases":["veneers"]},{"slug":"procedure-bridges","name":"Мости","group_key":"procedure","aliases":["bridges"]},{"slug":"procedure-removable-dentures","name":"Знімні протези","group_key":"procedure","aliases":["removable dentures"]},{"slug":"procedure-aligners","name":"Елайнери","group_key":"procedure","aliases":["aligners"]},{"slug":"procedure-braces","name":"Брекети","group_key":"procedure","aliases":["braces"]},{"slug":"procedure-implants","name":"Імплантати","group_key":"procedure","aliases":["Імплант","Імпланти","implants"]},{"slug":"procedure-whitening","name":"Відбілювання","group_key":"procedure","aliases":["whitening"]},{"slug":"procedure-professional-hygiene","name":"Профгігієна","group_key":"procedure","aliases":["professional hygiene"]},{"slug":"procedure-restorations","name":"Реставрації","group_key":"procedure","aliases":["restorations"]},{"slug":"procedure-root-canals","name":"Лікування каналів","group_key":"procedure","aliases":["root canals"]},{"slug":"procedure-surgical-guides","name":"Хірургічні шаблони","group_key":"procedure","aliases":["surgical guides"]},{"slug":"procedure-toothbrushes","name":"Зубні щітки","group_key":"procedure","aliases":["toothbrushes"]},{"slug":"procedure-irrigators","name":"Іригатори","group_key":"procedure","aliases":["irrigators"]},{"slug":"procedure-mouthwash","name":"Ополіскувачі","group_key":"procedure","aliases":["mouthwash"]},{"slug":"technology-cadcam","name":"CAD/CAM","group_key":"technology","aliases":["cadcam"]},{"slug":"technology-3d-printing","name":"3D-друк","group_key":"technology","aliases":["3d printing"]},{"slug":"technology-cerec","name":"CEREC","group_key":"technology","aliases":["cerec"]},{"slug":"technology-exocad","name":"Exocad","group_key":"technology","aliases":["exocad"]},{"slug":"technology-smile-design","name":"Smile Design","group_key":"technology","aliases":["smile design"]},{"slug":"technology-smile-cloud","name":"Smile Cloud","group_key":"technology","aliases":["smile cloud"]},{"slug":"technology-cbct","name":"КЛКТ","group_key":"technology","aliases":["cbct"]},{"slug":"technology-intraoral-scanning","name":"Інтраоральне сканування","group_key":"technology","aliases":["intraoral scanning"]},{"slug":"technology-milling","name":"Фрезерування","group_key":"technology","aliases":["milling"]},{"slug":"technology-digital-planning","name":"Цифрове планування","group_key":"technology","aliases":["digital planning"]},{"slug":"technology-3d-modeling","name":"3D-моделювання","group_key":"technology","aliases":["3d modeling"]},{"slug":"technology-guided-surgery","name":"Навігаційна хірургія","group_key":"technology","aliases":["guided surgery"]},{"slug":"material-zirconia","name":"Цирконій","group_key":"material","aliases":["zirconia"]},{"slug":"material-lithium-disilicate","name":"Літійдисилікат","group_key":"material","aliases":["lithium disilicate"]},{"slug":"material-composite","name":"Композит","group_key":"material","aliases":["composite"]},{"slug":"material-titanium","name":"Титан","group_key":"material","aliases":["titanium"]},{"slug":"material-photopolymer","name":"Фотополімер","group_key":"material","aliases":["photopolymer"]},{"slug":"material-ceramics","name":"Кераміка","group_key":"material","aliases":["ceramics"]},{"slug":"material-pmma","name":"PMMA","group_key":"material","aliases":["pmma"]},{"slug":"material-glass-ceramics","name":"Склокераміка","group_key":"material","aliases":["glass ceramics"]},{"slug":"stage-diagnosis","name":"Діагностика","group_key":"stage","aliases":["diagnosis"]},{"slug":"stage-planning","name":"Планування","group_key":"stage","aliases":["planning"]},{"slug":"stage-modeling","name":"Моделювання","group_key":"stage","aliases":["modeling"]},{"slug":"stage-manufacture","name":"Виготовлення","group_key":"stage","aliases":["manufacture"]},{"slug":"stage-scanning","name":"Сканування","group_key":"stage","aliases":["scanning"]},{"slug":"stage-printing","name":"Друк","group_key":"stage","aliases":["printing"]},{"slug":"stage-milling","name":"Фрезерування","group_key":"stage","aliases":["milling"]},{"slug":"stage-placement","name":"Встановлення","group_key":"stage","aliases":["placement"]},{"slug":"stage-polishing","name":"Полірування","group_key":"stage","aliases":["polishing"]},{"slug":"stage-sterilization","name":"Стерилізація","group_key":"stage","aliases":["sterilization"]},{"slug":"stage-result-control","name":"Контроль результату","group_key":"stage","aliases":["result control"]},{"slug":"feature-before-after","name":"До/після","group_key":"feature","aliases":["before after"]},{"slug":"feature-macro","name":"Макрозйомка","group_key":"feature","aliases":["macro"]},{"slug":"feature-blood-free","name":"Без крові","group_key":"feature","aliases":["blood free"]},{"slug":"feature-animation","name":"3D-анімація","group_key":"feature","aliases":["animation"]},{"slug":"feature-wow","name":"WOW","group_key":"feature","aliases":["wow"]},{"slug":"feature-real-process","name":"Реальний процес","group_key":"feature","aliases":["real process"]},{"slug":"feature-close-up","name":"Крупний план","group_key":"feature","aliases":["close up"]},{"slug":"feature-full-cycle","name":"Повний цикл","group_key":"feature","aliases":["full cycle"]},{"slug":"feature-aesthetic-result","name":"Естетичний результат","group_key":"feature","aliases":["aesthetic result"]}]'::jsonb) x on conflict(slug) do nothing;
-- END GENERATED DICTIONARY SEED
commit;
