# API Documentation

Полная документация по REST API для работы с данными индексера блокчейн-событий.

## Базовый URL

```
http://localhost:3000/api
```

## Общая информация

- **Формат запросов**: JSON
- **Формат ответов**: JSON
- **Кодировка**: UTF-8
- **Валидация адресов**: Ethereum адреса должны быть в формате `0x` + 40 hex символов
- **Формат дат**: ISO 8601 (например: `2024-01-15T10:30:00Z`)

---

## Endpoints

### 1. Лидерборд

#### GET `/api/leaderboard`

Получить список пользователей, отсортированных по общему депозиту (totalDeposited) в порядке убывания.

**Query Parameters:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|--------------|--------------|----------|
| `limit` | number | Нет | 100 | Количество записей (1-1000) |

**Пример запроса:**

```bash
curl "http://localhost:3000/api/leaderboard?limit=50"
```

**Пример ответа:**

```json
[
  {
    "rank": 1,
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "totalDeposited": "100.5",
    "totalWithdrawn": "50.0",
    "totalCompounded": "1000000",
    "totalCompoundCount": 10,
    "referralEarningsUnits": "50000",
    "lastActiveAt": "2024-01-15T10:30:00Z"
  },
  {
    "rank": 2,
    "address": "0x8ba1f109551bD432803012645Hac136c22C2e1",
    "totalDeposited": "75.3",
    "totalWithdrawn": "25.0",
    "totalCompounded": "750000",
    "totalCompoundCount": 8,
    "referralEarningsUnits": "37500",
    "lastActiveAt": "2024-01-15T09:15:00Z"
  }
]
```

**Описание полей:**

- `rank` - Позиция в рейтинге (начиная с 1)
- `address` - Ethereum адрес пользователя
- `totalDeposited` - Общая сумма депозитов в ETH
- `totalWithdrawn` - Общая сумма выводов в ETH
- `totalCompounded` - Общее количество скомпаунженных units
- `totalCompoundCount` - Количество операций компаундинга
- `referralEarningsUnits` - Заработанные units с рефералов
- `lastActiveAt` - Дата последней активности (ISO 8601)

**Ошибки:**

- `400 Bad Request` - Если `limit` вне диапазона 1-1000

---

#### GET `/api/leaderboard/:address`

Получить данные конкретного пользователя в лидерборде, включая его текущую позицию.

**Path Parameters:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `address` | string | Да | Ethereum адрес пользователя |

**Пример запроса:**

```bash
curl "http://localhost:3000/api/leaderboard/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

**Пример ответа:**

```json
{
  "rank": 5,
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "totalDeposited": "50.0",
  "totalWithdrawn": "20.0",
  "totalCompounded": "500000",
  "totalCompoundCount": 5,
  "referralEarningsUnits": "25000",
  "lastActiveAt": "2024-01-15T10:30:00Z"
}
```

**Ошибки:**

- `400 Bad Request` - Неверный формат адреса
- `404 Not Found` - Пользователь не найден

---

### 2. Реферальная система

#### GET `/api/referrals/:address`

Получить список всех рефералов указанного пользователя с информацией о наградах.

**Path Parameters:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `address` | string | Да | Ethereum адрес реферера |

**Пример запроса:**

```bash
curl "http://localhost:3000/api/referrals/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

**Пример ответа:**

```json
[
  {
    "referee": "0x8ba1f109551bD432803012645Hac136c22C2e1",
    "totalUnitsRewarded": "10000",
    "lastRewardAt": "2024-01-15T10:30:00Z",
    "totalRewards": 5
  },
  {
    "referee": "0x9ca2f109551bD432803012645Hac136c22C2e2",
    "totalUnitsRewarded": "5000",
    "lastRewardAt": "2024-01-14T15:20:00Z",
    "totalRewards": 3
  }
]
```

**Описание полей:**

