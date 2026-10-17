import { readFile, writeFile } from "node:fs/promises";
import { prepareMusicCatalog, musicImportSql } from "./music-catalog-plan.mjs";

const registry = JSON.parse(
  await readFile(new URL("../content/music-registry.json", import.meta.url), "utf8"),
);
const plan = prepareMusicCatalog(registry);
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const rows = [...plan.tracks].sort(
  (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
);
const credits = `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Автори музики — Smile Stream</title>
<style>body{font:18px/1.6 Arial,sans-serif;background:#10161c;color:#eef2f6;max-width:1000px;margin:auto;padding:32px}a{color:#9ddcfc}a:focus{outline:3px solid #fff;outline-offset:5px}li{margin:20px 0}small{display:block}button{font:inherit;padding:12px}@media print{body{background:white;color:black}a{color:black}.navigation{display:none}}</style></head><body>
<p class="navigation"><a href="/tv">← До телевізійного плеєра</a> · <a href="/">Smile Stream</a></p>
<h1>Автори та ліцензії музики</h1>
<p>Музика звучить як фон відеопотоку Smile Stream. Оригінальні фонограми не змінено; застосовуються лише гучність і приглушення під звук відео. Автори не заявляють підтримки клініки чи Smile Stream.</p>
<p>Music by <a href="https://audionautix.com/">Jason Shaw / Audionautix.com</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International</a>. <a href="https://audionautix.com/faqs.php">Дозвіл автора на фонову музику для бізнесу</a>.</p>
<p>Записи інших авторів нижче поширено за <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0 Universal</a>. Подяка авторам наведена добровільно. Цю сторінку можна роздрукувати як перелік авторів для клініки.</p>
<ol>${rows.map((track) => `<li><strong>${escape(track.title)}</strong> — ${escape(track.artist)}<small><a href="${escape(track.sourceUrl)}">Першоджерело</a> · <a href="${escape(track.licenseUrl)}">${escape(track.license)}</a> · Оригінальний запис, без змін.</small></li>`).join("\n")}</ol>
<p>Оновлено ${registry.checkedAt}. ${rows.length} записів. Перелік стосується цієї перевіреної добірки; додавання іншої музики адміністратором потребує окремої перевірки прав та оновлення атрибуції.</p></body></html>\n`;
await writeFile(new URL("../public/music-credits.html", import.meta.url), credits);
await writeFile(
  new URL("../content/music-profile-plan.json", import.meta.url),
  JSON.stringify(plan.profiles, null, 2) + "\n",
);
// Explicit optional output for a human/operator to inspect. Never connects to a database.
if (process.argv[2]) {
  const guard = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (!process.argv[3]?.endsWith(".sql")) throw new Error("Provide explicit SQL output path");
  await writeFile(process.argv[3], musicImportSql(plan, guard));
}
console.log(
  `${plan.tracks.length} cleared recordings; ${plan.profiles.reduce((n, p) => n + p.track_urls.length, 0)} planned assignments. No database writes.`,
);
