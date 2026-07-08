#!/bin/bash
# Скрипт для настройки бота в Daytona

export BOT_TOKEN="8854903374:AAF-sJcffy8jugKno6Ljegl2AANNjNQsCzo"
export API_BASE="https://3000-0ba45bb2-4cc3-44b7-aa54-15ce2e624834.daytonaproxy01.net"
export SITE_URL="https://3000-0ba45bb2-4cc3-44b7-aa54-15ce2e624834.daytonaproxy01.net"
export BOT_API_KEY="goh-internal-key-beta"

cd ~/gohhost/bot || exit 1

# Убить старый процесс, если запущен
pkill -f "python.*bot.py" || true

# Переустановить зависимости
python3 -m pip install --user -q httpx aiogram 2>/dev/null || true

# Запустить бота с правильными переменными
exec python3 bot.py
