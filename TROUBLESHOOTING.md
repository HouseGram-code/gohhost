# 🔧 Решение проблем

## ❌ ERR_NGROK_3004 — сервер не отвечает

**Симптомы:**
- Сайт не открывается
- Ngrok показывает "invalid or incomplete HTTP response"
- Бот не отвечает в Telegram

**Причины:**
1. Web-контейнер не запущен или упал
2. Ngrok-туннель не поднялся
3. Ошибка при сборке после обновления
4. Неверные переменные окружения в `.env`

---

## 🚨 СРОЧНОЕ ВОССТАНОВЛЕНИЕ

### 1. Подключитесь к серверу

```bash
ssh root@31.129.101.71
```

(Или используйте панель управления хостинга)

### 2. Проверьте статус контейнеров

```bash
cd /root/goh-hosting
docker compose ps
```

**Что смотреть:**
- Все ли контейнеры в статусе `Up`?
- Web-контейнер в статусе `healthy`?
- Есть ли контейнеры в статусе `Restarting` или `Exited`?

### 3. Посмотрите логи

#### Логи всех контейнеров:
```bash
docker compose logs --tail 100
```

#### Только web (основной контейнер):
```bash
docker compose logs web --tail 50
```

#### Только ngrok-туннель:
```bash
docker compose logs tunnel --tail 30
```

#### Только бот:
```bash
docker compose logs bot --tail 30
```

### 4. Типичные проблемы и решения

#### ❌ Web-контейнер не запускается

**Логи показывают:** `Error: Cannot find module...` или `ENOENT`

**Решение:**
```bash
docker compose down
docker compose build --no-cache web
docker compose up -d
```

#### ❌ Ngrok-туннель не подключается

**Логи показывают:** `authentication failed` или `invalid authtoken`

**Решение:**
Проверьте `.env`:
```bash
cat .env | grep NGROK
```

Должно быть:
```
NGROK_AUTHTOKEN=ваш_реальный_токен_длинный
NGROK_URL=https://herma-nonhydrated-meaninglessly.ngrok-free.app
```

Если неверно — исправьте и перезапустите:
```bash
nano .env  # исправьте NGROK_* переменные
docker compose restart tunnel
```

#### ❌ Web запустился, но ngrok показывает ошибку

**Проверьте здоровье web-контейнера:**
```bash
docker compose exec web node -e "fetch('http://127.0.0.1:3000/').then(r=>console.log(r.status)).catch(e=>console.error(e))"
```

Должно вернуть `200`.

Если ошибка — проверьте переменные окружения:
```bash
docker compose exec web printenv | grep -E 'SESSION_SECRET|BOT_API_KEY|DATA_DIR'
```

Все должны быть установлены и не пустые.

#### ❌ Ошибка "Cannot connect to Docker daemon"

**Решение:**
```bash
systemctl start docker
docker compose up -d
```

#### ❌ После git pull контейнер не обновился

**Решение (полная переустановка):**
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА

### Проверка сети

```bash
# Проверьте, слушает ли web порт 3000
docker compose exec web netstat -tlnp | grep 3000

# Проверьте, доступен ли web из caddy
docker compose exec caddy wget -O- http://web:3000/ | head -20
```

### Проверка переменных окружения

```bash
# Все переменные web-контейнера
docker compose exec web printenv

# Только критичные
docker compose exec web printenv | grep -E 'NODE_ENV|SESSION_SECRET|BOT_API_KEY|DATA_DIR|HOST_DATA_DIR|SITE_URL'
```

### Проверка файловой системы

```bash
# Есть ли папка data?
ls -la /root/goh-hosting/data

# Доступна ли она из контейнера?
docker compose exec web ls -la /data

# Права на docker.sock
ls -la /var/run/docker.sock
```

### Проверка портов

```bash
# Какие порты слушает хост
netstat -tlnp | grep -E '3000|80'

# Заняты ли порты контейнерами
docker compose ps --format "table {{.Name}}\t{{.Ports}}"
```

