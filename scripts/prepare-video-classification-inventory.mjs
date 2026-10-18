// Offline proposal from the inspected 25 source titles. Does not fetch or write production.
import fs from 'node:fs/promises';
const before=JSON.parse(await fs.readFile('classification.local/production-before.json','utf8'));
const seed=JSON.parse(await fs.readFile('content/video-taxonomy-seed.json','utf8'));
const known={
 1:['diagnostics','clinical-process',['stage-diagnosis','feature-real-process']],
 4:['diagnostics','clinical-process',['stage-diagnosis','feature-real-process']],
 10:['prosthodontics','education',['direction-prosthodontics']],
 11:['hygiene','education',['direction-prevention','procedure-toothbrushes']],
 12:['diagnostics','clinical-process',['stage-diagnosis','feature-real-process']],
 14:['surgery','clinical-process',['direction-surgery','feature-real-process']],
 15:['hygiene','clinical-process',['direction-prevention','procedure-professional-hygiene','feature-real-process']],
 16:['hygiene','clinical-process',['direction-prevention','procedure-professional-hygiene','feature-real-process']],
 19:['surgery','animation',['direction-implantology','direction-prosthodontics','procedure-implants','procedure-crowns','feature-animation']],
 20:['endodontics','animation',['direction-endodontics','procedure-root-canals','feature-animation']],
 21:['prosthodontics','animation',['direction-prosthodontics','procedure-bridges','feature-animation']],
 22:['digital','technology-process',['technology-cadcam','technology-cerec','procedure-crowns','stage-scanning','stage-modeling','technology-milling']],
 23:['laboratory','technology-process',['direction-dental-lab','direction-prosthodontics','stage-polishing','feature-macro']],
 24:['laboratory','technology-process',['direction-dental-lab','procedure-restorations','stage-modeling']],
};
const rows=before.videos.map((v,i)=>{const k=known[i+1];return {id:v.id,title:v.title,url:v.url,sort_order:v.sort_order,duration_seconds:v.duration_seconds,category:k?.[0]??(i===24?'prosthodontics':null),format:k?.[1]??null,tags:k?.[2]??(i===24?['direction-prosthodontics','feature-macro']:[]),wow_score:null,case_id:null,review_status:k?'classified':'needs_classification',evidence:k?'Початкова класифікація лише за фактичною назвою: '+v.title:'Потребує класифікації: назва не встановлює точну процедуру або формат. '+v.title};});
for(const r of rows){if(r.category&&!seed.categories.some(c=>c.slug===r.category)||r.format&&!seed.formats.some(f=>f.slug===r.format)||!r.tags.every(slug=>seed.tags.some(t=>t.slug===slug)))throw Error('Unknown dictionary slug');}
await fs.writeFile('content/video-classification-inventory.json',JSON.stringify({basis:'Inspected production titles, not full visual review; no inferred blood, WOW or before/after claims',rows},null,2)+'\n');
const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';
const csv=[['ID','Порядок','Назва','Основна категорія','Формат','Теги','Статус','Підстава'],...rows.map(r=>[r.id,r.sort_order,r.title,seed.categories.find(c=>c.slug===r.category)?.name??'Не визначено',seed.formats.find(f=>f.slug===r.format)?.name??'Не визначено',r.tags.map(slug=>seed.tags.find(t=>t.slug===slug).name).join('; '),r.review_status==='classified'?'Класифіковано за назвою':'Потребує класифікації',r.evidence])].map(r=>r.map(quote).join(',')).join('\r\n');
await fs.writeFile('VIDEO_CLASSIFICATION_INVENTORY.csv','\ufeff'+csv+'\r\n');
const payload="'"+JSON.stringify(rows).replaceAll("'","''")+"'::jsonb";
const sql=`-- Content-only inventory initialization; never changes videos or playback order.\nbegin;\nlock table public.video_classification,public.video_tag_relations in share row exclusive mode;\ndo $inventory$ declare payload jsonb:=${payload};r jsonb;vid uuid;begin
if (select md5(jsonb_agg(to_jsonb(v) order by id)::text) from public.videos v)<>'1ef26b9529ddaa4238fd33f7165826e9' or exists(select 1 from public.video_classification) then raise exception 'Inventory changed: inspect before initialization';end if;
for r in select value from jsonb_array_elements(payload) loop
 vid=(r->>'id')::uuid;
 insert into public.video_classification(video_id,category_id,format_id,review_status,evidence) values(vid,(select id from public.video_categories where slug=r->>'category'),(select id from public.video_content_formats where slug=r->>'format'),r->>'review_status',r->>'evidence');
 insert into public.video_tag_relations(video_id,tag_id) select vid,t.id from public.video_tags t where t.slug in(select jsonb_array_elements_text(r->'tags'));
end loop;
end $inventory$;\ncommit;\n`;
await fs.writeFile('classification.local/initialize-reviewed.sql',sql);console.log({videos:rows.length,classified:rows.filter(r=>r.review_status==='classified').length,needsReview:rows.filter(r=>r.review_status!=='classified').length});
