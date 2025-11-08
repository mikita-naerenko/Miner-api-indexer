# DApp Backend

Backend system for indexing blockchain events and exposing a data API.

## Project Structure

The project contains two primary services:

- **API Service** (`apps/api`) – REST API for retrieving data
- **Indexer Service** (`apps/indexer`) – Blockchain event indexer

## Quick Start

### Requirements

- Node.js 18+
- PostgreSQL
- Redis
- Environment variables set in `.env`

### Installation

```bash
npm install
```

### Database Setup

```bash
# Apply migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### Running

```bash
# Start both services
npm run start:all

# Or individually:
npm run start:api      # API on port 3000
npm run start:indexer  # Indexer on port 3001
```

## Documentation

- **[Full API reference](README_API.md)** – Detailed description of all endpoints
- **[Local development guide](README_LOCAL_DEV.md)** – Setup and run instructions
- Swagger UI: `http://localhost:3000/docs`

## API Endpoints

### Core endpoints

- `GET /api/leaderboard` – User leaderboard (supports `limit` and `offset`)
- `GET /api/leaderboard/:address` – Specific user statistics
- `GET /api/referrals/:address` – Referral details
- `GET /api/weekly-compound-ranking` – Weekly compound ranking
- `GET /api/tvl-chart` – TVL chart data

See [README_API.md](README_API.md) for the full reference.

## Architecture

### Indexer Service

- Subscribes to smart-contract events over WebSocket
- Processes events through a BullMQ queue
- Persists data in PostgreSQL via Prisma
- Recovers missed events automatically on startup

### API Service

- Exposes REST API for data access
- Uses Prisma for database operations
- Validates request payloads
- Returns responses in JSON format
- Keeps leaderboards and weekly rankings deterministic (tie-breaker by `compoundCount` and address)

## Data Serialization

- Monetary and numeric metrics (Decimal, BigInt) are serialized as strings to avoid precision loss.
- Convert values to numbers/BigInt on the client as needed.

## Testing

```bash
npm test -- apps/api/src/api.service.spec.ts # ApiService unit tests
npm test                                      # Full test run
```

Tests cover leaderboard pagination, rank calculation without loading entire tables, and weekly ranking synchronization.

## Production Notes

- Ranks are recalculated atomically with SQL window functions (`RANK()`), preventing inconsistent states.
- Leaderboard pagination keeps responses efficient even with large datasets.
- NestJS logging captures errors during rank recalculation.

## Environment Variables

Create a `.env` file with the following variables:

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

## Commands

```bash
# Development
npm run start:all        # Start both services
npm run start:api        # Start API only
npm run start:indexer    # Start indexer only

# Build
npm run build            # Build all projects

# Testing
npm test                 # Run tests
npm run test:watch       # Tests in watch mode

# Linting
npm run lint             # Lint and fix code

# Database
npx prisma studio        # Open Prisma Studio
npx prisma migrate dev   # Create and apply a migration
```

## Database Structure

Key models:

- `User` – Users with statistics
- `Referral` – Referral relations
- `ReferralReward` – Referral rewards
- `TvlSnapshot` – TVL snapshots for charts
- `WeeklyCompoundRanking` – Weekly compound ranking
- `IndexerState` – Indexer status

Schema: `libs/prisma/schema.prisma`

## License

UNLICENSED
