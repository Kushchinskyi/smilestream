# Резервирование Smile Stream перед SQL-миграциями

Обновление: владелец впоследствии явно разрешил выпуск без обязательной полной резервной копии. Этот runbook сохранён как инструкция; текущие выполненные действия см. RELEASE_EXECUTION.md. Старые ожидания разрешений ниже — историческое состояние подготовки.

Проверено по официальной документации 17.10.2026. Текущий этап: **инструкция готова; подтверждения полного backup и тестового restore нет**. Production SQL, merge и Publish не выполнялись. Массовый импорт контента к этому этапу не относится.

## 1. Действия владельца — экспорт Cloud и Auth

1. Открыть существующий проект: https://lovable.dev/projects/97741ecf-233f-4766-a5a8-1900f0aca92d . Убедиться, что это Smile Stream, Git branch main. Не создавать другой Lovable-проект и не менять backend.
2. Выбрать период без редактирования библиотеки/ролей/настроек; попросить других администраторов не вносить изменения до завершения экспорта. ТВ можно оставить работать. Не нажимать Pause Cloud: экспорт требует работающего backend.
3. Открыть **More → Cloud → Overview → Advanced settings**.
4. Найти **Export project data → Export data**.
5. В карточке **Database** нажать **Export**, затем **Start export**.
6. Дождаться письма Lovable с download link; скачать архив. Он также доступен через **More → Cloud → Storage**. Не пересылать ссылку в чат/GitHub: она предоставляет доступ к приватной копии.
7. Сохранить оригинальный архив в приватную зашифрованную папку вне репозитория. Если скачался ZIP, сохранить и ZIP, и извлечённый `.backup`. Записать дату/время экспорта с часовым поясом, имя/размер файла, project ID и ответственного.
8. Посчитать SHA256 и сохранить рядом; сделать вторую защищённую копию. Пример PowerShell после замены пути на реальный:

   ```powershell
   Get-FileHash -LiteralPath 'D:\PrivateBackups\SmileStream\export.backup' -Algorithm SHA256
   ```

9. Если кнопки нет, backend paused, превышен лимит или показано предложение платного изменения — остановиться и сообщить точный текст без секретов. Не менять тариф/лимиты для обхода. Документация указывает один экспорт за 24 часа, DB до 15 GB и файл до 5 GB.

