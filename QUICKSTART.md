# ⚡ Быстрый старт — 5 минут

Минимальная инструкция для опытных пользователей.

## 🎯 За 5 команд

```bash
# 1. Клонируйте
git clone https://github.com/ваш-username/goh-hosting.git
cd goh-hosting

# 2. Настройте .env
cp .env.example .env
nano .env  # впишите NGROK_*, SESSION_SECRET, BOT_TOKEN, BOT_API_KEY, SITE_URL

# 3. Сделайте скрипт исполняемым
chmod +x update.sh

# 4. Запустите
docker compose up -d

# 5. Проверьте
docker compose ps && docker compose logs -f
```

Откройте `https://ваш-домен.ngrok-free.app` в браузере.

## 🔑 Что нужно получить заранее

1. **Ngrok**: [dashboard.ngrok.com](https://dashboard.ngrok.com)
   - Authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
   - Статический домен: https://dashboard.ngrok.com/domains

2. **Telegram-бот**: создайте через [@BotFather](https://t.me/BotFather)
   - Команда: `/newbot`
   - Скопируйте токен

3. **Секреты**: сгенерируйте
   ```bash
   openssl rand -hex 32  # SESSION_SECRET
   openssl rand -hex 16  # BOT_API_KEY
   openssl rand -hex 32  # GITHUB_WEBHOOK_SECRET (опционально)
   ```

## 📝 Шаблон .env

```env
NGROK_AUTHTOKEN=2abc...xyz
NGROK_URL=https://my-domain.ngrok-free.app
SESSION_SECRET=f7e8d9c...
BOT_API_KEY=a1b2c3d...
SITE_URL=https://my-domain.ngrok-free.app
BOT_TOKEN=123456:ABC-DEF...
GITHUB_WEBHOOK_SECRET=9f8e7d...  # если нужно автообновление
```

## 🔄 Автообновление через GitHub Webhook

1. На GitHub: **Settings** → **Webhooks** → **Add webhook**
2. URL: `https://ваш-домен.ngrok-free.app/api/webhook/github`
3. Content type: `application/json`
4. Secret: ваш `GITHUB_WEBHOOK_SECRET`
5. Events: Just the `push` event

Теперь каждый `git push` автоматически обновляет сервер.

## 🛠️ Частые команды

```bash
# Логи
docker compose logs -f
docker compose logs -f web
docker compose logs bot --tail 50

# Перезапуск
docker compose restart
docker compose restart web

# Обновление вручную
git pull origin main && docker compose build web && docker compose up -d

# Остановка/запуск
docker compose down
docker compose up -d

# Очистка
docker system prune -a -f
```

## 📚 Полные инструкции

- [INSTALL.md](./INSTALL.md) — подробная установка с объяснениями
- [AUTOUPDATE.md](./AUTOUPDATE.md) — детали автообновления
- [README.md](./README.md) — общая документация

---

🚀 Готово за 5 минут!
