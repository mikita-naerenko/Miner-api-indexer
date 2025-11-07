## Deployment Checklist

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

> NestJS 11 и текущая версия `@nestjs/swagger` имеют конфликтующие peer-зависимости. Флаг `--legacy-peer-deps` обязателен, иначе установка падает с ошибкой `ERESOLVE`.

### 2. Build & Test

```bash
npm run build
npm test
```

Дополнительно (по желанию):

```bash
npm run lint
npm run test:cov
```

### 3. Apply Database Migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Environment Variables

Создайте файл `.env` (или используйте секреты хостинга) со значениями:

```
DATABASE_URL=postgresql://user:password@host:5433/db
# или POSTGRES_URI (аналогичный URI)

EVENTS_REDIS_URL=redis://host:port
# либо REDIS_HOST / REDIS_PORT

PRIVATE_NODE_BASE_SEPOLIA_WS=wss://...
PRIVATE_NODE_BASE_SEPOLIA_HTTPS=https://...
TEST_MINER_CONTRACT=0x...

PORT=3000          # API (опционально)
INDEXER_PORT=3001  # если переопределяете порт индексера
```

### 5. Run Services

- API: `npm run start:api`
- Indexer: `npm run start:indexer`

Оба сервиса используют `ts-node` компилятор, поэтому дополнительных webpack-зависимостей не требуется.

### 6. Health Checks

- Swagger: `http://<host>:3000/docs`
- SSE Stream: `http://<host>:3000/events`
- Лидерборд: `GET /api/leaderboard`
- TVL Chart: `GET /api/tvl-chart`
- Weekly Compound: `GET /api/weekly-compound-ranking`

### 7. Monitoring Notes

- Индексер автоматически публикует события `user:update`, `tvl:update`, `weekly-compound:update` в Redis канал `events`. Убедитесь, что Redis доступен и конфигурация `EVENTS_REDIS_URL` верна.
- Проверяйте логи BullMQ и Prisma при первой синхронизации (возможны длительные запросы при большом объёме данных).

### 8. Optional: Docker

Для контейнеризации потребуется создать Dockerfile (ещё не добавлен). Примерный план:

1. Билд образа (`node:20-alpine` → `npm install --legacy-peer-deps` → `npm run build`).
2. Запуск API / Indexer в отдельных контейнерах, проброс env и сетевых зависимостей.

---

Следуя шагам выше, проект готов к выкатыванию на staging или production. После завершающей проверки можно пушить изменения на GitHub и настраивать CI/CD под эти команды.

