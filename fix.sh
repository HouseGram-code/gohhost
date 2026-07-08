#!/bin/bash
# Скрипт автоматического восстановления сервера
# Использование: bash fix.sh

set -e

echo "🔧 Диагностика и восстановление Goh Hosting..."
echo ""

# Проверка что мы в правильной папке
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ Ошибка: docker-compose.yml не найден"
  echo "Запустите скрипт из папки /root/goh-hosting"
  exit 1
fi

echo "📊 Проверка статуса контейнеров..."
docker compose ps
echo ""

# Проверка статуса web-контейнера
WEB_STATUS=$(docker compose ps web --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "not_found")

if [ "$WEB_STATUS" = "running" ]; then
  echo "✅ Web-контейнер запущен"
  
  # Проверка здоровья
  if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "✅ Web-сервер отвечает корректно (HTTP 200)"
  else
    echo "⚠️  Web-контейнер запущен, но не отвечает на запросы"
    echo "Попробуем перезапустить..."
    docker compose restart web
    sleep 5
  fi
else
  echo "❌ Web-контейнер не запущен (статус: $WEB_STATUS)"
  echo "Попробуем восстановить..."
fi

# Проверка ngrok
TUNNEL_STATUS=$(docker compose ps tunnel --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "not_found")

if [ "$TUNNEL_STATUS" = "running" ]; then
  echo "✅ Ngrok-туннель запущен"
else
  echo "❌ Ngrok-туннель не запущен (статус: $TUNNEL_STATUS)"
fi

# Проверка бота
BOT_STATUS=$(docker compose ps bot --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "not_found")

if [ "$BOT_STATUS" = "running" ]; then
  echo "✅ Бот запущен"
else
  echo "⚠️  Бот не запущен (статус: $BOT_STATUS)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🔄 ВЫБЕРИТЕ ДЕЙСТВИЕ"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "1) Быстрый перезапуск (docker compose restart)"
echo "2) Пересборка web + перезапуск (docker compose build web && up -d)"
echo "3) Полная переустановка (down + build --no-cache + up -d)"
echo "4) Только логи (docker compose logs)"
echo "5) Проверка переменных окружения"
echo "6) Выход"
echo ""
read -p "Ваш выбор [1-6]: " choice

case $choice in
  1)
    echo ""
    echo "🔄 Перезапуск всех сервисов..."
    docker compose restart
    echo ""
    echo "⏳ Ожидание 10 секунд..."
    sleep 10
    echo ""
    echo "Проверка статуса:"
    docker compose ps
    ;;
    
  2)
    echo ""
    echo "🔨 Пересборка web-контейнера..."
    docker compose build web
    echo ""
    echo "🚀 Перезапуск сервисов..."
    docker compose up -d
    echo ""
    echo "⏳ Ожидание 15 секунд..."
    sleep 15
    echo ""
    echo "Проверка статуса:"
    docker compose ps
    ;;
    
  3)
    echo ""
    echo "⚠️  ВНИМАНИЕ: Это остановит все контейнеры и пересоберёт их заново"
    read -p "Продолжить? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      echo ""
      echo "💾 Создание резервной копии данных..."
      [ -d "data" ] && cp -r data data.backup.$(date +%Y%m%d_%H%M%S)
      echo ""
      echo "🛑 Остановка контейнеров..."
      docker compose down
      echo ""
      echo "🧹 Очистка старых образов..."
      docker image prune -f
      echo ""
      echo "🔨 Полная пересборка (это может занять несколько минут)..."
      docker compose build --no-cache
      echo ""
      echo "🚀 Запуск сервисов..."
      docker compose up -d
      echo ""
      echo "⏳ Ожидание 20 секунд..."
      sleep 20
      echo ""
      echo "Проверка статуса:"
      docker compose ps
    else
      echo "Отменено"
    fi
    ;;
    
  4)
    echo ""
    echo "📋 Логи (последние 100 строк):"
    echo "═══════════════════════════════════════════════════════════════"
    docker compose logs --tail 100
    ;;
    
  5)
    echo ""
    echo "🔍 Проверка переменных окружения:"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Файл .env:"
    if [ -f ".env" ]; then
      echo "✅ Файл .env существует"
      echo ""
      echo "Установленные переменные (секреты скрыты):"
      cat .env | grep -v '^#' | grep -v '^$' | sed 's/=.*$/=***/' | head -20
      echo ""
      echo "Полный .env (для проверки):"
      echo "---"
      cat .env
      echo "---"
    else
      echo "❌ Файл .env НЕ НАЙДЕН!"
      echo "Создайте его из шаблона:"
      echo "  cp .env.example .env"
      echo "  nano .env"
    fi
    ;;
    
  6)
    echo "Выход"
    exit 0
    ;;
    
  *)
    echo "Неверный выбор"
    exit 1
    ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ ФИНАЛЬНАЯ ПРОВЕРКА"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Проверка локально
echo "1️⃣  Проверка web локально (в контейнере)..."
if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/').then(r=>console.log('✅ HTTP',r.status)).catch(e=>console.log('❌',e.message))" 2>/dev/null; then
  :
else
  echo "❌ Web не отвечает локально"
fi

echo ""
echo "2️⃣  Проверка доступности из Caddy..."
if docker compose exec -T caddy wget -q -O- http://web:3000/ >/dev/null 2>&1; then
  echo "✅ Caddy → Web работает"
else
  echo "❌ Caddy не может достучаться до Web"
fi

echo ""
echo "3️⃣  Логи ngrok-туннеля (последние 5 строк):"
docker compose logs tunnel --tail 5 2>&1 | grep -E 'established|error|ERR|started' || echo "  (нет значимых сообщений)"

echo ""
echo "4️⃣  Финальный статус:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "✨ Готово!"
echo ""
echo "📝 Следующие шаги:"
echo "   1. Откройте https://herma-nonhydrated-meaninglessly.ngrok-free.app"
echo "   2. Если не работает — проверьте логи: docker compose logs -f"
echo "   3. Если нужна помощь — см. TROUBLESHOOTING.md"
echo ""
