# Smile Stream — Supabase integration test

Обновление Smile Stream 2.0: новые UI/метаданные/рекламная библиотека и актуальные ограничения описаны в [DEVELOPMENT_REPORT.md](DEVELOPMENT_REPORT.md), порядок миграций — [RELEASE_READINESS.md](RELEASE_READINESS.md). Результаты ниже относятся к исходному интеграционному этапу.

## Изолированное окружение

Создан с разрешения пользователя отдельный проект **smilestream-integration-test**:

- Организация: beeplepro (`klpsvtycqxmfbdfbarjh`), тариф Free.
- Регион: Frankfurt / `eu-central-1`.
- Project ref: `dhvfrnlxskqjnefndztu`.
- Dashboard: https://supabase.com/dashboard/project/dhvfrnlxskqjnefndztu
- Перед созданием Supabase сообщил стоимость нового проекта **$0/month**. Тариф не изменялся; платные функции не включались. Это не гарантия будущей стоимости/квот провайдера.

Рабочий project ref `ieytvixchndxnxsxpcot` не использовался для SQL, чтения данных, миграций или Auth. Ни рабочие данные, ни пользователи, ни Storage не копировались. Новый проект первоначально имел 0 таблиц public.

На новом проекте установлены:

1. `integration_baseline_schema_without_seeds` (история Supabase: `20261016204916`) — точный DDL из `drizzle/migrations/0000_migration.sql` до `insert into public.screens`, без исходных seed-данных.
2. `centralized_playback_settings` (`20261016204919`) — файл `supabase/migrations/20261016174139_centralized_playback_settings.sql` без изменения его SQL.

Архитектура TvPlayback, авторизация, роли и исходные RLS-политики приложения не менялись. Созданы только тестовые данные: три Samplelib H.264/AAC MP4, музыкальный MP3, тестовый admin и обычный пользователь. Обычный пользователь специально имеет `user_metadata.role=admin`, но не имеет строки admin в user_roles: проверки подтверждают отсутствие повышения прав. Учётные записи созданы как тестовые фикстуры через SQL с хешированными паролями, без отправки писем; штатный вход выполняется через Supabase Auth.

## Реально выполненные проверки

| Проверка                                                                    | Результат                                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Полный `supabase/tests/playback_settings.sql` через MCP на новом project_id | PASS; все assertions завершились; транзакционные фикстуры откатились                            |
| anon SELECT настроек / активных видео                                       | PASS                                                                                            |
| anon UPDATE / INSERT / DELETE настроек запрещены                            | PASS                                                                                            |
| Обычный authenticated пользователь читает, UPDATE меняет 0 строк            | PASS                                                                                            |
| Поддельный admin в user_metadata не даёт прав                               | PASS                                                                                            |
| Admin UPDATE пяти разрешённых полей с RETURNING id                          | PASS                                                                                            |
| INSERT / DELETE / изменение singleton id запрещены даже admin               | PASS                                                                                            |
| UUID, NULL, диапазоны 0..1, NaN/Infinity, границы 500/10000 элементов       | PASS через SQL                                                                                  |
| Настоящий HTTP Auth/Data API с anon/user/admin                              | PASS: `scripts/test-integration-api.mjs`                                                        |
| Вход в существующую административную панель                                 | PASS                                                                                            |
| Сохранение музыки, music/video/duck уровней, original IDs через UI          | PASS; значения проверены SQL                                                                    |
| Два одновременно открытых `/tv`                                             | PASS; один на 127.0.0.1, другой на LAN-origin без входа                                         |
| Смена MP3 20s → 15s на обоих /tv                                            | PASS без перезагрузки; на обоих audio.src изменился, воспроизведение продолжилось               |
| Изменение заголовка и выключение/возврат третьего видео через UI            | PASS: на обоих обновились подготовленные источники; после возврата третий снова воспроизводился |
| original IDs: оригинальный звук перенесён с ролика 2 на ролик 1             | PASS: на обоих активный ролик 1 стал muted=false; остальные muted=true                          |
| TypeScript / Vitest                                                         | PASS / 67 тестов                                                                                |
| Node safety tests                                                           | PASS / 10 тестов                                                                                |
| Production build (Node preset, chrome85) / integration build                | PASS / PASS                                                                                     |
| Проверки изоляции media и integration артефактов                            | PASS                                                                                            |
| LAN `/tv`                                                                   | HTTP 200 на 192.168.31.27:4173                                                                  |

Обновления приходят существующим polling примерно раз в 10 секунд. Это не синхронизация кадров между телевизорами. Для проверки нового заголовка при переходе также использовалась штатная кнопка Next; перезагрузки /tv не требовались. Снятие активности не прерывает уже идущий ролик; новый состав применяется для следующих переходов.

