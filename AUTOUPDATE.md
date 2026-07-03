# 🔄 Автообновление через GitHub Webhook

Сервер автоматически обновляется при каждом push в ветку `main`.

## 📋 Настройка

### 1. Установите секрет webhook (опционально, но рекомендуется)

На сервере сгенерируйте секретный ключ:

```bash
openssl rand -hex 32
```

Добавьте его в `.env`:

```env
GITHUB_WEBHOOK_SECRET=ваш_сгенерированный_ключ
```

Перезапустите контейнер:

```bash
docker compose up -d
```

### 2. Настройте webhook на GitHub

1. Откройте свой репозиторий на GitHub
2. Перейдите: **Settings** → **Webhooks** → **Add webhook**
3. Заполните форму:
   - **Payload URL**: `https://ваш-домен.ngrok-free.app/api/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: вставьте тот же ключ из `.env` (или оставьте пустым)
   - **Which events**: выберите "Just the `push` event"
   - **Active**: ✅ включено
4. Нажмите **Add webhook**

### 3. Сделайте скрипт обновления исполняемым

На сервере:

```bash
chmod +x update.sh
```

## ✅ Проверка

### Тест webhook endpoint

Откройте в браузере:

```
https://ваш-домен.ngrok-free.app/api/webhook/github
```

Должен вернуть JSON:

```json
{
  "service": "GitHub Webhook Handler",
  "status": "ready",
  "secretConfigured": true
}
```

### Тест автообновления

1. Сделайте изменение в коде (например, добавьте комментарий)
2. Запушьте в `main`:
   ```bash
   git add .
   git commit -m "test: автообновление"
   git push origin main
   ```
3. Проверьте логи на сервере:
   ```bash
   docker compose logs -f web
   ```
4. Проверьте лог обновления:
   ```bash
   cat /tmp/goh-update.log
   # или следите в реальном времени:
   tail -f /tmp/goh-update.log
   ```

GitHub покажет зелёную галочку ✅ в разделе **Recent Deliveries** вашего webhook, если всё прошло успешно.

## 🔍 Как это работает

1. **GitHub** → при push в `main` отправляет POST-запрос на `/api/webhook/github`
2. **Endpoint** → проверяет подпись, убеждается что это push в `main`
3. **Скрипт** `update.sh` → скачивает изменения, пересобирает контейнер, перезапускает сервисы
4. **Результат** → сервер обновлён автоматически, без простоя (кроме ~10 сек на перезапуск)

## 🛡️ Безопасность

- **Секрет webhook** защищает от поддельных запросов
- Обновляются только изменения из вашего репозитория
- Обрабатываются только события `push` в ветку `main`
- Запущенные боты пользователей не затрагиваются (они в отдельных контейнерах)

## 📝 Логи

**Лог обновления:**
```bash
cat /tmp/goh-update.log
tail -f /tmp/goh-update.log  # следить в реальном времени
```

**Логи webhook:**
```bash
docker compose logs -f web | grep webhook
docker compose logs -f web | grep GitHub
```

**Логи контейнера web:**
```bash
docker compose logs -f web
```

## ⚠️ Важно

- При обновлении web-контейнер перезапускается (~10 сек простоя)
- Боты пользователей **не перезапускаются** (работают независимо)
- Если обновление упало с ошибкой, сервер остаётся на предыдущей версии
- Старые Docker-образы автоматически удаляются для экономии места
