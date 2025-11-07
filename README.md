# DApp Backend

Backend система для индексации блокчейн-событий и предоставления API для работы с данными.

## Структура проекта

Проект состоит из двух основных сервисов:

- **API Service** (`apps/api`) - REST API для получения данных
- **Indexer Service** (`apps/indexer`) - Сервис для индексации блокчейн-событий

## Быстрый старт

### Требования

- Node.js 18+
- PostgreSQL
- Redis
- Переменные окружения настроены в `.env`

### Установка

```bash
npm install
```

### Настройка базы данных

```bash
# Применить миграции
npx prisma migrate dev

# Сгенерировать Prisma клиент
npx prisma generate
```

### Запуск

```bash
# Запустить оба сервиса одновременно
npm run start:all

# Или отдельно:
npm run start:api      # API на порту 3000
npm run start:indexer  # Indexer на порту 3001
```

## Документация

- **[Полная документация API](README_API.md)** - Детальное описание всех endpoints
- **[Локальная разработка](README_LOCAL_DEV.md)** - Инструкции по настройке и запуску
- Swagger UI: `http://localhost:3000/docs`

## API Endpoints

### Основные endpoints

- `GET /api/leaderboard` - Лидерборд пользователей (поддерживает `limit` и `offset` для пагинации)
- `GET /api/leaderboard/:address` - Данные пользователя
- `GET /api/referrals/:address` - Рефералы пользователя
- `GET /api/weekly-compound-ranking` - Еженедельный рейтинг компаундов
- `GET /api/tvl-chart` - Данные для графика TVL

Подробная документация: [README_API.md](README_API.md)

## Архитектура

### Indexer Service

- Слушает события из смарт-контракта через WebSocket
- Обрабатывает события через BullMQ очередь
- Сохраняет данные в PostgreSQL через Prisma
- Автоматически восстанавливает пропущенные события при старте

### API Service

- Предоставляет REST API для доступа к данным
- Использует Prisma для работы с БД
- Валидирует входные данные
- Возвращает данные в формате JSON
- Обновляет лидерборды и еженедельные рейтинги детерминированно (tie-breaker по `compoundCount` и адресу)

## Data Serialization

- Денежные и числовые метрики (Decimal, BigInt) сериализуются как строки, чтобы избежать потери точности в JSON.
- Клиентам рекомендуется конвертировать значения в числа/BigInt по месту использования.

## Тестирование

```bash
npm test -- apps/api/src/api.service.spec.ts # Юнит-тесты ApiService
npm test                                      # Полный прогон тестов
```

Тесты покрывают пагинацию лидерборда, вычисление рангов без загрузки всей таблицы и синхронизацию еженедельных рангов.

## Production Notes

- Все ранги пересчитываются атомарно через SQL Window Functions (`RANK()`), что исключает неконсистентные состояния.
- Пагинация лидерборда позволяет безопасно отдавать данные даже при больших объёмах пользователей.
- Логи NestJS используется для фиксации ошибок при пересчёте рангов.

## Переменные окружения

Создайте файл `.env` со следующими переменными:

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
```

## Команды

```bash
# Разработка
npm run start:all        # Запустить оба сервиса
npm run start:api        # Запустить только API
npm run start:indexer    # Запустить только Indexer

# Сборка
npm run build            # Собрать все проекты

# Тестирование
npm test                 # Запустить тесты
npm run test:watch       # Тесты в watch режиме

# Линтинг
npm run lint             # Проверить и исправить код

# База данных
npx prisma studio        # Открыть Prisma Studio
npx prisma migrate dev   # Создать и применить миграцию
```

## Структура базы данных

Основные модели:

- `User` - Пользователи с статистикой
- `Referral` - Реферальные связи
- `ReferralReward` - Награды за рефералов
- `TvlSnapshot` - Снимки TVL для графика
- `WeeklyCompoundRanking` - Еженедельный рейтинг компаундов
- `IndexerState` - Состояние индексера

Схема: `libs/prisma/schema.prisma`

## Лицензия

UNLICENSED
