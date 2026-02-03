# API Reference

Complete documentation for all API endpoints provided by the DApp Backend API service.

## Base URL

All endpoints are prefixed with `/api`.

## Endpoints

### Leaderboard

#### `GET /api/leaderboard`

Get paginated leaderboard of users ordered by total deposits.

**Query Parameters:**

- `limit` (optional, default: 100) - Number of entries to return (1-1000)
- `offset` (optional, default: 0) - Pagination offset (0-100000)

**Response:** `200 OK`

```json
[
  {
    "rank": 1,
    "address": "0x1234abcd5678ef901234abcd5678ef901234abcd",
    "totalDeposited": "150.42",
    "totalWithdrawn": "50.00",
    "totalCompounded": "75.12",
    "totalCompoundCount": 12,
    "referralEarningsUnits": "24.5",
    "lastActiveAt": "2025-01-15T10:30:00.000Z"
  }
]
```

**Error Responses:**

- `400 Bad Request` - Invalid pagination parameters

---

#### `GET /api/leaderboard/:address`

Get specific user's position and statistics in the leaderboard.

**Path Parameters:**

- `address` - Ethereum address of the user (must be valid 0x-prefixed hex address)

**Response:** `200 OK`

```json
{
  "rank": 42,
  "address": "0x1234abcd5678ef901234abcd5678ef901234abcd",
  "totalDeposited": "150.42",
  "totalWithdrawn": "50.00",
  "totalCompounded": "75.12",
  "totalCompoundCount": 12,
  "referralEarningsUnits": "24.5",
  "lastActiveAt": "2025-01-15T10:30:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid address format
- `404 Not Found` - User not found

---

### Referrals

#### `GET /api/referrals/:address`

Get referral statistics for a specific referrer address.

**Path Parameters:**

- `address` - Ethereum address of the referrer (must be valid 0x-prefixed hex address)

**Response:** `200 OK`

```json
[
  {
    "referee": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "totalUnitsRewarded": "12.75",
    "lastRewardAt": "2025-01-15T10:30:00.000Z",
    "totalRewards": 5,
    "buyAmount": "150.42"
  }
]
```

**Error Responses:**

- `400 Bad Request` - Invalid address format

---

### TVL (Total Value Locked)

#### `GET /api/tvl-chart`

Get TVL chart data with optional date filtering.

**Query Parameters:**

- `limit` (optional, default: 1000) - Maximum number of points to return (1-10000)
- `from` (optional) - Start date in ISO format (e.g., `2025-01-01T00:00:00.000Z`)
- `to` (optional) - End date in ISO format (e.g., `2025-01-31T23:59:59.000Z`)

**Response:** `200 OK`

```json
[
  {
    "timestamp": "2025-01-15T10:30:00.000Z",
    "tvl": "1000.5"
  }
]
```

**Error Responses:**

- `400 Bad Request` - Invalid query parameters or date format

---

#### `GET /api/total-value-locked`

Get cumulative total of all deposits that entered the contract.

**Response:** `200 OK`

```json
{
  "totalDeposited": "5000.123"
}
```

---

## Data Types

### LeaderboardEntry

- `rank` (number) - User's position in the leaderboard
- `address` (string) - Ethereum address (0x-prefixed hex)
- `totalDeposited` (string) - Total deposited amount as Decimal string
- `totalWithdrawn` (string) - Total withdrawn amount as Decimal string
- `totalCompounded` (string) - Total compounded amount as Decimal string
- `totalCompoundCount` (number) - Number of compound operations
- `referralEarningsUnits` (string) - Referral earnings in contract units as Decimal string
- `lastActiveAt` (string | null) - ISO timestamp of last activity, or null

### UserReferral

- `referee` (string) - Ethereum address of the referred user
- `totalUnitsRewarded` (string) - Total reward units as Decimal string
- `lastRewardAt` (string | null) - ISO timestamp of last reward, or null
- `totalRewards` (number) - Total number of reward transactions
- `buyAmount` (string) - Total amount of tokens bought by referee as Decimal string

### TvlDataPoint

- `timestamp` (string) - ISO timestamp of the snapshot
- `tvl` (string) - Total value locked in ETH as Decimal string

### TotalValueLocked

- `totalDeposited` (string) - Cumulative total of all deposits as Decimal string

## Notes

- All monetary and numeric metrics (Decimal, BigInt) are serialized as strings to avoid precision loss
- Convert values to numbers/BigInt on the client as needed
- Addresses must be valid Ethereum addresses (0x-prefixed, 42 characters)
- Dates should be provided in ISO 8601 format
- The leaderboard is ordered by `totalDeposited` (descending), with address as a tie-breaker (ascending)

## Swagger UI

Interactive API documentation is available at `http://localhost:3000/docs` when the API service is running.
