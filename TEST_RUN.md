# Smile Stream — безопасный тестовый запуск (задание №4)

## Что проверено здесь

- Статически сопоставлены исходная схема `drizzle/migrations/0000_migration.sql` и подготовленная миграция `supabase/migrations/20261016174139_centralized_playback_settings.sql`. Сигнатура `has_role(uuid, app_role)` совпадает. Публичный SELECT позволяет anon/authenticated читать singleton; UPDATE выдан authenticated только на пять колонок настроек и ограничен USING/WITH CHECK по существующей admin-роли. INSERT/DELETE/id UPDATE клиентам не выданы. Проверка администратора не использует user_metadata. Существующие роли, auth-триггеры и политики не менялись.
- Настоящий SQL-прогон НЕ выполнен: Docker/Bun в PATH и стандартных каталогах не найдены, отдельный локальный Supabase не запущен, staging URL/доступ не предоставлены. К рабочей базе в этом задании подключений не было.
- Vitest проверяет публичный маршрут /tv вне auth-guard, запуск video.play и продолжение polling при ошибке отсутствующей playback_settings. Supabase и media в этих тестах замоканы.
- Локальные dev и Node production-preview проверены через HTTP: /tv возвращает 200 без Location/auth-редиректа. В dev-модуле подтверждены пустые URL/ключ backend. Production-preview использует собранные assets, без Vite HMR. Во встроенном браузере проверен экран с явно отключённым backend.
- В сборке найдены вызов Object.hasOwn в зависимости и Tailwind v4 cascade layers/oklch. Одного build.target=chrome85 недостаточно: добавлен fallback Object.hasOwn перед созданием router и обычные CSS-стили критического TV UI вне cascade layers. Проверено присутствие fallback и позиционирования в production assets. Стрелки пульта теперь явно перемещают фокус, в том числе после скрытия панели. Настоящий Chromium 85 и ТВ-декодеры здесь не запускались.
- Обычный `vite preview` в текущем сочетании TanStack/Nitro ищет отсутствующий dist/server/server.js. Тестовый launcher обходит этот конфликт: только для --preview задаёт локальному процессу NITRO_PRESET=node-server, выполняет build --mode local-test и запускает .output/server/index.mjs. Production/Lovable preset проекта не меняется.
- Зависимости остаются из предыдущей установки pnpm, не из frozen bun.lock. Bun недоступен; проверки с bun.lock необходимо повторить в CI/среде с Bun. Новые npm-зависимости не добавлены.

## Локальный запуск без базы: можно выполнить сейчас

Из корня репозитория, если Node есть в PATH:

```powershell
node scripts/start-local-test.mjs
# Собранная версия для проверки телевизором (без dev HMR):
node scripts/start-local-test.mjs --preview
```

В данной среде Node доступен по полному пути:

```powershell
$smileNode = 'C:\Users\ТОЙ БОЙ\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $smileNode scripts/start-local-test.mjs --preview
```

Открыть **http://127.0.0.1:4173/tv**. Остановить текущий экземпляр перед повторным запуском: порт фиксирован, автоматического переключения на другой порт нет. Остановка — Ctrl+C в терминале launcher.

Launcher НЕ использует существующие VITE_SUPABASE_* / SUPABASE_* из рабочего .env: явно переопределяет их пустыми либо значениями только из SMILE_TEST_*. По умолчанию backend отключён. Появится сообщение «Сервер не налаштовано», без реальных видео и музыки. Это безопасный smoke-test страницы и сборки, НЕ проверка воспроизведения реальных файлов. Старый .env не редактировать. Не запускать обычный npm run dev/build/preview для изолированного теста: они могут подхватить рабочее окружение.

## Подключение только отдельного тестового Supabase

```powershell
$env:SMILE_TEST_SUPABASE_URL = 'https://<TEST_PROJECT_REF>.supabase.co'
$env:SMILE_TEST_SUPABASE_PUBLISHABLE_KEY = '<PUBLIC_PUBLISHABLE_OR_ANON_KEY_OF_TEST_PROJECT>'
node scripts/start-local-test.mjs --preview --staging
```

Подставить значения именно отдельного тестового проекта. Для localhost API допустим http://127.0.0.1:<LOCAL_API_PORT> без --staging. Нельзя использовать service_role/secret key в браузере: launcher отклоняет такие ключи. Известный production project reference запрещён даже с --staging. Пользователь всё равно должен проверить адрес, особенно при custom domain/SSH forwarding: имя хоста само по себе не доказывает изоляцию. Никакие URL/ключи не записывать в Git.

Для музыки/видео нужны разрешённые вами тестовые файлы в тестовом videos и настройках. Автоматического добавления демонстрационных роликов нет. Создайте тестовую admin-учётную запись по существующим правилам этого отдельного проекта. При отсутствии playback_settings видео должно работать, настройки — показывать ошибку и повторять запросы. До применения миграции к ТЕСТОВОЙ базе это ожидаемое поведение.

