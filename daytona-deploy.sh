#!/bin/bash
# Скрипт развёртывания на Daytona
# Использование: bash daytona-deploy.sh

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 Развёртывание Goh Hosting на Daytona"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Daytona окружение
WORKSPACE_DIR="${DAYTONA_WORKSPACE_DIR:-.}"

echo "📂 Рабочая папка: $WORKSPACE_DIR"
cd "$WORKSPACE_DIR" || exit 1

# Проверка переменных окружения
if [ -z "$BOT_TOKEN" ]; then
  echo "❌ Ошибка: BOT_TOKEN не установлен"
  echo "Установите переменную окружения в Daytona UI:"
  echo "  Workspace Settings → Environment Variables"
  echo "  BOT_TOKEN = 123456:ABC-DEF..."
  exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
  echo "⚠️  SESSION_SECRET не установлен, генерируем..."
  export SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import os; print(os.urandom(32).hex())")
  echo "✅ SESSION_SECRET: $SESSION_SECRET"
fi

if [ -z "$BOT_API_KEY" ]; then
  echo "⚠️  BOT_API_KEY не установлен, генерируем..."
  export BOT_API_KEY=$(openssl rand -hex 16 2>/dev/null || python3 -c "import os; print(os.urandom(16).hex())")
  echo "✅ BOT_API_KEY: $BOT_API_KEY"
fi

# Получить URL Daytona
DAYTONA_URL="${DAYTONA_WORKSPACE_URL:-http://localhost:3000}"

echo ""
echo "📋 Установленные переменные:"
echo "  BOT_TOKEN: ${BOT_TOKEN:0:20}..."
echo "  SESSION_SECRET: ${SESSION_SECRET:0:20}..."
echo "  BOT_API_KEY: $BOT_API_KEY"
echo "  SITE_URL: $DAYTONA_URL"
echo ""

# Проверка .env
if [ ! -f ".env" ]; then
  echo "📝 Создание .env файла..."
  cat > .env << EOF
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
SESSION_SECRET=$SESSION_SECRET
BOT_API_KEY=$BOT_API_KEY
BOT_TOKEN=$BOT_TOKEN
SITE_URL=$DAYTONA_URL
DATA_DIR=/tmp/goh-data
EOF
  mkdir -p /tmp/goh-data
  echo "✅ .env создан"
else
  echo "✅ .env уже существует"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  📦 УСТАНОВКА И СБОРКА"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Node.js зависимости
echo "📥 Установка Node.js зависимостей..."
npm install --production 2>&1 | tail -5

echo ""
echo "🔨 Сборка Next.js приложения..."
npm run build 2>&1 | tail -10

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 ЗАПУСК ПРИЛОЖЕНИЙ"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Функция для обработки сигналов
cleanup() {
  echo ""
  echo "🛑 Остановка приложений..."
  kill $WEB_PID 2>/dev/null || true
  kill $BOT_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Запуск web
echo "🌐 Запуск Next.js веб-приложения (порт 3000)..."
npm start > /tmp/web.log 2>&1 &
WEB_PID=$!
echo "   ✅ Web PID: $WEB_PID"

sleep 5

# Запуск бота
echo ""
echo "🤖 Запуск Telegram-бота..."
cd bot

# Проверка Python
if ! command -v python3 &> /dev/null; then
  echo "⚠️  Python3 не найден, пропускаем бота"
  cd ..
else
  # Установка Python зависимостей
  pip install --quiet -r requirements.txt 2>/dev/null || {
    echo "⚠️  Ошибка установки Python-зависимостей, но продолжаем..."
  }

  # Запуск бота
  python3 bot.py > /tmp/bot.log 2>&1 &
  BOT_PID=$!
  cd ..
  echo "   ✅ Bot PID: $BOT_PID"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ ПРИЛОЖЕНИЯ ЗАПУЩЕНЫ"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Веб-приложение:   $DAYTONA_URL"
echo "🤖 Telegram-бот:     работает (в фоне)"
echo ""
echo "📝 Логи:"
echo "  tail -f /tmp/web.log   # логи Next.js"
echo "  tail -f /tmp/bot.log   # логи бота"
echo ""
echo "🔍 Проверка:"
echo "  curl $DAYTONA_URL"
echo ""
echo "⚠️  Нажмите Ctrl+C для остановки (или закройте Terminal)"
echo ""

# Ожидание завершения процессов
wait
