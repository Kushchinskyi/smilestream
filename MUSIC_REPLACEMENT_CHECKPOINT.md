> ЗАМЕНЕНО НОВЫМ РЕШЕНИЕМ ПОЛЬЗОВАТЕЛЯ: старая музыка полностью удалена из production, включая 59 MP3. Прослушивание больше не блокирует импорт. Актуальный результат: MUSIC_FINAL_REPLACEMENT.md и content/music-cleanup-verification.json. Не восстанавливать старую ротацию. Ниже — исторический checkpoint до очистки.

# Замена музыкальной библиотеки — checkpoint 18.10.2026

## Статус
ЗАМЕНА НЕ ВЫПОЛНЕНА. Новых допущенных записей: **0**, удалённых старых: **0**.
Старая подборка отвергнута пользователем по звучанию. Она временно работает до готовности замены, чтобы не обнулить телевизоры.
Техническая пригодность старых записей не означает подтверждённый Premium Fit.

| Профиль | Старых записей, пока в работе | Длительность старой ротации | Новых допущено | Недостаёт новых до 50 | Средний подтверждённый Premium Fit |
|---|---:|---|---:|---:|---|
| Jazz & Lounge | 21 | 0:58:23 | 0 | 50 | — |
| Lo-Fi & Chillhop | 5 | 0:16:00 | 0 | 50 | — |
| Ambient & Relax | 5 | 0:41:02 | 0 | 50 | — |
| Deep House & Chill Electronic | 3 | 0:09:10 | 0 | 50 | — |
| Soft Rock & Acoustic | 21 | 0:57:41 | 0 | 50 | — |
| Modern Pop & Nu-Disco | 4 | 0:08:46 | 0 | 50 | — |
| Автомікс | 50 | 2:24:28 | 0 | 50 | — |

59 уникальных старых MP3, 109 назначений; Автомікс повторно использует записи основных профилей.
Новый каталог имеет нулевую допущенную длительность. 60 новых кандидатов требуют прослушивания и правового допуска; это не 60 импортированных треков.

## Действительно выполнено
- Повторная анонимная REST-сверка: семь полных строк профилей и порядок URL совпадают с локальным планом; все 25 videos совпадают с исходным снимком; уровни звука и original_video_ids прежние.
- Новая HTTP Range-проверка: 59/59 действующих Storage URL вернули 206, по 4096 байт. Это доступность файла, не слуховой контроль.
- Ранее завершены загрузка 59 файлов (359968294 байта), побайтовые SHA256-проверки и старт всех 59 через браузерную админку. Доказательства: content/music-storage-verification.json. На физическом Samsung эта музыкальная партия агентом не проверялась.
- Сохранены локальные снимки профилей и прежнего Storage-инвентаря в music-replacement.local (игнорируется Git). Это не полный backup Auth/базы.
- Свежая SQL-проверка bucket/objects/policies НЕ выполнена: официальный Lovable MCP отказал из-за бесплатной квоты (46 минут до повтора). Платный план не подключался. Прежняя проверка: public bucket, 59 объектов, нет write policies на storage.objects. Текущую конфигурацию нельзя считать повторно подтверждённой.
- Новые MP3 не скачивались и не загружались. Записей/удалений в production в этом этапе нет.
- TV engine, музыка/ducking, реклама и основная админка не менялись. Crossfade/лупы для новых записей не проверены; слуховой проверки точек стыка нет, менять стабильный engine оснований пока нет.