## Автоматизированные SQL-интеграционные тесты

Файл: `supabase/tests/playback_settings.sql`. Запуск: `scripts/test-sql.mjs` (обычные PostgreSQL assertions, не pgTAP; не запускать через supabase test db).

Проверяются реальные SET LOCAL ROLE anon/authenticated, auth.uid(), lookup admin-роли в user_roles, SELECT, UPDATE RETURNING id, ноль изменённых строк у обычного пользователя (даже с поддельным admin в user_metadata), запрет INSERT/DELETE/id UPDATE, исходный доступ к активным/неактивным видео, singleton/unique, объёмы 0..1, NaN/Infinity/NULL, UUID, NULL-элементы и лимиты массивов 500/10000. Граница допустимых значений тоже проверяется. Права испытываются как anon/authenticated, а не как владелец БД. Фикстуры auth.users/user_roles/videos и изменения настроек находятся в одной транзакции, которая завершается ROLLBACK. Ошибка любой проверки даёт ненулевой exit code и откат.

SQL-ограничения защищают UUID/диапазоны/количество/NULL; полная синтаксическая проверка HTTPS URL остаётся в приложении. DB-admin, пишущий напрямую SQL, может обойти прикладную URL-валидацию. Новых security definer функций тесты/миграция не создают; исходная public.has_role остаётся без изменений.

### Пустой локальный Supabase (Docker + CLI нужны от пользователя)

1. Создайте отдельную пустую папку для тестового Supabase, выполните там `supabase init`, `supabase start`, `supabase status`. Не запускайте reset/push исходного проекта на рабочей базе. Возьмите локальный Postgres URL из status. Запуск CLI/Docker здесь не выполнялся.
2. В терминале Smile задайте только явные тестовые переменные:

```powershell
$env:SMILE_SQL_TEST_CONFIRM = 'isolated-test'
$env:SMILE_TEST_DATABASE_URL = '<LOCAL_POSTGRES_CONNECTION_URL_FROM_TEST_SUPABASE_STATUS>'
node scripts/test-sql.mjs --prepare-empty-local
```

Runner разрешает автоматическую подготовку только для localhost/127.0.0.1/::1 и пустых таблиц приложения. Он применяет точный DDL исходной Drizzle-схемы до блока seed, затем подготовленную playback_settings-миграцию. Исходные sample videos/screens НЕ вставляются. Эти изменения схемы остаются только в disposable-локальной базе; тестовые данные откатываются. Повторные проверки: `node scripts/test-sql.mjs` без --prepare-empty-local.

### Отдельный staging с уже установленной исходной схемой

1. Пользователь подтверждает, что это отдельный тестовый проект, сверяет исходную схему/функции/права, затем применяет к нему ТОЛЬКО подготовленную playback_settings-миграцию. Этот шаг здесь не выполнялся. Не проигрывать исходный Drizzle seed на существующей базе.
2. Подключение должно быть от владельца тестовой БД с правом SET ROLE. Настройки соединения/пароль брать в тестовом Supabase; не передавать production connection string.

```powershell
$env:SMILE_SQL_TEST_CONFIRM = 'isolated-test'
$env:SMILE_TEST_DATABASE_URL = '<EXPLICIT_STAGING_POSTGRES_CONNECTION_URL>'
node scripts/test-sql.mjs --staging
```

Удалённая автоподготовка схемы запрещена, --prepare-empty-local вместе с удалённым адресом завершится ошибкой. Неизвестные/неподтверждённые endpoints и известный production reference отклоняются до соединения. Test runner не читает DATABASE_URL, .env или Supabase MCP project settings. Проверьте настройки Data API отдельно: SELECT/UPDATE grants не заменяют публикацию схемы в Data API.

## Ручной сценарий Samsung Smart TV 2022 с пультом

