# Музичні профілі TV — 17.10.2026

Змінені файли: `src/components/AdminShell.tsx`, `src/components/MusicProfilesPanel.tsx`, `src/integrations/supabase/types.ts`, `src/lib/music-profile-api.ts`, `src/lib/music-profiles.ts`, `src/routes/_authenticated/admin.tsx`, `src/routes/tv.tsx`, `src/test/music-profiles-admin.test.tsx`, `src/test/music-profiles.test.ts`, `src/test/tv-music-profiles.test.tsx`, `src/test/tv-page.test.tsx`, `supabase/migrations/20261017191735_music_profiles.sql`, `supabase/tests/music_profiles.sql` і цей звіт. `src/lib/tv-playback.ts` не змінювався.

## Структура та безпека

Міграція `supabase/migrations/20261017191735_music_profiles.sql` додає одну таблицю `music_profiles`: UUID id, name, description, is_active, is_default, sort_order, nullable volume_override (0–1), track_urls text[]. Масив зберігає порядок до 500 унікальних HTTPS-посилань на **наявну** бібліотеку playback_settings.music_urls; медіафайли і музична бібліотека не дублюються. До 1000 профілів, максимум один активний default (partial unique index). Збереження профілю і зміна default атомарні, reorder перевіряє повний набір UUID. RPC працюють SECURITY INVOKER з has_role(admin), без обходу RLS.

TV/anon читає тільки активні профілі; authenticated admin має CRUD, звичайний користувач — лише active SELECT. screens отримав nullable FK `last_selected_music_profile_id` та `default_music_profile_id` з ON DELETE SET NULL. Існуючі screens RLS/GRANT не розширені. Default/profile state не записується анонімним TV у screens: безпечного device pairing у поточному продукті немає. Поля зарезервовані для майбутньої прив'язки; per-screen default із БД на цьому етапі не використовується.

Фактичне запам'ятовування конкретного TV — localStorage ключ `smilestream.music-profile.v1` у браузері цього телевізора, без fingerprinting/публічного screen ID. На іншому браузері/після очищення даних вибір потрібно зробити знову. Це не серверне запам'ятовування и не прив'язка screen registry до фізичного TV.

## Користування

1. У «Музика та звук» додайте дозволені композиції та збережіть загальну бібліотеку. Наявні треки/гучності не змінюються при створенні профілів.
2. Відкрийте «Музичні профілі» → «Створити профіль», введіть назву/опис, активність, default і за потреби власну гучність у відсотках (порожньо — загальна).
3. Виберіть композиції з бібліотеки, змініть порядок кнопками ↑/↓, збережіть. Кнопки у списку керують активністю, default, порядком і видаленням з підтвердженням. «Слухати» програє впорядковані треки тільки на пристрої адміністратора.
4. На `/tv` натисніть «Дивитися», оберіть профіль стрілками і OK. «Без музики» — вбудований постійний вибір, а не дубльований DB-профіль; він вимикає лише фон, не оригінальний звук відео/реклами.
5. Для повторного вибору натисніть стрілку, потім «Музичний профіль». Відео продовжує працювати, TvPlayback не пересоздається. Settings/profile poll використовує існуючий startPolling (10 с, online/visibility recovery, timeout/cleanup, без нових Realtime subscriptions).

Вибір зберігається на TV і позначається галочкою при наступному відкритті. Видалений/неактивний профіль замінюється активним default, потім першим активним, потім «Без музики». Порожній профіль грає без фону. Для старої інсталяції без створених профілів і з наявною музикою доступна «Музична бібліотека»: backward-compatible віртуальний вибір. Видалені із загальної бібліотеки композиції відфільтровуються при відтворенні; перед повторним збереженням такого профілю приберіть застарілі посилання у редакторі.

Обидва стабільні video-елементи, ad scheduling, оригінальний звук і ducking залишились у незміненому TvPlayback. Profile selection передає похідні AudioSettings: змінюються тільки musicUrls та необов'язково musicVolume; videoVolume, originalIds і duckVolume зберігаються. Неодноразовий poll незмінених треків не перезавантажує music source.

## Виконані перевірки

- TypeScript, ESLint змінених модулів, production chrome85/cloudflare-module build, 118 Vitest / 18 files, 16 Node isolation/planner tests і перевірки media/integration artifact isolation — PASS. Bun відсутній, lock/dependencies не змінювались.
- Нові тести: default/one/multiple/empty, no-music, removed/inactive fallback, local persistence, invalid values, track order; Watch/picker/focus/keyCode arrows, зміна профілю без повторного start, snapshot race; admin disable/default/save/delete confirmation. Існуючі recovery/ad/music/ducking/sync suites продовжують проходити.
- `supabase/tests/music_profiles.sql` виконано тільки на схваленому TEST `dhvfrnlxskqjnefndztu`, з rollback. Admin CRUD/default/order validation, anon read active only/no writes/no RPC, звичайний user no writes, недоступність screen writes, FK cleanup, limits/track membership пройшли. Після тесту profiles=0, fixture users=0. Baseline has_role/assign_first_admin SECURITY DEFINER і leaked-password warnings лишились старими; нових profile advisor warnings немає.
- Production міграція застосована через офіційний Lovable query_database після preflight. Нових профілів/треків не створювали. Після: 25 videos, video fingerprint `0c86070fabfc402f469cb87bb557430b`, roles fingerprint `ebc2a56396b803d6797fce0e2aec2e70`, поточні audio settings без змін. RLS true, anon INSERT/RPC false, дві nullable screen FK колонки присутні. Ручне SQL виконання не записує автоматично Drizzle/Supabase migration journal: перед майбутнім db push зіставити фактичну схему, не повторювати цей CREATE TABLE.

## Межі перевірки

Пульт моделювався у DOM-тестах (стрілки/фокус; OK — стандартний click на сфокусованій кнопці). НОВИЙ picker на фізичному Samsung ще не перевірений; попереднє hardware acceptance стосується старого потоку. Не стверджуємо реальний hardware тест нового picker. Для приймання: відкрити `/tv`, Дивитися → кілька профілів → OK; повернути панель стрілкою → змінити профіль; reload → попередній вибір відмічений; перевірити «Без музики», empty, відключення/видалення вибраного профілю, Wi-Fi reconnect, рекламу зі звуком/ducking. Усі зміни контенту робити усвідомлено в адмінці, не створювати fixture треки у production заради smoke.

Адреси після розгортання: https://smilestream.lovable.app/admin?section=profiles і https://smilestream.lovable.app/tv . Фактичний статус code publish перевіряється окремо; саме застосування SQL не оновлює frontend.

## Фактична публікація

PR #2 (основна функціональність, d55d4a5) і PR #3 (порожні стани, 4fb6851) об'єднані звичайними merge-коммітами без переписування історії. Main release SHA `6090eda3ab9c08f5fbe612cdd71ec54e9af557ef` підтверджений Lovable API. Штатний Publish changes завершився повідомленням «Your website was updated».

Browser smoke на робочому сайті: авторизована вкладка «Музичні профілі» читає таблицю без error/warn console logs; порожній audio preview не показується. На TV: «Дивитися» відкриває picker; ArrowDown/Enter перемістили фокус та запустили «Без музики»; VIDEO currentTime зростав, другий VIDEO мав readyState=4, AUDIO не мав src і був paused. Після reload picker показав «Без музики ✓», а стартовий екран — 25 роликів. Скриншоти приватно у release-proof.local. Production лишився без створених profile/track fixtures. Реальне прослуховування музичних профілів у production та новий Samsung hardware picker acceptance ще потрібні після наповнення бібліотеки.