---

## 🔄 ПОЛНАЯ ПЕРЕУСТАНОВКА

Если ничего не помогает — переустановите с нуля:

```bash
cd /root/goh-hosting

# 1. Сохраните данные пользователей
cp -r data data.backup

# 2. Остановите и удалите всё
docker compose down -v
docker system prune -a -f

# 3. Убедитесь что .env правильный
cat .env
# Если что-то не так — исправьте: nano .env

# 4. Соберите заново
docker compose build --no-cache

# 5. Запустите
docker compose up -d

# 6. Следите за логами
docker compose logs -f
```

Дождитесь строк:
```
goh-web     | ✓ Ready in X.Xs
goh-bot     | ✓ Бот @... запущен
goh-tunnel  | ✓ Tunnel established
```

Если контейнеры запустились — проверьте сайт в браузере.

---

## 📞 БЫСТРАЯ ШПАРГАЛКА

```bash
# Статус контейнеров
docker compose ps

# Логи (последние 50 строк)
docker compose logs --tail 50

# Перезапуск всех сервисов
docker compose restart

# Перезапуск только web
docker compose restart web

# Пересборка web
docker compose build web && docker compose up -d

# Полная переустановка
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Проверка здоровья
curl http://localhost:3000  # на сервере
docker compose exec web node -e "fetch('http://127.0.0.1:3000/').then(r=>console.log(r.ok))"

# Логи обновления (если настроен webhook)
cat /tmp/goh-update.log
```

---

## 🆘 ВСЁ СЛОМАЛОСЬ — МИНИМАЛЬНЫЙ ЗАПУСК

Если вообще ничего не работает, запустите минимальную конфигурацию:

```bash
# 1. Остановите всё
docker compose down

# 2. Запустите только web (без ngrok, без бота)
docker compose up web -d

# 3. Проверьте работает ли web локально
curl -I http://localhost:3000

# Если работает — проблема в ngrok или боте
# Если не работает — проблема в web или .env
```

**Если web работает локально:**
```bash
# Запустите ngrok отдельно
docker compose up tunnel -d
docker compose logs tunnel
```

**Если web НЕ работает локально:**
```bash
# Проблема в .env или сборке
docker compose logs web
cat .env
```

---

## ✅ ФИНАЛЬНАЯ ПРОВЕРКА

После восстановления проверьте все компоненты:

```bash
# 1. Контейнеры
docker compose ps
# Все должны быть Up, web — healthy

# 2. Web локально
curl -I http://localhost:3000
# HTTP/1.1 200 OK

# 3. Web через ngrok
curl -I https://herma-nonhydrated-meaninglessly.ngrok-free.app
# HTTP/2 200

# 4. Бот
# Напишите /start боту в Telegram — должен ответить

# 5. Панель
# Откройте сайт в браузере — должна загрузиться главная страница
```

Если все 5 пунктов работают — проблема решена! ✅

---

## 📋 КОНТРОЛЬНЫЙ СПИСОК

Перед обращением за помощью соберите:

```bash
# 1. Версия Docker
docker --version
docker compose version

# 2. Статус контейнеров
docker compose ps

# 3. Логи всех контейнеров
docker compose logs --tail 200 > /tmp/goh-logs.txt

# 4. Переменные окружения (УДАЛИТЕ СЕКРЕТЫ перед отправкой!)
cat .env | grep -v 'SECRET\|TOKEN\|KEY' > /tmp/goh-env.txt

# 5. Состояние системы
df -h
free -m
docker stats --no-stream

# 6. Лог обновления (если есть)
cat /tmp/goh-update.log > /tmp/goh-update-log.txt
```

Отправьте файлы из `/tmp/goh-*.txt` вместе с описанием проблемы.

---

💡 **Совет:** Добавьте эту страницу в закладки — она поможет быстро восстановить работу сервера.