UI и SQL подтвердили music=0.45, video=0.60, duck=0.25. Физическое прослушивание уровней/ducking на Samsung необходимо выполнить пользователю. Автоматизация браузера подтверждала доступные DOM-свойства source/currentTime/paused/muted, а не измерение звукового сигнала.

## Запуск на компьютере и Samsung

Текущий preview уже запущен. Откройте/обновите:

- Samsung: **http://192.168.31.27:4173/tv**
- Компьютер: **http://127.0.0.1:4173/tv**
- Администратор: **http://127.0.0.1:4173/admin** (при необходимости перенаправит на `/auth`).

Тестовые email/пароли и публичный ключ находятся только в игнорируемом **`smile-integration.local`**. Поля `adminEmail`/`adminPassword` — для админ-панели; `userEmail`/`userPassword` — для обычного пользователя. Не добавлять этот файл в Git и не использовать пароли вне этого теста. Секретные service-role ключи в браузер не передаются.

Для повторного запуска после остановки предыдущего preview:

```powershell
Set-Location 'C:\Users\ТОЙ БОЙ\Documents\ChatGPT\Smile'; & 'C:\Users\ТОЙ БОЙ\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/start-integration-test.mjs --lan
```

Нужны одна LAN, доступ телевизора к интернету и разрешённый входящий Node на частной сети Windows. Firewall и роутер автоматически не меняются. DHCP может изменить IP компьютера. На Samsung нажмите «Запустити зі звуком». Пока ТВ играет, измените настройки в админ-панели, сохраните и дождитесь обновления примерно за 10 секунд. Смена состава плейлиста действует после завершения текущего ролика. Проверьте перенос оригинального звука, независимую громкость, приглушение и возврат громкости, выключение/возврат одного тестового ролика, отключение/возврат Wi-Fi. Не открывайте production-админку для этих проверок.

Это настоящий маршрут приложения `/tv`, а не отдельный media-test harness. Его существующие элементы управления не изменены. Ранее подтверждённые пользователем Samsung-переходы и автоскрытие отдельного media-test не затрагивались.

## Защита launcher и повторные проверки

`start-integration-test.mjs` принимает только `--lan`, проверяет строго одобренные projectRef/URL, отбрасывает унаследованные VITE/Supabase переменные, задаёт все шесть project ID/URL/public-key переменных новым проектом. CI/Lovable/hosting запуск запрещён. Отдельная конфигурация отключает Vite `.env` и автоматическую публикацию VITE-переменных, явно подставляет только тестовый URL/публичный ключ, собирает в `.integration-test-output`.

Nitro данной версии самостоятельно читает dotenv даже при `vite.envDir=false`: это обнаружено аудитом как неиспользуемый старый project ID в первом артефакте. Тестовые URL/ключ уже тогда были корректны; теперь оба project ID также явно переопределены и envPrefix закрыт. Повторный аудит не обнаружил рабочего project ref или паролей в итоговой интеграционной сборке. Обычная `.output` не содержит тестового ref. Чтение рабочего `.env` не используется как источник настроек тестового backend.

```powershell
node scripts/test-integration-api.mjs --confirm-isolated-project
node scripts/check-integration-isolation.mjs
node --test scripts/test-target.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
```

API-тест не подменяет browser auth/storage, не требует service_role и не меняет итоговые настройки: допустимый UPDATE записывает прежнее значение, остальные записи должны быть отклонены. Для SQL-тестов через MCP сначала независимо подтвердить project_id `dhvfrnlxskqjnefndztu`, выполнить `do $$ begin perform set_config('smile.isolated_sql_test','on',false); end $$;`, затем точный файл тестов; завершающий ROLLBACK обязателен. Через CLI/Postgres runner нужны отдельные реквизиты владельца только тестовой БД, которые здесь не сохранялись.

## Ограничения / замечания

- Security Advisor тестового проекта предупреждает о доступных SECURITY DEFINER функциях исходной схемы `has_role` и `assign_first_admin`: [anon remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Права исходной авторизации не менялись; нужен отдельный review, а не незаметное исправление в рамках этого теста.
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) отключена по умолчанию. Тариф/настройки Auth не менялись.
- Прямые SQL-записи не проверяют полный синтаксис HTTPS URL — это делает приложение; SQL ограничивает типы, размеры и значения. Это существующее поведение миграции.
- Bun недоступен; использованы установленные зависимости, bun.lock не менялся.
- Долговременный тест, реальный сетевой обрыв и физическая Samsung-проверка именно интеграционной версии ещё нужны. Ранее успешный media-test не равен проверке Supabase на телевизоре.
- Merge, deploy, production SQL и настройки Lovable не выполнялись. Изменения launcher/тестов/отчёта подготовлены локально в feature/seamless-tv-audio; push этого этапа не выполнялся.
