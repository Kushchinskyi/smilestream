# Smile Stream 2.0 — план согласованного переноса

Обновление: владелец явно разрешил migrations 5–7, merge и Publish без обязательной backup. Фактическое исполнение фиксируется в RELEASE_EXECUTION.md; прежние gates ниже описывают этап подготовки.

Подготовка от 17.10.2026. Публикация НЕ разрешена этим документом.

Подробная инструкция владельцу по полному DB/Auth export, отдельному Storage backup и репетиции восстановления — [CLOUD_BACKUP_RUNBOOK.md](CLOUD_BACKUP_RUNBOOK.md). Свежая production read-only сверка ожидает подтверждения резервирования. Старый snapshot ниже не является подтверждением текущего состояния базы.

## Что проверено

- Существующий проект Lovable: `97741ecf-233f-4766-a5a8-1900f0aca92d`; репозиторий `Kushchinskyi/smilestream`, Draft PR #1. Пользователь подтвердил активную ветку **main**. API Lovable показывает SHA `4c33592939b65f6032f244489cb5f01da9a8eb47`, совпадающий с main. Ветка feature не подключена к editor.
- Просмотрены 12 коммитов PR от `d41ae9c` до `f99bddc`: переходы/звук, восстановление, изолированные launchers, админка, metadata, реклама, планировщик, тесты и документация. Проверка `git merge-tree --write-tree origin/main HEAD` прошла без конфликтов до этого документационного дополнения. Переписывание истории не требуется.
- Рабочий Lovable использует Cloud/Supabase `ieytvixchndxnxsxpcot`; тестовый проект — **другой** `dhvfrnlxskqjnefndztu`. Read-only аудит через Lovable: 25 активных видео, 3 screens, 1 auth user, 1 user_roles. Public-таблицы: videos, screens, user_roles; RLS включён. `has_role(_user_id uuid, _role app_role)` соответствует миграциям. Новых четырёх таблиц в production пока нет.
- Никаких записей/миграций production, изменений Lovable, merge или deploy в ходе подготовки не выполнено. Клинический Samsung-тест видео/рекламы/музыки/ducking/пульта/синхронизации пользователь подтвердил успешным. Повторный длительный прогон не требуется на этом этапе.
- Обычная сборка использует штатный `cloudflare-module` preset Lovable; локальные test launchers переопределяют preset и backend только в своём процессе. Каталоги `content/` и offline import scripts не импортируются приложением.

## Резервные копии и пределы защиты

Локальная папка `release-backup.local/` исключена из Git:

| Файл                           | SHA256                                                           | Содержимое                                                                                         |
| ------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| smilestream-pre-release.bundle | 0E13E87498F098DAC2585993FEB25AEEBBAA50158E883F70F2ED392637AC194B | Все Git refs до подготовки релиза; feature f99bddc, main 4c33592                                   |
| production-app-data.json       | DE48E2EF65C818BDC3E40AAEE33E4B17209B7F496CEDBCFDB3C5475AAA5FB4E9 | Реальный read-only снимок videos/screens/roles/RLS/functions; только количество/отпечаток Auth IDs |
| production-schema-audit.json   | 4AD08DB96DF892704AAB73D724D70B83C0740B7A8D2E0E2EDB02D838CCD2C3E9 | Инвентаризация схемы                                                                               |

`git bundle verify`, отдельный `git clone --no-checkout` из bundle и `git fsck --full` прошли. Это проверенное восстановление **кода**, не всей базы. JSON не содержит паролей/токенов и НЕ заменяет Auth backup. Скопируйте резервные файлы в защищённое внешнее хранилище.

До разрешения SQL пользователь должен получить полный экспорт: Lovable → More → Cloud → Overview → Advanced settings → Export project data → Export data → Database → Export → Start export. Сохранить архив и проверить восстановление в отдельном временном окружении. Экспорт включает Auth/password hashes, поэтому хранить только приватно; он не включает Storage-файлы, secrets и provider configuration. Отдельно сохранить Storage и конфигурацию. Не присылайте секреты в чат. Эта полная копия и её DB restore пока НЕ выполнены.

## Миграции: только после отдельного разрешения

Не запускать исходный Drizzle baseline/seed, `db reset`, автоматический `db push` или repair истории. Применять ровно семь существующих файлов в порядке ниже, после сверки production schema и резервной копии. Новых SQL-миграций в этом дополнении нет.