Документация: [Samsung Web Engine](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html) указывает Tizen 6.5 / Chromium 85 для 2022; [форматы видео](https://developer.samsung.com/smarttv/develop/specifications/media-specifications/2022-tv-video-specifications.html) зависят от модели. Используйте production-preview, не dev HMR.

Подготовка пользователем:
- Подтвердить отдельный staging, выполнить SQL-тесты, подготовить минимум 3 разрешённых H.264/AAC MP4 1080p и HTTPS MP3/AAC. Один ролик с речью, остальные без оригинального звука. Отдельно иметь один плохой URL/неподдерживаемый файл. Никаких изменений рабочего плейлиста.
- Компьютер и ТВ — в одной частной сети Wi-Fi/LAN. Остановить локальный экземпляр; запустить `node scripts/start-local-test.mjs --preview --staging --lan` с тестовыми переменными. Разрешить входящий порт 4173 только для частной сети в Windows Firewall, если потребуется. Не отключать firewall и не настраивать проброс порта в интернет. Никакие настройки firewall автоматически не менялись.
- Открыть на ТВ `http://<LAN_IP_КОМПЬЮТЕРА>:4173/tv`; LAN IPv4 посмотреть в ipconfig. 127.0.0.1 на ТВ указывает на сам телевизор. Сам backend тоже должен быть доступен ТВ: для простоты используйте отдельный HTTPS staging, а не API localhost компьютера.

| Шаг | Действие пультом / в тестовой админ-панели | Ожидаемый результат |
| --- | --- | --- |
| 1 | Открыть /tv в браузере ТВ без входа | Нет перехода на /auth. Крупные читаемые кнопки, видимый контур фокуса. |
| 2 | Стрелки вправо/влево, вверх/вниз; OK на «Запустити зі звуком» | Фокус последовательно перемещается между кнопками; один OK запускает. Если autoplay запрещён — видна кнопка повтора, OK возобновляет. |
| 3 | Дождаться 8 секунд скрытия панели; нажать стрелку | Панель появляется, первая кнопка получает фокус; дальнейшие стрелки перемещают его без мыши. |
| 4 | Выбрать «Повний екран», нажать OK, затем штатный Back | Вход/выход fullscreen проверен на модели; Back остаётся штатным действием браузера. При выходе из страницы повторно открыть /tv. |
| 5 | Дождаться 3 переходов и конца полного списка | Порядок соответствует sort_order, после последнего — первый. Музыка не перезапускается. Записать фактическую длительность чёрного кадра; gapless не гарантируется аппаратно. |
| 6 | В тестовой админке менять music/video volume и original IDs | Обычно через 10 секунд + сеть изменения слышны на ТВ без reload. Речь приглушает музыку, видео без оригинального звука возвращает музыку. Проверить videoVolume=0 и duckVolume=0/1. |
| 7 | Пока ролик идёт, изменить тестовую очередь/отключить текущий ролик | Текущий источник и позиция сохраняются до завершения; следующий взят из свежей очереди. Проверить обновление прямо во время перехода. |
| 8 | Оставить один ролик, затем два плохих файла подряд, затем все плохие | Один ролик циклически идёт через два video. Плохие пропускаются после конечных попыток. Все плохие дают постоянное сообщение и паузу 30 секунд; музыка продолжает играть; OK/стрелки не создают быстрый цикл. |
| 9 | В staging без playback_settings открыть /tv | Видео работает, видна ошибка синхронизации звука; после установки миграции в этом тестовом staging настройки подхватываются автоматически. Не удалять рабочую таблицу ради теста. |
| 10 | Отключить Wi-Fi ТВ на 30–60 секунд, затем восстановить; повторить с уходом в Home/возвратом | Автоматическое восстановление без reload, конечные интервалы повторов, последний список не заменяется демо. Записать время восстановления и ошибки. |
| 11 | Оставить на 8+ часов | Нет остановок/нарастающих пауз/потери управления. Отдельно проверить энергосбережение ТВ; приложение не отключает его автоматически. |

Для каждого шага записать модель/прошивку ТВ, дату, адрес тестовой версии, фактический результат, PASS/FAIL и длительность пауз. Внешний вид админ-панели Tailwind v4 на ТВ остаётся отдельной проверкой; критический fallback добавлен только для экрана плеера.

## Проверки перед merge

При доступном Bun: `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun run build`, `bun run test`, `bun run test:local-safety`. Здесь Bun не устанавливался и эти команды не выполнялись. Проверки текущей установки: TypeScript, Vitest и Node safety tests; production build выполнен launcher с пустым backend и локальным Node preset. Ни merge, ни production deploy, ни SQL на рабочей базе, ни изменение Lovable settings не выполнены.

## Итог выполненных проверок этого задания

| Проверка | Результат |
| --- | --- |
| TypeScript tsc --noEmit | PASS |
| Production build --mode local-test, локальный Node preset | PASS, прежние предупреждения размера bundle/tsconfig-paths |
| Vitest | PASS: 55 тестов, 8 файлов |
| Node local-safety tests | PASS: 6 тестов, включая отказ SQL runner до подключения |
| ESLint изменённых TS/TSX модулей | PASS |
| HTTP /tv (dev и production-preview) | 200, без auth-редиректа |
| Изолированная Vite-конфигурация | URL/ключ backend пустые; подтверждено через локальный dev-модуль |
| Production client assets | Fallback Object.hasOwn и обычное TV-позиционирование присутствуют |
| Визуальная проверка локального /tv | PASS для экрана без backend, без входа |
| SQL assertions на Supabase | НЕ ЗАПУСКАЛИСЬ: нет отдельной БД |
| Bun frozen-lockfile checks | НЕ ЗАПУСКАЛИСЬ: Bun не найден |
| Физический Tizen 2022 / реальные видео и музыка | Требуется пользовательский тест |
