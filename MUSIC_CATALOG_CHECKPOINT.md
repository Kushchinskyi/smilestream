> СУПЕРСЕДИРОВАНО 18.10.2026: прежняя загрузка завершена (59/59), URL перенесены в Storage; пользователь отверг музыкальный отбор. Актуальный статус и ограничения: MUSIC_REPLACEMENT_CHECKPOINT.md. Ниже сохранён исторический текст, его незавершённые шаги не повторять.

# CHECKPOINT — музыкальная библиотека, 17.10.2026

## Фактическое состояние
- Ветка feature/music-catalog, HEAD af48d70. Этот код уже вошёл в main через PR #4, merge e45e17aff105b7aa50680553e4971f103c6b46ce и опубликован.
- Production: исходный Lovable 97741ecf-233f-4766-a5a8-1900f0aca92d, Supabase ieytvixchndxnxsxpcot, https://smilestream.lovable.app.
- Уже создано 7 профилей, 59 music_urls, 59 media_metadata. НЕ ПОВТОРЯТЬ начальный import.sql: его guard рассчитан на пустую библиотеку и должен отказать.
- Порядок и состав профилей сохранены в content/music-profile-plan.json. Автомикс 50; остальные 21/5/5/3/21/4. После импорта 25 videos, 3 screens, роли, Auth count=1, реклама и audio volume/duck/originalIds сверены и не менялись.
- Внешние Audionautix URL нестабильны для браузера: наблюдались 403 и пропуски после окончания CodeBlue. HTTP/ffprobe без Referer не является доказательством стабильного browser playback. Не считать 59 файлов полностью проверенными в браузере/на Samsung.

## Разрешения и Storage
- Пользователь отдельно разрешил public bucket smilestream-music только для этой музыки, без платного тарифа/пополнения.
- Bucket создан через официальный Lovable UI 17.10.2026, public=true.
- Workspace Block public storage buckets сначала временно выключен, после создания bucket снова ВКЛЮЧЕН (aria-checked=true). Остальные настройки не менялись.
- storage.objects: RLS policies=[], т.е. публичной записи нет. Загрузка — через привилегированный официальный Cloud UI. Чтение public bucket без авторизации.
- В момент checkpoint отправлена первая загрузка 59 файлов (359968294 байта /343 МиБ) через file chooser. UI показал Uploading 59 files. Последняя проверка storage.objects count=0: ЗАВЕРШЕНИЕ ЕЩЁ НЕ ПОДТВЕРЖДЕНО. Не загружать повторно без сверки objects/имён/размеров.
- Имена: SHA256 исходного URL первые16hex.mp3. Локальные originals: music-research.local/audio/. upload-manifest.json — абсолютные пути59 уже проверенных SHA256. audio не в Git.

## Что делать дальше
1. Дождаться/проверить UI Upload, storage.objects count/metadata size. Не считать filechooser.setFiles завершением загрузки.
2. Получить фактический public URL через UI Copy URL; проверить все59 bytes/hash/MP3/HTTP Range с сайта, затем реальное browser playback.
3. Составить guarded URL relocation: old->new, только59 собственных добавлений; сохранить ID/name/default/порядок/track order профилей, volume и все чужие/новые изменения. Изначальный import SQL НЕ подходит.
4. Проверить native переход минимум2 треков, все7 профилей/Без музики и непрерывное видео; отдельно подтвердить пределы Samsung (физического устройства у агента нет).
5. Продолжить первичный поиск: Holizna CC0 OpenGameArt lo-fi collections (zip), другие оригинальные CC0/документированные разрешения. Не импортировать OpenLo-Fi Suno или прежние32 Kevin MacLeod из legal_review без дополнительного допуска. Не выдавать слуховой QC за ffmpeg-проверку.
6. Обновить реестр/receipt/отчёт фактическими hosted URLs и тестами; сохранить отдельным commit без переписывания истории. Не перезаписывать незавершённые файлы.

## Локальные незавершённые файлы
- content/music-registry.json: imported flags, production receipt metadata, durationSeconds, историческое доказательство Jason Shaw. Эти изменения пока не закоммичены.
- MUSIC_CATALOG.md: ЧЕРНОВОЙ отчёт предыдущего этапа. Его формулировки о работающих URL означают только HTTP/codec, НЕ browser stability. Требуется исправить после rehosting.
- content/music-import-verification.json: anon REST сверка фактических rows и59 HTTP Range. Не содержит подтверждения загрузки в Storage.

## Инструменты
- Git/Node доступны; Bun отсутствует. Проверки: node node_modules/typescript/bin/tsc --noEmit; node node_modules/vitest/vitest.mjs run; node node_modules/vite/bin/vite.js build; node --test scripts/music-catalog-plan.test.mjs scripts/test-target.test.mjs scripts/content-import-plan.test.mjs.
- Lovable query_database иногда ограничен free API quota: не обходить через секреты; anon REST с .env public key допустим для SELECT (скрипт music-research.local/verify-rest.mjs). Не печатать .env/ключи.
- Browser CUA tab4 Lovable Cloud Storage; tab10 workspace privacy/security; tab6 admin; tab5/9 TV. Все UI действия только CUA, не через скрытые fetch/cookies/JWT.
- Browser native audio можно inspect DOM read-only, нажимать через AX; не менять currentTime через evaluate. Предыдущий admin preview был перемотан к130s штатными стрелками native seek slider.