| Файл в supabase/migrations                       | SHA256                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| 20261016174139_centralized_playback_settings.sql | DCF497670C6C89956E0217DFD0A636E988B8DD623D783A2B2343EA1A33BF4DD6 |
| 20261016211630_admin_media_metadata.sql          | 9FF478FE9236F0458AA8DE140E3064DA481C86C98CA783F3BBA20D60DFB1C6D2 |
| 20261017041255_reorder_identity_guard.sql        | 12C4F0FC18FB06004B050214634AD22432963B773F8550B1CE3CBED5647A6ACE |
| 20261017123203_advertisement_library.sql         | 55EB41A06152D218C6D9B0358C561065C8148FDD7B2838532634846A267F4A37 |
| 20261017131933_ad_playback_settings.sql          | 7D4458B70FD6D76BD389BF88C01A6DFBFD723ACCB33864CBECA0DBF4CC84EB83 |
| 20261017132134_media_cover_urls.sql              | 9B86422753652902162B9E032641B89A8FFD94862F757920B8803C3BE70B3DD7 |
| 20261017133052_ad_snapshot_capacity_guard.sql    | 4744AB4F6B2AD1E0A1A40403B8A6EBFAF3466A8FC221B2392456252738F50A10 |

Они добавляют playback_settings, media_metadata, advertisements, ad_playback_settings, RPC/политики/проверки; рекламы по умолчанию OFF, тестового контента нет. Не менять существующий auth trigger/roles, не перезаписывать 25 видео. Между metadata и identity guard не выпускать промежуточную версию. История MCP тестового проекта имеет другие timestamps: сверять имена и SQL, не повторять автоматически.

## Последовательность выпуска и отдельные разрешения

1. Ревью Draft PR #1 и candidate branch. Повторить в CI `bun install --frozen-lockfile` и проверки: локально Bun недоступен. Зависимости/bun.lock этим дополнением не меняются.
2. Полный приватный Cloud export + Storage/config backup; проверенное DB восстановление. Снять свежие counts/order/roles и журнал миграций перед операцией.
3. Получить **отдельное разрешение применить эти семь миграций к ieytvixchndxnxsxpcot**. Выполнять без baseline seeds. Проверить RLS anon/user/admin, отсутствие INSERT/DELETE settings, неизменность videos/auth/roles; не создавать тестового пользователя/fixtures в production.
4. Получить **отдельное разрешение на merge PR #1 в main**. Обычный merge без force push/rebase/squash опубликованной истории. Это синхронизирует код в существующий Lovable editor, но не означает разрешения на Publish. Не менять backend/env на тестовый.
5. Проверить editor build/preview на рабочей схеме без тестовых записей. Публичный URL `/tv`, вход администратора, существующие 25 видео; реклама остаётся OFF до её отдельной настройки. Не открывать ускоренный integration build как production.
6. Получить **отдельное разрешение нажать Publish/Update** существующего проекта. Только затем обновить опубликованный сайт. Не создавать второй Lovable проект и не отключать/reconnect GitHub.
7. Снять контрольные counts/order/roles, проверить вход и короткий Samsung smoke, зафиксировать release SHA и время. Подборка контента импортируется отдельным согласованным этапом.

Lovable синхронизирует одну выбранную ветку. Переключение Project settings → Git → GitHub → branch меняет editor-код, но само по себе НЕ изолирует Cloud database. Поэтому безопасный staging здесь — уже работающий локальный launcher с отдельным test Supabase. Пока не создано действительно отдельное Cloud backend-окружение, не запускать новые write paths на Lovable preview до миграций/разрешений. Активную main не переключали.

## Откат

При ошибке после merge вернуть прежнее приложение новым revert-коммитом (reviewed `git revert -m 1 <merge-SHA>`), дождаться Lovable build и отдельно разрешённого Publish/Update. Не force-push/reset main. Additive таблицы оставить: старая версия их игнорирует. При необходимости отключить рекламу администратором. Не DROP новые таблицы и не восстанавливать baseline seeds. При DB-инциденте остановить admin writes, снять свежий snapshot и согласовать полное восстановление из проверенного архива; оно может потерять изменения после backup. Автоматический destructive rollback не подготовлен. Проверить videos order, Auth login и RLS после восстановления.

## Источники механизма Lovable

- [GitHub sync и ветки](https://docs.lovable.dev/integrations/github)
- [Cloud](https://docs.lovable.dev/features/cloud)
- [Database backups](https://docs.lovable.dev/features/database)
- [Export project data](https://docs.lovable.dev/features/advanced-settings)
