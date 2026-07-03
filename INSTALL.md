# 📦 Установка Goh Hosting на сервер

Полная инструкция по развёртыванию платформы на VPS.

## 📋 Требования

- **Сервер**: Ubuntu 20.04+ / Debian 11+ (рекомендуется)
- **RAM**: минимум 2 ГБ (рекомендуется 4 ГБ)
- **Диск**: минимум 20 ГБ свободного места
- **Docker**: версия 20.10+
- **Docker Compose**: версия 2.0+
- **Git**: для клонирования репозитория
- **Root-доступ**: или пользователь в группе `docker`

## 🚀 Пошаговая установка

### 1. Подготовка сервера

Подключитесь к серверу по SSH:

```bash
ssh root@ваш-сервер-ip
```

Обновите систему:

```bash
apt update && apt upgrade -y
```

Установите необходимые пакеты:

```bash
apt install -y curl git
```

### 2. Установка Docker

Если Docker ещё не установлен:

```bash
# Установка Docker
curl -fsSL https://get.docker.com | sh

# Добавьте пользователя в группу docker (если не root)
usermod -aG docker $USER

# Включите автозапуск Docker
systemctl enable docker
systemctl start docker

# Проверьте установку
docker --version
docker compose version
```

### 3. Клонирование репозитория

Клонируйте проект в `/root/goh-hosting` (или другую папку по выбору):

```bash
cd /root
git clone https://github.com/ваш-username/goh-hosting.git
cd goh-hosting
```

### 4. Настройка переменных окружения

Скопируйте шаблон и отредактируйте:

```bash
cp .env.example .env
nano .env
```

**Обязательные переменные:**

#### Ngrok (публичный адрес)

1. Зарегистрируйтесь: https://dashboard.ngrok.com/signup
2. Получите authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. Создайте статический домен: https://dashboard.ngrok.com/domains → **Create Domain**

```env
NGROK_AUTHTOKEN=ваш_токен_из_dashboard
NGROK_URL=https://ваш-домен.ngrok-free.app
```

#### Секреты приложения

Сгенерируйте случайные ключи:

```bash
# SESSION_SECRET (32 символа)
openssl rand -hex 32

# BOT_API_KEY (любая случайная строка)
openssl rand -hex 16
```

Впишите в `.env`:

```env
SESSION_SECRET=сгенерированный_ключ_32_символа
BOT_API_KEY=сгенерированный_ключ_16_символов
SITE_URL=https://ваш-домен.ngrok-free.app
```

#### Telegram-бот

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Команда: `/newbot`
3. Скопируйте токен (формат: `123456:ABC-DEF...`)

```env
BOT_TOKEN=ваш_токен_от_BotFather
```

#### Автообновление (опционально)

Если хотите автообновление при push в GitHub:

```bash
openssl rand -hex 32
```

```env
GITHUB_WEBHOOK_SECRET=сгенерированный_секрет
```

**Итоговый `.env` должен выглядеть так:**

```env
NGROK_AUTHTOKEN=2abc...xyz
NGROK_URL=https://my-domain.ngrok-free.app
SESSION_SECRET=f7e8d9c...
BOT_API_KEY=a1b2c3d...
SITE_URL=https://my-domain.ngrok-free.app
BOT_TOKEN=123456:ABC-DEF...
GITHUB_WEBHOOK_SECRET=9f8e7d...  # опционально
```

Сохраните файл (`Ctrl+O`, `Enter`, `Ctrl+X` в nano).

### 5. Сделайте скрипт обновления исполняемым

```bash
chmod +x update.sh
```

### 6. Запуск контейнеров

Первый запуск (загрузит образы и соберёт проект):

```bash
docker compose up -d
```

Это займёт 3-5 минут. Следите за процессом:

```bash
docker compose logs -f
```

Дождитесь строк:
```
goh-web     | ✓ Ready in 2.5s
goh-bot     | ✓ Бот @ваш_бот запущен
goh-tunnel  | ✓ Tunnel established at https://...
```

Нажмите `Ctrl+C` чтобы выйти из логов (контейнеры продолжат работу).

### 7. Проверка работоспособности

**Проверьте статус контейнеров:**