- `referee` - Ethereum адрес реферала
- `totalUnitsRewarded` - Общее количество units, полученных с этого реферала
- `lastRewardAt` - Дата последней награды (ISO 8601) или `null`
- `totalRewards` - Общее количество наград от этого реферала

**Ошибки:**

- `400 Bad Request` - Неверный формат адреса

**Примечание:** Результат отсортирован по `totalUnitsRewarded` в порядке убывания.

---

### 3. Еженедельный рейтинг компаундов

#### GET `/api/weekly-compound-ranking`

Получить еженедельный рейтинг пользователей по количеству компаундов за текущую неделю.

**Query Parameters:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `weekStart` | string | Нет | Дата начала недели (ISO 8601). Если не указана, используется текущая неделя |

**Пример запроса:**

```bash
# Текущая неделя
curl "http://localhost:3000/api/weekly-compound-ranking"

# Конкретная неделя
curl "http://localhost:3000/api/weekly-compound-ranking?weekStart=2024-01-15T00:00:00Z"
```

**Пример ответа:**

```json
[
  {
    "rank": 1,
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "compoundCount": 50,
    "totalCompounded": "5000000"
  },
  {
    "rank": 2,
    "address": "0x8ba1f109551bD432803012645Hac136c22C2e1",
    "compoundCount": 45,
    "totalCompounded": "4500000"
  }
]
```

**Описание полей:**

- `rank` - Позиция в рейтинге (1 = первое место)
- `address` - Ethereum адрес пользователя
- `compoundCount` - Количество операций компаундинга за неделю
- `totalCompounded` - Общее количество скомпаунженных units за неделю

**Особенности:**

- Рейтинг обновляется автоматически при каждом компаунде
- Сортировка по `totalCompounded` в порядке убывания (больший показатель = выше ранг)
- Неделя начинается с понедельника (UTC)
- Ранги пересчитываются автоматически при каждом компаунде

**Ошибки:**

- `400 Bad Request` - Неверный формат даты `weekStart`

---

#### GET `/api/weekly-compound-ranking/:address`

Получить позицию конкретного пользователя в еженедельном рейтинге компаундов.

**Path Parameters:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `address` | string | Да | Ethereum адрес пользователя |

**Query Parameters:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `weekStart` | string | Нет | Дата начала недели (ISO 8601). Если не указана, используется текущая неделя |

**Пример запроса:**

```bash
curl "http://localhost:3000/api/weekly-compound-ranking/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

**Пример ответа:**

```json
{
  "rank": 10,
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "compoundCount": 25,
  "totalCompounded": "2500000"
}
```

**Ошибки:**

- `400 Bad Request` - Неверный формат адреса или даты
- `404 Not Found` - Пользователь не найден в рейтинге за указанную неделю

---

### 4. TVL Chart (Total Value Locked)

#### GET `/api/tvl-chart`

Получить исторические данные TVL (Total Value Locked) контракта для построения графика.

**Query Parameters:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|--------------|--------------|----------|
| `from` | string | Нет | - | Начальная дата (ISO 8601) |
| `to` | string | Нет | - | Конечная дата (ISO 8601) |
| `limit` | number | Нет | 1000 | Максимальное количество точек (1-10000) |

**Пример запроса:**

```bash
# Все данные
curl "http://localhost:3000/api/tvl-chart"

