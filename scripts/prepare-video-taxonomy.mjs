// Reproducible dictionary seeds only. Offline: never connects to a database.
import fs from "node:fs/promises";
const categories = [
 ["diagnostics", "Діагностика та планування", "КЛКТ, рентгенографія, діагностичне сканування, аналіз та планування лікування."],
 ["hygiene", "Профілактика та гігієна", "Професійна гігієна, щітки, пасти, іригатори, ополіскувачі, домашній догляд та профілактика."],
 ["restorative", "Терапевтична стоматологія", "Карієс, композитні реставрації, адгезивні технології та пряме відновлення зубів."],
 ["endodontics", "Ендодонтія", "Кореневі канали, ендодонтичні інструменти, обтурація та робота під мікроскопом."],
 ["periodontics", "Пародонтологія", "Пародонт, ясна, м’які тканини та підтримувальна терапія."],
 ["surgery", "Хірургія та імплантологія", "Видалення зубів, імплантація, кісткова пластика, синус-ліфтинг та хірургічні процедури."],
 ["prosthodontics", "Ортопедична стоматологія", "Коронки, вініри, мости, знімні та незнімні протези, ортопедична реабілітація."],
 ["orthodontics", "Ортодонтія", "Брекети, елайнери, апарати, розширення щелеп та цифрове планування переміщень."],
 ["aesthetic", "Естетична стоматологія", "Відбілювання, естетичні реставрації, дизайн посмішки та естетичні перетворення."],
 ["digital", "Цифрова стоматологія та CAD/CAM", "Інтраоральне сканування, CEREC, Exocad, Smile Design, CAD/CAM, 3D-друк та фрезерування."],
 ["laboratory", "Зуботехнічна лабораторія", "Виготовлення коронок і протезів, кераміка, цирконій, полірування та постобробка."],
 ["equipment", "Обладнання, матеріали та інфекційний контроль", "Установки, мікроскопи, інструменти, стерилізація, дезінфекція та стоматологічні матеріали."],
].map(([slug,name,description],i)=>({slug,name,description,sort_order:i+1}));
const formats=[['clinical-process','Реальний клінічний процес'],['clinical-case','Клінічний кейс'],['animation','3D-анімація'],['technology-process','Технологічний процес'],['equipment-demo','Демонстрація обладнання'],['wow','WOW-візуалізація'],['education','Освітнє відео']].map(([slug,name],i)=>({slug,name,sort_order:i+1}));
const groups={
 direction:[['implantology','Імплантологія','Імплантація'],['prosthodontics','Протезування'],['orthodontics','Ортодонтія'],['endodontics','Ендодонтія'],['periodontics','Пародонтологія'],['restorative','Терапевтична стоматологія'],['prevention','Профілактика'],['surgery','Хірургія'],['aesthetic','Естетична стоматологія'],['dental-lab','Зуботехніка']],
 procedure:[['crowns','Коронки'],['veneers','Вініри'],['bridges','Мости'],['removable-dentures','Знімні протези'],['aligners','Елайнери'],['braces','Брекети'],['implants','Імплантати','Імплант','Імпланти'],['whitening','Відбілювання'],['professional-hygiene','Профгігієна'],['restorations','Реставрації'],['root-canals','Лікування каналів'],['surgical-guides','Хірургічні шаблони'],['toothbrushes','Зубні щітки'],['irrigators','Іригатори'],['mouthwash','Ополіскувачі']],
 technology:[['cadcam','CAD/CAM'],['3d-printing','3D-друк'],['cerec','CEREC'],['exocad','Exocad'],['smile-design','Smile Design'],['smile-cloud','Smile Cloud'],['cbct','КЛКТ'],['intraoral-scanning','Інтраоральне сканування'],['milling','Фрезерування'],['digital-planning','Цифрове планування'],['3d-modeling','3D-моделювання'],['guided-surgery','Навігаційна хірургія']],
 material:[['zirconia','Цирконій'],['lithium-disilicate','Літійдисилікат'],['composite','Композит'],['titanium','Титан'],['photopolymer','Фотополімер'],['ceramics','Кераміка'],['pmma','PMMA'],['glass-ceramics','Склокераміка']],
 stage:[['diagnosis','Діагностика'],['planning','Планування'],['modeling','Моделювання'],['manufacture','Виготовлення'],['scanning','Сканування'],['printing','Друк'],['milling','Фрезерування'],['placement','Встановлення'],['polishing','Полірування'],['sterilization','Стерилізація'],['result-control','Контроль результату']],
 feature:[['before-after','До/після'],['macro','Макрозйомка'],['blood-free','Без крові'],['animation','3D-анімація'],['wow','WOW'],['real-process','Реальний процес'],['close-up','Крупний план'],['full-cycle','Повний цикл'],['aesthetic-result','Естетичний результат']],
};
const tags=Object.entries(groups).flatMap(([group_key,items])=>items.map(([key,name,...aliases])=>({slug:group_key+'-'+key,name,group_key,aliases:[...aliases,key.replaceAll('-',' ')]})));
const data={categories,formats,tags};await fs.mkdir('content',{recursive:true});await fs.writeFile('content/video-taxonomy-seed.json',JSON.stringify(data,null,2)+'\n');
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
let sql='\n-- BEGIN GENERATED DICTIONARY SEED (insert missing slugs; preserve administrator edits)\n';
for(const [table,rows,columns] of [['video_categories',categories,['slug','name','description','sort_order']],['video_content_formats',formats,['slug','name','sort_order']],['video_tags',tags,['slug','name','group_key','aliases']]]){
 sql+=`insert into public.${table}(${columns.join(',')}) select ${columns.map(c=>c==='sort_order'?`(x->>'${c}')::integer`:c==='aliases'?`array(select jsonb_array_elements_text(x->'aliases'))`:`x->>'${c}'`).join(',')} from jsonb_array_elements(${q(rows)}) x on conflict(slug) do nothing;\n`;
}
sql+='-- END GENERATED DICTIONARY SEED\n';
const path='supabase/migrations/20261018175151_video_taxonomy.sql';let source=await fs.readFile(path,'utf8');source=source.replace(/\n-- BEGIN GENERATED DICTIONARY SEED[\s\S]*?-- END GENERATED DICTIONARY SEED\n/,'\n');source=source.replace(/commit;\s*$/,sql+'commit;\n');await fs.writeFile(path,source);console.log({categories:categories.length,formats:formats.length,tags:tags.length});
