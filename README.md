# 🚀 Goh Hosting

**Платформа для хостинга Telegram-ботов 24/7** — регистрация через бота, управление через веб-панель.

## ✨ Возможности

- 🤖 **Хостинг Telegram-ботов** — Python и Node.js из коробки
- 🌐 **Веб-панель** — управление, логи, файлы, настройки в одном месте
- 📦 **Docker-изоляция** — каждый бот в отдельном контейнере
- 🔒 **Аутентификация** — регистрация через Telegram-бота
- 📊 **Мониторинг** — CPU, RAM, диск, логи в реальном времени
- ⚡ **Автозапуск** — боты запускаются автоматически при падении
- 🔄 **Автообновление** — сервер обновляется при push в GitHub

## 🏗️ Архитектура

```
┌─────────────────┐
│  GitHub Push    │
└────────┬────────┘
         │ webhook
         ↓
┌─────────────────┐     ┌──────────────┐
│   Next.js Web   │────→│ Docker Sock  │
│   + API         │     │ (управление) │
└────────┬────────┘     └──────┬───────┘
         │                     │
         ├─────────────────────┼─────────────┐
         ↓                     ↓             ↓
    ┌─────────┐          ┌─────────┐   ┌─────────┐
    │ Bot 1   │          │ Bot 2   │   │ Bot N   │
    │ Python  │          │ Node.js │   │ ...     │
    └─────────┘          └─────────┘   └─────────┘
```

## 🚀 Быстрый старт

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/ваш-username/goh-hosting.git
cd goh-hosting
```

### 2. Настройте переменные окружения

```bash
cp .env.example .env
nano .env
```

Заполните:
- `NGROK_AUTHTOKEN` — с [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)
- `NGROK_URL` — ваш статический домен с [dashboard.ngrok.com/domains](https://dashboard.ngrok.com/domains)
- `SESSION_SECRET` — случайная строка (например, `openssl rand -hex 32`)
- `BOT_API_KEY` — любая случайная строка для внутренней связи
- `BOT_TOKEN` — токен вашего Telegram-бота от [@BotFather](https://t.me/BotFather)
- `GITHUB_WEBHOOK_SECRET` — для автообновлений (опционально)

### 3. Запустите контейнеры

```bash
docker compose up -d
```

### 4. Проверьте статус

```bash
docker compose ps
docker compose logs -f
```

Откройте ваш ngrok-адрес в браузере — должна появиться главная страница.

## 🔄 Автообновление

Сервер автоматически обновляется при каждом push в ветку `main`.

**Настройка в 3 шага:**

1. **Сгенерируйте секрет** (опционально):
   ```bash
   openssl rand -hex 32
   ```
   Добавьте в `.env`: `GITHUB_WEBHOOK_SECRET=ваш_ключ`

2. **Настройте webhook на GitHub**:
   - **Settings** → **Webhooks** → **Add webhook**
   - **Payload URL**: `https://ваш-домен.ngrok-free.app/api/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: ваш ключ из `.env`
   - **Events**: Just the `push` event

3. **Готово!** Теперь каждый push автоматически обновляет сервер.

📖 Подробная инструкция: [AUTOUPDATE.md](./AUTOUPDATE.md)

## 📚 Структура проекта

```
goh-hosting/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API endpoints
│   │   │   ├── auth/     # Аутентификация
│   │   │   ├── servers/  # Управление серверами
│   │   │   └── webhook/  # GitHub webhook для автообновления
│   │   ├── panel/        # Веб-панель управления
│   │   └── login/        # Страница входа
│   ├── components/       # React-компоненты
│   └── lib/              # Бизнес-логика
│       ├── auth.ts       # Аутентификация
│       ├── docker.ts     # Docker API
│       ├── engine.ts     # Управление контейнерами ботов
│       └── session.ts    # Сессии пользователей
├── bot/                  # Telegram-бот платформы
│   ├── bot.py            # Основной код бота
│   └── requirements.txt  # Python-зависимости
├── data/                 # Данные пользователей (создаётся автоматически)
│   ├── users.json        # База пользователей
│   └── bots/             # Файлы ботов пользователей
├── deployment/           # Скрипты развёртывания
├── docker-compose.yml    # Конфигурация сервисов
├── Dockerfile            # Образ Next.js приложения
├── Dockerfile.daytona    # Для Daytona (всё в одном)
├── update.sh             # Скрипт автообновления
└── .env                  # Переменные окружения (создайте из .env.example)
```

