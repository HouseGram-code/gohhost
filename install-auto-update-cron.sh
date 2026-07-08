#!/bin/bash
# Установка автообновления через cron (проверка каждые 5 минут)

REPO_DIR="/root/goh-hosting"
CRON_CMD="*/5 * * * * cd $REPO_DIR && bash update-check.sh >> /var/log/goh-auto-update.log 2>&1"

echo "📦 Установка автообновления через cron..."
echo ""

# Проверяем что мы в правильной папке
if [ ! -f "$REPO_DIR/docker-compose.yml" ]; then
  echo "❌ Папка $REPO_DIR не найдена или не содержит docker-compose.yml"
  exit 1
fi

# Создаём скрипт проверки обновлений
cat > "$REPO_DIR/update-check.sh" << 'EOF'
#!/bin/bash
# Проверка обновлений и автоматическое применение

cd /root/goh-hosting || exit 1

# Получаем текущий и удалённый commit
git fetch origin main -q
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Найдены обновления, запуск update.sh..."
  bash update.sh
else
  # Ничего не выводим если обновлений нет (чтобы не захламлять лог)
  :
fi
EOF

chmod +x "$REPO_DIR/update-check.sh"
chmod +x "$REPO_DIR/update.sh"

echo "✅ Скрипт проверки создан: $REPO_DIR/update-check.sh"
echo ""

# Проверяем есть ли уже такая задача в cron
if crontab -l 2>/dev/null | grep -q "update-check.sh"; then
  echo "⚠️  Cron-задача уже существует"
  echo ""
  echo "Текущий crontab:"
  crontab -l | grep update-check
else
  # Добавляем задачу в cron
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "✅ Cron-задача добавлена"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Автообновление настроено!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "• Проверка обновлений: каждые 5 минут"
echo "• Лог: /var/log/goh-auto-update.log"
echo ""
echo "Команды для управления:"
echo ""
echo "  Просмотр лога:"
echo "    tail -f /var/log/goh-auto-update.log"
echo ""
echo "  Проверить сейчас:"
echo "    cd $REPO_DIR && bash update-check.sh"
echo ""
echo "  Удалить автообновление:"
echo "    crontab -e  # удалите строку с update-check.sh"
echo ""
echo "  Посмотреть cron-задачи:"
echo "    crontab -l"
echo ""