```bash
docker compose ps
```

Все должны быть в статусе `Up` и `healthy` (web).

**Откройте сайт в браузере:**

```
https://ваш-домен.ngrok-free.app
```

Должна открыться главная страница Goh Hosting.

**Проверьте Telegram-бота:**

Напишите `/start` вашему боту в Telegram — он должен ответить.

### 8. Настройка автообновления (опционально)

Если вы установили `GITHUB_WEBHOOK_SECRET` в `.env`:

1. Откройте репозиторий на GitHub
2. **Settings** → **Webhooks** → **Add webhook**
3. Заполните:
   - **Payload URL**: `https://ваш-домен.ngrok-free.app/api/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: ваш `GITHUB_WEBHOOK_SECRET` из `.env`
   - **Events**: Just the `push` event
   - **Active**: ✅
4. Сохраните

Теперь при каждом push в `main` сервер будет обновляться автоматически.

Подробности: [AUTOUPDATE.md](./AUTOUPDATE.md)

## ✅ Готово!

Платформа развёрнута и работает. Пользователи могут:

1. Написать `/start` боту в Telegram
2. Зарегистрироваться командой `/register`
3. Создать сервер командой `/create`
4. Войти на сайт (ник + пароль из регистрации)
5. Загрузить код бота и запустить его

## 🛠️ Полезные команды

### Просмотр логов

```bash
# Все сервисы
docker compose logs -f

# Только web
docker compose logs -f web

# Только бот платформы
docker compose logs -f bot

# Только ngrok-туннель
docker compose logs -f tunnel
```

### Перезапуск сервисов

```bash
# Все сервисы
docker compose restart

# Только web (после изменения кода)
docker compose restart web

# Только бот
docker compose restart bot
```

### Обновление вручную

```bash
cd /root/goh-hosting
git pull origin main
docker compose build web
docker compose up -d
```

### Остановка и запуск

```bash
# Остановить все контейнеры
docker compose down

# Запустить снова
docker compose up -d
```

### Просмотр использования ресурсов

```bash
docker stats
```

### Очистка неиспользуемых образов

```bash
docker image prune -a -f
docker volume prune -f
```

## 🐛 Решение проблем

### Контейнер web не запускается

Проверьте логи:
```bash
docker compose logs web
```

Частые причины:
- Неверный `.env` (проверьте все переменные)
- Порт 3000 уже занят (измените в `docker-compose.yml`)

### Ngrok-туннель не работает

Проверьте:
```bash
docker compose logs tunnel
```

Возможные проблемы:
- Неверный `NGROK_AUTHTOKEN`
- Неверный `NGROK_URL` (должен начинаться с `https://`)
- Лимит соединений ngrok (бесплатно 1 туннель)

### Бот не отвечает в Telegram

Проверьте:
```bash
docker compose logs bot
```

Причины:
- Неверный `BOT_TOKEN`
- Бот не запущен: `/setprivacy` → Disable в @BotFather
- Файрвол блокирует исходящие соединения

### Docker socket permission denied

Если не root:
```bash
sudo usermod -aG docker $USER
# Выйдите и войдите снова
```

### Нехватка места на диске

Очистите старые образы:
```bash
docker system prune -a -f
```

## 🔐 Безопасность

- Смените пароль root на сервере
- Настройте файрвол (UFW):
  ```bash
  ufw allow 22/tcp    # SSH
  ufw allow 80/tcp    # HTTP (для Caddy, если нужен прямой доступ)
  ufw enable
  ```
- Регулярно обновляйте систему: `apt update && apt upgrade`
- Не выкладывайте `.env` в открытый доступ
- Используйте `GITHUB_WEBHOOK_SECRET` для защиты автообновления

## 📚 Дополнительные материалы

- [README.md](./README.md) — общая информация о проекте
- [AUTOUPDATE.md](./AUTOUPDATE.md) — настройка автообновления
- [AGENTS.md](./AGENTS.md) — архитектура и внутреннее устройство

## 💬 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker compose logs -f`
2. Изучите Issues на GitHub
3. Создайте новый Issue с описанием проблемы и логами

---

Удачного хостинга! 🚀