## 🛠️ Разработка

### Установка зависимостей

```bash
npm install
```

### Локальный dev-сервер

```bash
npm run dev
```

### Сборка для production

```bash
npm run build
npm start
```

### Линтинг и форматирование

```bash
npm run lint
npm run format  # если используете Prettier
```

## 📝 API Endpoints

### Аутентификация
- `POST /api/auth/register` — регистрация (только через бота)
- `POST /api/auth/login` — вход
- `POST /api/auth/logout` — выход
- `GET /api/auth/me` — текущий пользователь

### Управление серверами
- `GET /api/servers` — список серверов пользователя
- `GET /api/servers/[id]` — информация о сервере
- `PATCH /api/servers/[id]` — обновить настройки
- `POST /api/servers/[id]/action` — запуск/остановка/перезагрузка
- `GET /api/servers/[id]/logs` — логи контейнера
- `GET /api/servers/[id]/files` — список файлов
- `POST /api/servers/[id]/files` — загрузить/обновить файл
- `DELETE /api/servers/[id]/files` — удалить файл

### Webhook
- `POST /api/webhook/github` — автообновление при push

## 🔐 Безопасность

- ⚠️ **Docker socket** даёт root-доступ к хосту — запускайте только доверенный код
- 🔒 **Изоляция** — каждый бот в отдельном контейнере с лимитами ресурсов
- 🛡️ **Webhook** защищён секретом HMAC SHA-256
- 🔑 **Сессии** — защищены случайным ключом `SESSION_SECRET`

## 📦 Деплой на production

1. **Сервер с Docker** — VPS (Ubuntu/Debian рекомендуется)
2. **Клонируйте репозиторий** и настройте `.env`
3. **Сделайте скрипт исполняемым**: `chmod +x update.sh`
4. **Запустите**: `docker compose up -d`
5. **Настройте автообновление** — см. [AUTOUPDATE.md](./AUTOUPDATE.md)

## 🐛 Решение проблем

### Контейнер не запускается

```bash
docker compose logs web
docker compose logs bot
```

### Ошибка подключения к Docker socket

Убедитесь, что `/var/run/docker.sock` примонтирован:
```bash
docker compose down
docker compose up -d
```

### Ngrok-туннель не работает

Проверьте `NGROK_AUTHTOKEN` и `NGROK_URL` в `.env`:
```bash
docker compose logs tunnel
```

### Автообновление не работает

1. Проверьте webhook на GitHub — должна быть зелёная галочка
2. Проверьте логи: `cat /tmp/update.log`
3. Убедитесь что `update.sh` исполняемый: `chmod +x update.sh`

## 🤝 Вклад в проект

1. Fork репозиторий
2. Создайте ветку: `git checkout -b feature/amazing-feature`
3. Commit изменения: `git commit -m 'feat: добавил крутую фичу'`
4. Push в ветку: `git push origin feature/amazing-feature`
5. Откройте Pull Request

## ☁️ Развёртывание на Daytona

Daytona — облачная IDE для разработки. Подходит для разработки, тестирования и демо.

**Запуск:**
1. https://app.daytona.io → "New Workspace"
2. Repository: `https://github.com/HouseGram-code/gohhost.git`
3. В Terminal: `bash daytona-deploy.sh`

📖 [DAYTONA_DEPLOY.md](./DAYTONA_DEPLOY.md) | [DAYTONA_QUICK.txt](./DAYTONA_QUICK.txt)

## 📄 Лицензия

MIT — делайте что хотите, но без гарантий.

## 🔗 Ссылки

- **Next.js**: https://nextjs.org/docs
- **Docker**: https://docs.docker.com
- **ngrok**: https://ngrok.com/docs
- **Telegram Bot API**: https://core.telegram.org/bots/api

---

Сделано с ❤️ для хостинга Telegram-ботов
