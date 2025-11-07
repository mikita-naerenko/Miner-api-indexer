# Локальная разработка

## Предварительные требования

1. **PostgreSQL** - должен быть запущен и доступен
2. **Redis** - должен быть запущен (для BullMQ очередей)
3. **Node.js** - версия 18+
4. **Установка зависимостей** — из-за несовместимых peer-зависимостей между NestJS 11 и текущей версией Swagger используйте команду с флагом `--legacy-peer-deps`:

```bash
npm install --legacy-peer-deps
```

Без этого флага `npm install` завершится ошибкой `ERESOLVE`.

## Переменные окружения

Убедитесь, что у вас есть файл `.env` с необходимыми переменными:

```env
# Database
POSTGRES_URI=postgresql://user:password@localhost:5432/dbname

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Blockchain RPC
PRIVATE_NODE_BASE_SEPOLIA_WS=wss://...
PRIVATE_NODE_BASE_SEPOLIA_HTTPS=https://...
TEST_MINER_CONTRACT=0x...

# Ports (опционально)
PORT=3000  # для API
# PORT=3001 для Indexer (или установите в коде)
```

## Настройка базы данных

1. Создайте миграцию Prisma (если еще не создана):
```bash
npx prisma migrate dev --name add_tvl_and_weekly_ranking
```

2. Сгенерируйте Prisma клиент:
```bash
npx prisma generate
```

## Запуск сервисов

### Вариант 1: Запуск обоих сервисов одновременно (рекомендуется)

```bash
npm run start:all
```

Это запустит:
- **API сервер** на `http://localhost:3000`
- **Indexer сервис** на `http://localhost:3001`

### Вариант 2: Запуск в отдельных терминалах

**Терминал 1 - API:**
```bash
npm run start:api
```

**Терминал 2 - Indexer:**
```bash
npm run start:indexer
```

### Вариант 3: Ручной запуск через Nest CLI

```bash
# API
npx nest start api --watch

# Indexer
npx nest start indexer --watch
```

## Проверка работы

### API Endpoints

После запуска API сервера, вы можете проверить endpoints:

```bash
# Лидерборд
curl http://localhost:3000/api/leaderboard

# TVL Chart
curl http://localhost:3000/api/tvl-chart

# Weekly Compound Ranking
curl http://localhost:3000/api/weekly-compound-ranking
```

### Indexer

Indexer сервис:
- Подключается к WebSocket провайдеру
- Слушает события из смарт-контракта
- Обрабатывает события через BullMQ очередь
- Автоматически восстанавливает пропущенные события при старте

## Полезные команды

```bash
# Сборка проекта
npm run build

# Линтинг
npm run lint

# Тесты
npm test

# Prisma Studio (для просмотра БД)
npx prisma studio
```

## Troubleshooting

### Порт уже занят
Если порт занят, измените `PORT` в `.env` или напрямую в `main.ts`

### Redis не подключен
Убедитесь, что Redis запущен:
```bash
redis-cli ping
# Должен вернуть: PONG
```

### База данных не подключена
Проверьте подключение к PostgreSQL:
```bash
psql $POSTGRES_URI -c "SELECT 1;"
```

### Prisma миграции не применены
```bash
npx prisma migrate deploy
```

