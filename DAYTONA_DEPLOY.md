# 🚀 Развёртывание на Daytona

Инструкция по переносу проекта на Daytona IDE.

## 📋 Требования

- Аккаунт Daytona (https://daytona.io)
- SSH-ключи добавлены в профиль
- Git-репозиторий на GitHub

## 🎯 Способ 1: Через Daytona UI (самый простой)

### 1. Откройте Daytona Dashboard

https://app.daytona.io

### 2. Создайте новый Workspace

- **Нажмите**: "New Workspace" или "Create Workspace"
- **Repository URL**: `https://github.com/HouseGram-code/gohhost.git`
- **Branch**: `main`
- **Machine**: выберите `standard` или выше (нужен Docker)

### 3. Дождитесь инициализации

Daytona клонирует репозиторий и подготовит окружение.

## 🛠️ Способ 2: Через SSH (если нужно вручную)

### 1. Подключитесь к Daytona

```bash
ssh ffWjQVAryzzwZVjH0btcWaPwxsziYSUp@ssh.app.daytona.io
```

### 2. Клонируйте репозиторий

```bash
cd ~/projects  # или другая папка по выбору
git clone https://github.com/HouseGram-code/gohhost.git
cd gohhost
```

### 3. Установите зависимости

```bash
npm install
```

### 4. Скопируйте .env

```bash
cp .env.example .env
nano .env
```

Впишите переменные (см. INSTALL.md).

## 🔧 Запуск на Daytona

Daytona обычно не поддерживает Docker Compose по умолчанию. Нужны альтернативы:

### Вариант A: Node.js только (без Docker для ботов)

```bash
# 1. Сборка Next.js
npm run build

# 2. Запуск
npm start
```

Будет работать веб-сайт, но функционал управления ботами через Docker недоступен.

### Вариант B: Использовать Docker в Daytona (если доступен)

```bash
# Проверка Docker
docker --version
docker compose --version

# Если работает:
docker compose up -d
```

### Вариант C: Развернуть отдельные сервисы

#### Бот Telegram

```bash
cd bot
pip install -r requirements.txt
BOT_TOKEN=ваш_токен python bot.py
```

#### Web-приложение

```bash
npm run build
npm start
```

## 🌐 Доступ к приложению

Daytona предоставляет публичный URL для каждого приложения.

После запуска проверьте:
- Logs в Daytona UI
- Выданный публичный URL
- Статус приложения

## ⚙️ Переменные окружения

В Daytona UI → Workspace Settings → Environment Variables добавьте:

```
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
SESSION_SECRET=ваш_ключ
BOT_API_KEY=ваш_ключ
BOT_TOKEN=ваш_telegram_токен
SITE_URL=https://ваш-daytona-url
```

## 🤖 Telegram Бот на Daytona

Бот работает как отдельный Python-сервис.

### Установка

```bash
cd bot
pip install -r requirements.txt
```

### Запуск

```bash
BOT_TOKEN=123456:ABC-DEF... python bot.py
```

### Как процесс (в фоне)

```bash
nohup python bot.py > bot.log 2>&1 &
```

## 📦 Полный деплой (всё сразу)

Создайте файл `start.sh`:

```bash
#!/bin/bash
set -e

echo "🔧 Установка зависимостей Node.js..."
npm install

echo "🔨 Сборка Next.js..."
npm run build

echo "🚀 Запуск приложений..."

# Web в фоне
npm start &
WEB_PID=$!

# Бот в фоне
cd bot
pip install -r requirements.txt >/dev/null 2>&1
python bot.py &
BOT_PID=$!

echo "✅ Приложения запущены"
echo "   Web: PID $WEB_PID"
echo "   Bot: PID $BOT_PID"

wait
```

Запуск:

```bash
chmod +x start.sh
./start.sh
```

## 🔍 Диагностика

### Проверка статуса

```bash
ps aux | grep -E 'node|python'
```

### Логи

```bash
# Next.js логи
npm start  # видны в консоли

# Бот логи
tail -f bot.log
```

### Проверка портов

```bash
netstat -tlnp | grep -E '3000|8000'
```

## ⚠️ Ограничения на Daytona

1. **Docker**: может быть недоступен
   - Управление ботами пользователей будет недоступно
   - Web-панель будет работать, но без функции создания контейнеров

2. **Публичный URL**: выдаётся автоматически
   - Нельзя заранее узнать адрес
   - Может меняться при перезапуске

3. **Время жизни**: Workspace может быть остановлен после неактивности
   - Нужно иметь план B для production

## 💡 Рекомендация

Для production используйте:
- **VPS** (2.26.54.227) — для полного функционала с Docker
- **Daytona** — для разработки и тестирования

## 🔄 Обновление на Daytona

```bash
git pull origin main
npm install
npm run build
# Перезапустить приложение через Daytona UI или:
# pkill -f 'node server.js'
# npm start &
```

---

📚 Дополнительно:
- [Daytona Docs](https://docs.daytona.io)
- [Daytona Dashboard](https://app.daytona.io)
- [GitHub Integration](https://docs.daytona.io/integrations/github)