# За период
curl "http://localhost:3000/api/tvl-chart?from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z&limit=500"
```

**Пример ответа:**

```json
[
  {
    "timestamp": "2024-01-15T10:30:00Z",
    "tvl": "1000.5"
  },
  {
    "timestamp": "2024-01-15T11:00:00Z",
    "tvl": "1050.2"
  },
  {
    "timestamp": "2024-01-15T11:30:00Z",
    "tvl": "1100.8"
  }
]
```

**Описание полей:**

- `timestamp` - Дата и время снимка TVL (ISO 8601)
- `tvl` - Значение TVL в ETH (строка для точности)

**Особенности:**

- Данные отсортированы по времени (от старых к новым)
- TVL обновляется автоматически при каждом депозите (`buyUnits`) и выводе (`sellUnits`)
- Если не указан `from`, возвращаются все доступные данные (до `limit`)
- Если не указан `to`, возвращаются данные до текущего момента

**Ошибки:**

- `400 Bad Request` - Неверный формат даты или `limit` вне диапазона 1-10000

---

### 5. Административные endpoints

#### GET `/api/update-weekly-rankings`

Обновить ранги в еженедельном рейтинге компаундов. Этот endpoint должен вызываться еженедельно (можно через cron job).

**Пример запроса:**

```bash
curl "http://localhost:3000/api/update-weekly-rankings"
```

**Пример ответа:**

```json
{
  "message": "Weekly rankings updated successfully"
}
```

**Примечание:** Обычно ранги обновляются автоматически при каждом компаунде, но этот endpoint может быть полезен для ручного обновления или миграции данных.

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| `200` | Успешный запрос |
| `400` | Неверный запрос (неправильные параметры, валидация) |
| `404` | Ресурс не найден |
| `500` | Внутренняя ошибка сервера |

---

## Примеры использования

### JavaScript/TypeScript

```typescript
// Получить лидерборд
const response = await fetch('http://localhost:3000/api/leaderboard?limit=10');
const leaderboard = await response.json();

// Получить данные пользователя
const userAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const userData = await fetch(`http://localhost:3000/api/leaderboard/${userAddress}`);
const user = await userData.json();

// Получить рефералов
const referrals = await fetch(`http://localhost:3000/api/referrals/${userAddress}`);
const refs = await referrals.json();

// Получить еженедельный рейтинг
const weeklyRanking = await fetch('http://localhost:3000/api/weekly-compound-ranking');
const ranking = await weeklyRanking.json();

// Получить TVL данные за последние 7 дней
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const tvlData = await fetch(
  `http://localhost:3000/api/tvl-chart?from=${weekAgo.toISOString()}&limit=1000`
);
const tvl = await tvlData.json();
```

### Python

```python
import requests

# Получить лидерборд
response = requests.get('http://localhost:3000/api/leaderboard', params={'limit': 10})
leaderboard = response.json()

# Получить данные пользователя
user_address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
user_data = requests.get(f'http://localhost:3000/api/leaderboard/{user_address}')
user = user_data.json()

# Получить рефералов
referrals = requests.get(f'http://localhost:3000/api/referrals/{user_address}')
refs = referrals.json()
```

### cURL

```bash
# Получить топ-10 лидерборда
curl "http://localhost:3000/api/leaderboard?limit=10"

# Получить данные пользователя
curl "http://localhost:3000/api/leaderboard/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

# Получить еженедельный рейтинг
curl "http://localhost:3000/api/weekly-compound-ranking"

# Получить TVL за последние 7 дней
curl "http://localhost:3000/api/tvl-chart?from=2024-01-08T00:00:00Z&limit=1000"
```

---

## Ограничения и рекомендации

1. **Rate Limiting**: Рекомендуется реализовать rate limiting для production
2. **Пагинация**: Для больших списков используйте параметр `limit`
3. **Кэширование**: Результаты лидерборда могут кэшироваться для улучшения производительности
4. **Валидация адресов**: Все Ethereum адреса проверяются на корректность формата

---

## Примечания

- Все суммы в ETH возвращаются как строки для сохранения точности
- Все units возвращаются как строки
- Даты и время в формате ISO 8601 (UTC)
- Неделя начинается с понедельника (UTC)
- Рейтинг компаундов обновляется в реальном времени при каждом компаунде
- TVL обновляется при каждом депозите и выводе

---

## Версионирование

Текущая версия API: `1.0.0`

В будущем версионирование может быть добавлено через префикс пути: `/api/v1/...`

