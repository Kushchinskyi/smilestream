# Smilestream

Создай MVP веб-приложения Dental Media Network для бесплатного стоматологического телевидения в клиниках Украины. Язык интерфейса украинский. Стек стандартный Lovable. Современный премиальный минималистичный дизайн (белый, тёмно-синий, бирюзовые акценты). Маршруты: / — лендинг с объяснением сервиса; /tv — ТВ-плеер в формате 16:9, без лишнего UI, с большими кнопками первого запуска, поддержкой HTML5 MP4, autoplay muted с graceful fallback, sequential playlist, error handling, fullscreen и отображением текущего статуса только по вызову; /admin — защищённая аутентификацией панель управления плейлистом, роликами (название, URL, длительность, порядок, активность), возможностью редактировать, добавлять и удалять; /screens — защищённый список устройств, первоначально три экрана: Кабінет 1 (43), Кабінет 2 (43), Ресепшн (65). Для первых испытаний на Samsung Smart TV Tizen 2022 браузере сделай максимально совместимый плеер без тяжёлых анимаций, без YouTube embed и без внешней рекламы. Не заявляй ложную телеметрию: если реальный heartbeat не реализован, показывай 'дані відсутні', а не 'онлайн'. Используй реальные persistent backend данные для контента и авторизации; если backend пока не настроен, явно показывай демо-режим и безопасно не открывай административные операции публично. Для проверки добавь легальные тестовые видео из открытых демонстрационных источников, чётко обозначенные как тестовые, которые затем будут заменены собственным контентом. Не включай материалы с медицинскими обещаниями. Подготовь архитектуру для последующего подключения устройств по коду и рекламного планировщика, но не реализуй их в первом MVP. Создай реально работающий интерфейс и укажи, что нужно проверить на физических телевизорах.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smilestream.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/97741ecf-233f-4766-a5a8-1900f0aca92d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