## Отбор и права
Источники проверены 18.10.2026:
- [Free To Use API](https://freetouse.com/api): официальный открытый каталог. [Лицензия](https://freetouse.com/license), §2: бесплатный вариант исключает коммерческие приложения; §3 ограничивает передачу файлов третьим лицам. 60 записей ниже — только исследовательская очередь, не разрешение на клинику или публичный MP3 bucket. Нужны письменные условия именно для нашей схемы.
- [Bensound](https://www.bensound.com/terms-and-conditions): §5.3 исключает публичное исполнение, интеграция приложения требует проверки условий; покупка обычной подписки сама по себе не решает вопрос клиники.
- [Purrple Cat](https://freelofi.com/license), первичный текст https://freelofi.com/js/license.js?v=9: есть коммерческая аудиовизуальная лицензия, но самостоятельное аудиораспространение ограничено; отдельное публичное MP3-хранилище и независимый музыкальный канал требуют уточнения. Не допущен автоматически.
- Holizna/OpenGameArt больше не расширяется ради количества: новый запрос заменяет прежний поиск.

Никаких покупок, подписок или писем авторам не выполнялось. Метаданные жанров не являются нашей слуховой оценкой. Автоматическая и подтверждённая оценки пока null.

## Очередь для прослушивания
Для каждого кандидата: «потребує прослуховування», legal_review, технический аудит не выполнен, Premium Fit —. Указанное направление — поисковая гипотеза, длительность — данные поставщика, не ffprobe.
Полная машиночитаемая очередь: content/music-premium-candidates.json. Ссылки ведут к официальной карточке API с данными записи; публичного плеера/новой платформы не создавалось.

| Направление поиска | Композиция / исполнитель | Длительность, сек | Первичный источник |
|---|---|---:|---|
| Jazz & Lounge | Restaurant Groove — Walen | 133 | [Карточка](https://api.freetouse.com/v3/music/tracks/01840d16-209b-d939-6333-36bfbf0546a1) |
| Jazz & Lounge | glimmer — massobeats | 151 | [Карточка](https://api.freetouse.com/v3/music/tracks/06ab6f7a-077c-45de-bf00-0ed687c28afe) |
| Jazz & Lounge | Sexy Touch — Dagored | 126 | [Карточка](https://api.freetouse.com/v3/music/tracks/39a7e116-785c-4b46-809e-de2b3f1323d5) |
| Jazz & Lounge | Coffee & Vinyl — Aventure | 143 | [Карточка](https://api.freetouse.com/v3/music/tracks/3b8280eb-dc65-4288-96db-d2f36de03cc9) |
| Jazz & Lounge | Iced Tea — Aventure | 159 | [Карточка](https://api.freetouse.com/v3/music/tracks/5d35077b-64b1-44a1-a33c-43c1d4ef7840) |
| Jazz & Lounge | Smooth Nostalgia — Aventure | 151 | [Карточка](https://api.freetouse.com/v3/music/tracks/6003b954-985c-4ced-8b6b-d571cfebb0f0) |
| Jazz & Lounge | Soulful Luxe — Aventure | 168 | [Карточка](https://api.freetouse.com/v3/music/tracks/7e4d6faf-3dda-44cf-9ae4-bf6e045589fa) |
| Jazz & Lounge | Monday Routine — Aventure | 143 | [Карточка](https://api.freetouse.com/v3/music/tracks/c7c31884-f971-4430-8190-31b1f79f3e68) |
| Jazz & Lounge | city — massobeats | 140 | [Карточка](https://api.freetouse.com/v3/music/tracks/cc3d9f0e-53a1-405f-812b-abea2e3fb8be) |
| Jazz & Lounge | Italy — Aylex | 193 | [Карточка](https://api.freetouse.com/v3/music/tracks/de375052-13a2-1a5c-7da4-283f7daf7c94) |
| Lo-Fi & Chillhop | honey jam — massobeats | 133 | [Карточка](https://api.freetouse.com/v3/music/tracks/f5096754-4ce7-f995-4ce8-25daef51ade9) |
| Lo-Fi & Chillhop | Poolside — Aventure | 138 | [Карточка](https://api.freetouse.com/v3/music/tracks/0ca27c3d-b234-46c3-82a0-67b334299711) |
| Lo-Fi & Chillhop | downtown — massobeats | 156 | [Карточка](https://api.freetouse.com/v3/music/tracks/158e9227-d671-4280-b14c-cf228c52cc64) |
| Lo-Fi & Chillhop | noon — massobeats | 188 | [Карточка](https://api.freetouse.com/v3/music/tracks/202f6745-784e-97aa-73c5-50653f5bdf16) |
| Lo-Fi & Chillhop | missed call — massobeats | 144 | [Карточка](https://api.freetouse.com/v3/music/tracks/372fbc6c-b365-4159-97d9-0a83f88295e9) |
| Lo-Fi & Chillhop | petals — massobeats | 134 | [Карточка](https://api.freetouse.com/v3/music/tracks/56193a8c-d821-4a73-83ed-9e96f3e6caa2) |
| Lo-Fi & Chillhop | moonlit — massobeats | 170 | [Карточка](https://api.freetouse.com/v3/music/tracks/5b515798-1d49-4c3d-9783-d7a2a78b5781) |
| Lo-Fi & Chillhop | Imagine — Lukrembo | 154 | [Карточка](https://api.freetouse.com/v3/music/tracks/5fa52877-d009-fd7f-d417-6e45d055aaac) |
| Lo-Fi & Chillhop | citrus — massobeats | 136 | [Карточка](https://api.freetouse.com/v3/music/tracks/654e7631-341d-4af6-a40b-0f38039365c1) |
| Lo-Fi & Chillhop | floral — massobeats | 147 | [Карточка](https://api.freetouse.com/v3/music/tracks/667c016c-10b4-ee0a-21ed-a8606f750dbc) |
| Ambient & Relax | Make a Stand — Filo Starquez | 156 | [Карточка](https://api.freetouse.com/v3/music/tracks/0455e5fe-58a0-005e-2207-d13b5f94c711) |
| Ambient & Relax | Light Through Glass — Zolvi | 137 | [Карточка](https://api.freetouse.com/v3/music/tracks/0cf661e0-f6dd-4501-b890-f80a963dde87) |
| Ambient & Relax | Distant Clarity — Zolvi | 134 | [Карточка](https://api.freetouse.com/v3/music/tracks/128458fc-9ba2-416d-8554-bec39631b384) |
| Ambient & Relax | Harbour — Johny Grimes | 167 | [Карточка](https://api.freetouse.com/v3/music/tracks/2eb6c87d-2352-4961-8054-1a9963766e2e) |
| Ambient & Relax | Genesis — Johny Grimes | 126 | [Карточка](https://api.freetouse.com/v3/music/tracks/308e78f1-7026-4b8e-9624-013986cdeb87) |
| Ambient & Relax | Swanlake — Zambolino | 149 | [Карточка](https://api.freetouse.com/v3/music/tracks/3aff8d54-7167-4ee6-bf4d-1420523c6269) |
| Ambient & Relax | Wandering — Epic Spectrum | 154 | [Карточка](https://api.freetouse.com/v3/music/tracks/3b50d9e7-9d1e-942b-f735-fe699531815c) |
| Ambient & Relax | Open Framework — Zolvi | 127 | [Карточка](https://api.freetouse.com/v3/music/tracks/5af22e8a-cdec-421f-92a7-90eaafe71b97) |
| Ambient & Relax | Timeless — Epic Spectrum | 120 | [Карточка](https://api.freetouse.com/v3/music/tracks/70a9e65c-1d42-399e-a065-d05d3fe41896) |
| Ambient & Relax | Gentle Progression — Zolvi | 142 | [Карточка](https://api.freetouse.com/v3/music/tracks/75b57065-8942-4043-b508-39ee3bbc614a) |
| Deep House & Chill Electronic | Aurora — Luke Bergs | 162 | [Карточка](https://api.freetouse.com/v3/music/tracks/f8a154cc-47cb-8220-ee4f-8e22fa1f52bc) |
| Deep House & Chill Electronic | Rolling — HiLau | 160 | [Карточка](https://api.freetouse.com/v3/music/tracks/0701e4b6-fd97-4568-8228-654decf85265) |
| Deep House & Chill Electronic | Falling — tubebackr | 174 | [Карточка](https://api.freetouse.com/v3/music/tracks/159a51ba-bc7d-6e53-c8a2-7bdbfef5c129) |
| Deep House & Chill Electronic | Shadows — Popsicles | 192 | [Карточка](https://api.freetouse.com/v3/music/tracks/1cef70e7-c222-d1e5-fb17-2ad850b118aa) |
| Deep House & Chill Electronic | Feel Alive — Nebulite | 159 | [Карточка](https://api.freetouse.com/v3/music/tracks/3d0cd393-54ab-a30a-997b-afca7484c948) |
| Deep House & Chill Electronic | glass house — numbthefeelings | 146 | [Карточка](https://api.freetouse.com/v3/music/tracks/3f036e19-e318-4e6e-bd25-8a86b58f45c2) |
| Deep House & Chill Electronic | Moonshine — tubebackr | 196 | [Карточка](https://api.freetouse.com/v3/music/tracks/4992bcb6-427b-d41f-7efd-56ce6f689587) |
| Deep House & Chill Electronic | Sunrise — tubebackr | 186 | [Карточка](https://api.freetouse.com/v3/music/tracks/4b6a8c63-9688-d427-b2c2-ac7541d52356) |
| Deep House & Chill Electronic | Ibiza Vibes — Walen | 131 | [Карточка](https://api.freetouse.com/v3/music/tracks/4c33c998-e04a-13a0-7345-b7bcd15493c1) |
| Deep House & Chill Electronic | Decadence — tubebackr | 187 | [Карточка](https://api.freetouse.com/v3/music/tracks/50440375-e8e6-5df7-9cdc-0997532f86c0) |
| Soft Rock & Acoustic | Synergy — Aylex | 150 | [Карточка](https://api.freetouse.com/v3/music/tracks/e9df589f-1286-e430-d5a2-7acbfc9b3ffb) |
| Soft Rock & Acoustic | Drum Story — Pufino | 120 | [Карточка](https://api.freetouse.com/v3/music/tracks/4b0e5836-596a-b937-fbd1-fdff19772f83) |
| Soft Rock & Acoustic | Joshua Tree — Guillermo Guareschi | 150 | [Карточка](https://api.freetouse.com/v3/music/tracks/acffc6ff-ecec-9217-c532-6ddd1b506283) |
| Soft Rock & Acoustic | Rainbow — Aetheric | 188 | [Карточка](https://api.freetouse.com/v3/music/tracks/12ac0635-cdd3-4a19-a28f-d5d807278052) |
| Soft Rock & Acoustic | When Autumn Calls — Zambolino | 166 | [Карточка](https://api.freetouse.com/v3/music/tracks/140fa163-6bd3-47d6-b186-bd0b7533a740) |
| Soft Rock & Acoustic | School Bus — Aetheric | 135 | [Карточка](https://api.freetouse.com/v3/music/tracks/24b9fe90-4745-4743-b27e-122303f52cb6) |
| Soft Rock & Acoustic | Uke Waves — Aylex | 129 | [Карточка](https://api.freetouse.com/v3/music/tracks/25b07db9-e62f-41d2-8609-5a882f3ef948) |
| Soft Rock & Acoustic | Slow and Sweet — Dagored | 131 | [Карточка](https://api.freetouse.com/v3/music/tracks/2f19165c-a9ae-4a1e-ab49-1aee42b115e4) |
| Soft Rock & Acoustic | Acoustic Heaven — Guillermo Guareschi | 177 | [Карточка](https://api.freetouse.com/v3/music/tracks/353d9dce-7e9a-b136-330f-3a532b28d512) |
| Soft Rock & Acoustic | Playtime — Aetheric | 159 | [Карточка](https://api.freetouse.com/v3/music/tracks/430fbd18-f360-4463-bf82-b514c0c4a182) |
| Modern Pop & Nu-Disco | See Me Through — Burgundy | 122 | [Карточка](https://api.freetouse.com/v3/music/tracks/b7dca04d-98c2-a7fc-6caf-8b85492e9492) |
| Modern Pop & Nu-Disco | Adventures Begin — Pufino | 159 | [Карточка](https://api.freetouse.com/v3/music/tracks/c79703ae-9644-7036-ec61-d2ad4026c0ec) |
| Modern Pop & Nu-Disco | Dream Potion — tubebackr | 214 | [Карточка](https://api.freetouse.com/v3/music/tracks/e18627b1-2ce9-624c-4d91-1b1f96e25c5c) |
| Modern Pop & Nu-Disco | Like You Mean It — Burgundy | 128 | [Карточка](https://api.freetouse.com/v3/music/tracks/4488447b-2571-249a-c60f-1a6565f3455d) |
| Modern Pop & Nu-Disco | Tell Me — Burgundy | 141 | [Карточка](https://api.freetouse.com/v3/music/tracks/4e451dd5-8955-5804-8ede-abeadb65c913) |
| Modern Pop & Nu-Disco | Triumph — Burgundy | 139 | [Карточка](https://api.freetouse.com/v3/music/tracks/52f9571c-44a4-97bc-0e26-d8d5b3542ae1) |
| Modern Pop & Nu-Disco | Get Yours, Get Out — Burgundy | 135 | [Карточка](https://api.freetouse.com/v3/music/tracks/55565d5d-a311-accd-3e21-95f58f2b829f) |
| Modern Pop & Nu-Disco | Dream On — Moavii | 162 | [Карточка](https://api.freetouse.com/v3/music/tracks/58ce355e-9db1-1181-4d76-c6f2cf4b39f0) |
| Modern Pop & Nu-Disco | Sunlight — Luke Bergs | 196 | [Карточка](https://api.freetouse.com/v3/music/tracks/5d74da71-f734-07b9-5ab9-39545dc6416c) |
| Modern Pop & Nu-Disco | Time Slip — Burgundy | 121 | [Карточка](https://api.freetouse.com/v3/music/tracks/7260971e-9849-8d5e-e710-bd9bae49e33c) |

## Допуск и следующий шаг
scripts/music-premium-gate.mjs отдельно проверяет подтверждённое прослушивание 4–5, имя слушателя, дату, заметки, SHA256 именно прослушанного файла, права клиники/публичного хостинга и технический аудит. Это офлайн-проверка, не автоматический импортёр и не runtime RLS. Старый CLI начального импорта отключён до любых файловых записей, исторический planner сохранён для воспроизводимости.

Необходим реальный слушатель (пользователь или музыкальный куратор): сначала выбрать 5–10 эталонных записей, оценить тембр/бас/ритм/вокал/переходы/усталость/Premium Fit. Агент не может достоверно слышать музыку и не подменяет это декодированием/EBU R128. Для допуска поставщика требуется подтверждение коммерческого исполнения в Украине, обоих прав и открытого MP3-хостинга; ранее пользователь не подтвердил договор публичного исполнения. Возможное платное лицензирование требует отдельного решения, бесплатные метаданные не обязывают покупать.

После слухового и правового допуска: получить разрешённые оригиналы, декодировать и измерить LUFS/LRA/peaks/длительность, проверить весь файл/Range/браузер, загрузить под новыми именами без upsert старых объектов; подготовить транзакционное переключение с полным сравнением свежего снимка всех профилей/settings и сохранением ID/параметров. Проверить TV/Без музики/ducking/рекламу/переходы/Samsung. Удалять старые объекты только после повторной проверки всех ссылок и успешного переключения, не по одному отсутствию URL в профиле. SQL замены/удаления пока не подготовлен: допущенной партии нет.

Повторить официальный read-only Storage inventory после восстановления квоты. Снимки music-replacement.local/profiles-before.json и storage-before.json не дают доказательства отсутствия ссылок во всей БД; глобальная проверка ссылок перед удалением ещё требуется.

## Проверки кода
- TypeScript: PASS.
- Vitest: 18 файлов, 119 тестов PASS.
- Node: 27 тестов PASS, включая 5 новых тестов допуска и отказа старого CLI без перезаписи файлов.
- ESLint трёх затронутых скриптов: PASS после исправления форматирования.
- Production build: PASS; есть информационное уведомление Vite о tsconfig-paths, не ошибка сборки.
- Изоляция media-test и integration-test: PASS.
- Bun отсутствует, проверки выполнены установленными Node-зависимостями.
- Новый музыкальный каталог на Samsung, слуховой комфорт, новые переходы и новые права НЕ проверены. Никаких новых композиций в production нет.
