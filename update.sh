#!/bin/bash
# Скрипт автоматического обновления при push в GitHub
# Запускается через webhook /api/webhook/github
set -e

REPO_DIR="${HOST_REPO_DIR:-/root/goh-hosting}"
LOG_FILE="/tmp/goh-update.log"

echo "🔄 [$(date '+%Y-%m-%d %H:%M:%S')] Начало обновления..." | tee -a "$LOG_FILE"
echo "📂 Репозиторий: $REPO_DIR" | tee -a "$LOG_FILE"

cd "$REPO_DIR" || exit 1

# Сохраняем текущий commit
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Получаем изменения из GitHub
echo "📥 Скачиваем обновления из GitHub..." | tee -a "$LOG_FILE"
git fetch origin main 2>&1 | tee -a "$LOG_FILE" || {
  echo "❌ Ошибка получения обновлений" | tee -a "$LOG_FILE"
  exit 1
}

# Проверяем, есть ли новые изменения
NEW_COMMIT=$(git rev-parse --short origin/main)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  echo "✅ Обновлений нет (уже на $OLD_COMMIT)" | tee -a "$LOG_FILE"
  exit 0
fi

echo "📦 Найдены обновления: $OLD_COMMIT → $NEW_COMMIT" | tee -a "$LOG_FILE"

# Применяем изменения
echo "🔄 Применение изменений..." | tee -a "$LOG_FILE"
git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"

# Пересобираем web-контейнер
echo "🔨 Пересборка контейнера..." | tee -a "$LOG_FILE"
docker compose build web 2>&1 | tee -a "$LOG_FILE" || {
  echo "❌ Ошибка сборки" | tee -a "$LOG_FILE"
  exit 1
}

# Перезапускаем сервисы (web пересоздаётся с новым образом)
echo "🚀 Перезапуск сервисов..." | tee -a "$LOG_FILE"
docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Ждём здоровья контейнера
echo "⏳ Ожидание готовности сервиса..." | tee -a "$LOG_FILE"
for i in {1..30}; do
  if docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "✅ Сервис работает" | tee -a "$LOG_FILE"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️ Тайм-аут ожидания сервиса (но он может ещё запуститься)" | tee -a "$LOG_FILE"
  fi
  sleep 2
done

# Очищаем неиспользуемые образы
echo "🧹 Очистка старых образов..." | tee -a "$LOG_FILE"
docker image prune -f 2>&1 | tee -a "$LOG_FILE" || true

echo "✅ [$(date '+%Y-%m-%d %H:%M:%S')] Обновление завершено: $NEW_COMMIT" | tee -a "$LOG_FILE"
echo "📝 Лог изменений:" | tee -a "$LOG_FILE"
git log --oneline --decorate --no-walk $NEW_COMMIT 2>&1 | tee -a "$LOG_FILE"

exit 0