Полный DB export содержит структуру и данные, включая Auth accounts/password hashes. Отдельно экспортировать plaintext пароли не нужно. CSV таблиц или Git bundle не заменяют этот архив. [Официальная инструкция экспорта](https://docs.lovable.dev/features/advanced-settings).

## 2. Отдельно скачать Storage

1. **More → Cloud → Storage**. Записать все bucket names и public/private, структуру папок, количество объектов и общий объём, если отображается. Если buckets пусты — зафиксировать это, не создавать пробных файлов.
2. Открыть каждый bucket и все вложенные папки. Выделить файлы → **Download**; несколько файлов скачиваются ZIP. Проверить, что выбор действительно охватывает все папки/страницы; не предполагать, что один ZIP автоматически включает весь bucket.
3. Сохранить файлы с исходными bucket/path. Записать размеры, content types, timestamps и SHA256 доступных локальных файлов. Проверить распаковку и несколько файлов каждого типа. Сверить число объектов с инвентаризацией. Для большого bucket без полного выбора потребуется отдельный согласованный downloader; сейчас он не запускался.
4. Сохранить копию bucket-конфигурации и Storage RLS-политик. Ссылка на объект не является резервной копией. Private signed URL временный — скачайте файл, не сохраняйте только URL. Не переводить private buckets в public.
5. DB export, который Lovable положил в Storage, сохранить отдельно от пользовательских медиа: не считать его новым роликом и не включать в приложение.

[Storage: Download и ZIP](https://docs.lovable.dev/features/storage). Внешние 25 URL видеороликов сохраняются в таблице videos, но сторонние MP4 не становятся частью Cloud Storage backup. На этом этапе никаких массовых скачиваний/импорта стороннего контента не выполнять.

## 3. Что входит и что сохраняется отдельно

| Данные                                                                       | DB export                                  | Отдельное действие                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| videos: 25 существующих строк, UUID, URL, sort_order, активность             | Да, на время snapshot                      | После restore сверить все значения/порядок, не только count                                                                      |
| screens, user_roles, DB-настройки, если существуют                           | Да                                         | Сверить UUID-связи, admin role и значения                                                                                        |
| Auth users/identities и хеши паролей                                         | Да, managed auth schema в архиве           | Проверить состав архива и реальный вход владельцем после restore                                                                 |
| Таблицы, функции, триггеры, RLS, индексы                                     | Структура входит                           | Проверить archive TOC и восстановленные определения/GRANT; глобальные роли/managed objects не считать автоматически переносимыми |
| MP4/MP3/изображения в Storage                                                | Нет                                        | Скачать реальные файлы, сохранить bucket/path, доступ и RLS                                                                      |
| OAuth/provider settings, redirect allowlist, Site URL, SMTP, email templates | Не полагаться на экспорт                   | Приватно зафиксировать действующую конфигурацию; новые callback в production не менять                                           |
| API keys, JWT/signing config, function secrets, внешние credentials          | Не входят как готовая конфигурация проекта | Сохранить названия/источники восстановления в password manager, не в Git; секреты не присылать в чат                             |
| Edge Function code и внешний server/deployment config                        | Нет                                        | Git backup исходников + приватная конфигурация; сверить фактически развёрнутую версию                                            |
| Scheduled jobs, webhooks, внешние сервисы                                    | Нужна отдельная инвентаризация             | Даже если DB-записи попадут в dump, НЕ включать их в sandbox без проверки адресов/credentials                                    |
| Локальные browser settings                                                   | Нет                                        | Сохранить только нужные поля настройки; не экспортировать все cookies/localStorage с Auth tokens                                 |
| Сторонние ролики по HTTPS URL                                                | Только ссылки                              | Доступность/права на файлы — отдельная задача, здесь библиотеку не менять                                                        |

Для браузеров, где использовался новый локальный audio draft, точный ключ — `smilestream.audio.v1`. Сохранить только его JSON приватно либо штатный audio export после проверки. Не копировать весь localStorage. Не переносить тестовые настройки из `127.0.0.1` в production автоматически. Семь миграций создают новые singleton defaults, а не импортируют browser drafts: музыку/громкость/original IDs нужно отдельно сопоставить перед их первым сохранением.

## 4. Безопасная проверка восстановления

Поддерживаемый путь: **Cloud export → отдельный Supabase-compatible backend → отдельный local test build**. Lovable draft разделяет рабочую базу; кнопка **Restore to this backup** в production откатывает именно production с потерей более поздних изменений. Оба варианта для репетиции исключены. [Общие ограничения Cloud](https://docs.lovable.dev/features/database).

Документация Lovable описывает custom-format `.backup` с zstd (ZIP сначала распаковать), `pg_restore --list`, затем выборочное восстановление с учётом уже существующих managed schemas/ролей/extensions. Полный archive поверх initialized Supabase может конфликтовать. Не применять `--clean`, не вставлять бинарный backup в SQL editor и не прогонять Drizzle seed ради обхода конфликта. [Путь Cloud → Supabase](https://docs.lovable.dev/tips-tricks/external-deployment-hosting).

Порядок репетиции, после получения архива:

1. Локально проверить hash, формат/TOC, версии pg_dump/server и zstd. Сначала выполнить только offline `pg_restore --list`, без connection string. Это ещё не доказывает, что все сжатые data blocks восстанавливаются.
2. Выбрать **пустой одноразовый** target. Существующий `dhvfrnlxskqjnefndztu` уже содержит принятую тестовую схему/данные — полный dump поверх него не восстанавливать. Варианты: локальный Supabase после согласованной установки Docker или новый приватный проект после согласования пользователя, квоты Free и допуска к копии реального Auth. Ничего нового сейчас не создавалось. На текущем компьютере `docker`, `psql`, `pg_restore` не найдены в PATH.
3. Sandbox не связывать с production frontend, доменом или Lovable Git. Не копировать production JWT signing secret, SMTP, OAuth secrets, webhooks и платёжные credentials. Выключить исходящие уведомления, cron/net jobs и integrations **до загрузки данных**. Сначала проверить TOC/DDL на побочные эффекты; при необходимости предварительно подготовить allowlist объектов/data без job tables.
4. Изучить TOC и состояния managed auth/storage target; подготовить reviewed selective restore list и точную команду для ЭТОГО архива. Не обещаем универсальную команду до получения archive/version. Не смешивать full-schema restore и replay всех migrations: это создаёт дубликаты. Если выбран precreated schema + data-only, исключить demo seeds, согласовать auth versions, восстановить необходимые sequences, RLS/functions/permissions отдельно и проверить полноту.
5. Восстановить public records и Auth с сохранением исходных UUID/связей и password hashes; все объекты Storage отдельно загрузить в соответствующие sandbox buckets. Учитывать `assign_first_admin`: не запускать регистрацию первого нового пользователя вместо восстановления исходной роли. Не выполнять приложения/cron с рабочими адресами из dump.
6. Сравнить source snapshot и restored result: 25 video UUID/поля/order/URLs; screens; auth users/identities; соответствие admin user_roles, количество/роль; функции has_role и assign_first_admin, triggers, GRANT/RLS; все настройки; Storage count/bytes/hash/access. Не считать одни counts достаточными.
7. Владелец самостоятельно проверяет вход старым паролем на **отдельном origin** с sandbox keys; приватные пароли не передаются агенту. Новые sessions подписываются sandbox keys; рабочие tokens не копируются. Для email/OAuth требуется отдельная безопасная конфигурация; до её появления тест этих способов входа остаётся непроверенным. [Сохранение Auth/password hashes](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects).
8. На восстановленной копии применить семь новых migrations и выполнить SQL RLS-tests с rollback, сохранить отчёт/ошибки. Tests с fixture users запускать только здесь. В ordinary app подключать target только через изолированный launcher, который должен отдельно разрешать именно выбранный sandbox ref; существующий launcher жёстко закреплён за прежним test project — не обходить guard.
9. Зафиксировать результат restore, длительность, target ref, TOC/selection hashes, counts/diffs и короткий login/storage/read-write test. Затем подтвердить backup readiness. Sandbox с реальными Auth hashes хранить приватно и удалить после согласованного срока.

Если archive содержит Vault/column-encrypted data, сначала отдельно проверить совместимость encryption keys/metadata; password hashes не равны Vault encryption keys. Без этого не заявлять полную переносимость. [Ограничения Supabase restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

**Статус:** способ документально подтверждён, фактический DB restore НЕ выполнен: архива и согласованного чистого target пока нет. Встроенный daily backup (примерно 14 дней) полезен для аварии, но не заменяет внешний архив и репетицию.

## 5. Сверка схемы и порядок миграций

Свежую production сверку выполнить **после подтверждения резервирования**, только SELECT/системные каталоги в read-only transaction, отдельно от разрешения записи. До этого используются лишь файлы и ранее сохранённый snapshot от 17.10.2026, без заявления об актуальном production состоянии.

Что сверить: DB/version/extensions, migration journals Drizzle и Supabase, наличие/DDL четырёх новых tables и одноимённых RPC/index/policies, enum app_role/admin, точную сигнатуру и grants has_role, videos.id/updated_at/sort_order и grants admin UPDATE, first-admin trigger, defaults/constraints/RLS, API schema exposure и grants anon/authenticated/service_role. Не выбирать пароли или tokens. Снять fingerprint всех 25 video rows/order и Auth-ID/user_roles соответствий без раскрытия персональных данных. Ни RPC reorder, ни тестовые INSERT/UPDATE в production не вызывать.

Предварительные конфликты/риски (по локальному SQL и старому snapshot; финальная сверка ожидается):

- `CREATE TABLE`, `CREATE FUNCTION`, policies и index в файлах не рассчитаны на слепое повторение. Одноимённый объект или частично применённая migration → STOP, сравнение definition/history, не DROP/repair наугад.
- Reorder RPC зависит от videos UPDATE grants/RLS, колонки updated_at и функции has_role; SECURITY INVOKER не обходит существующие ограничения. Сохранять auth-реализацию, не заменять user_metadata-проверкой.
- Metadata migration содержит первоначальную reorder function; identity guard заменяет её. Не выпускать приложение между ними.
- Часть файлов содержит BEGIN/COMMIT, часть — нет. При утверждении исполнения нужен единый проверенный runner с stop-on-error и границами транзакций на migration; не оборачивать вложенные BEGIN/COMMIT без разбора. Последние cover/index steps не считать атомарными автоматически.
- Drizzle baseline и семь Supabase-файлов имеют разные журналы. Git merge сам не доказывает применение SQL в Lovable. Определить и записать ровно один путь исполнения/учёта, не запускать автоматический db push/repair и baseline seeds.
- В первом snapshot не было новых settings tables: файл 1 создаст default music empty / 0.35 / video 1 / duck 0.15. Это не сохранение старых browser-local значений; нужен отдельный проверенный перенос существующих настроек, без тестовых значений.
- В текущих SQL URL-checks на уровне DB слабее клиентского URL-validator. RLS доверяет только администратору для записи; это остаточное ограничение, не новая гарантия строгого URL-парсинга PostgreSQL.

Точный порядок **после** разрешения (имена и SHA256 уже зафиксированы в LOVABLE_RELEASE_PLAN.md):

1. `20261016174139_centralized_playback_settings.sql` — playback_settings, singleton, anon SELECT/admin column UPDATE.
2. `20261016211630_admin_media_metadata.sql` — media_metadata, admin CRUD, reorder_videos.
3. `20261017041255_reorder_identity_guard.sql` — обязательная замена reorder_videos с NULL/identity guard.
4. `20261017123203_advertisement_library.sql` — отдельные advertisements и reorder RPC; обычные video rows не изменяются.
5. `20261017131933_ad_playback_settings.sql` — singleton рекламы OFF, active-only read, read_ad_playback RPC.
6. `20261017132134_media_cover_urls.sql` — cover_url defaults/checks.
7. `20261017133052_ad_snapshot_capacity_guard.sql` — snapshot limit 1001 и active-order index.

После каждой операции проверить её objects/grants/RLS/history; при ошибке остановиться. Сопоставить сохранность videos/Auth/roles/settings после всей серии. Тестовые fixture SQL на production не запускать. Финальный отчёт PASS/FAIL по каждому пункту появится после backup confirmation и разрешённой read-only сверки, а не заранее.

## 6. Что сообщить перед разрешением миграций

Без прикрепления архива или секретов в чат:

- «DB export скачан», timestamp/timezone, локальный приватный путь, размер и SHA256.
- «Storage сохранён»: список bucket names, количество файлов/bytes либо подтверждение, что Storage пуст; приватная конфигурация/секреты доступны владельцу в password manager.
- Каким способом и в какое ЧИСТОЕ окружение разрешена репетиция; если нужно новое облачное — отдельное согласие на создание без платного апгрейда. Нельзя считать прежнее разрешение на test fixtures разрешением overwrite существующего test project реальными Auth данными.
- Результат репетиции: восстановленные 25 UUID/order, admin login/role, настройки и Storage; если репетиция ещё не проведена — так и указать.
- Подтверждение, что после backup не менялись admin данные, либо перечень изменений для свежего snapshot перед SQL.

Затем агент выполнит свежую read-only сверку и представит точный diff/конфликты. Только после её успешного отчёта пользователь отдельно разрешает **семь SQL migrations на ieytvixchndxnxsxpcot**. Merge и Publish остаются отдельными последующими разрешениями. Подтверждение скачивания архива не является разрешением SQL-записи.
