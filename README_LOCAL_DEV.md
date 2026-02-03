# Local Development

## Prerequisites

1. **PostgreSQL** – running and accessible
2. **Redis** – running (required for BullMQ queues)
3. **Node.js** – version 18+
4. **Dependencies** – due to peer dependency conflicts between NestJS 11 and the current Swagger version, install with `--legacy-peer-deps`:

```bash
npm install --legacy-peer-deps
```

Without this flag `npm install` fails with `ERESOLVE`.

## Environment Variables

Ensure `.env` contains the required variables:

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

# Ports (optional)
PORT=3000  # API
# PORT=3001 for Indexer (or configure in code)
```

## Database Setup

1. Create a Prisma migration (if not created yet):
```bash
npx prisma migrate dev --name init
```

2. Generate the Prisma client:
```bash
npx prisma generate
```

## Running Services

### Option 1: Start both services (recommended)

```bash
npm run start:all
```

This starts:
- **API server** at `http://localhost:3000`
- **Indexer service** at `http://localhost:3001`

### Option 1a: Docker Compose (Postgres + Redis + apps)

1. Copy the example environment file:
   ```bash
   cp env.docker.example .env.docker
   ```
   Fill in real RPC and contract values.

2. Launch the stack:
   ```bash
   docker compose up --build
   ```

   The stack includes Postgres, Redis, a one-shot `migrate` service (`prisma migrate deploy`), plus API (`:3000`) and Indexer.

### Option 2: Separate terminals

**Terminal 1 – API:**
```bash
npm run start:api
```

**Terminal 2 – Indexer:**
```bash
npm run start:indexer
```

### Option 3: Manual start via Nest CLI

```bash
# API
npx nest start api --watch

# Indexer
npx nest start indexer --watch
```

## Verifying the Stack

### API endpoints

Once the API is running, test endpoints:

```bash
# Leaderboard
curl http://localhost:3000/api/leaderboard

# TVL Chart
curl http://localhost:3000/api/tvl-chart

# Total Value Locked
curl http://localhost:3000/api/total-value-locked
```

### Indexer

The indexer:
- Connects to the WebSocket provider
- Listens to smart-contract events
- Processes events with BullMQ
- Recovers missed events on startup

## Useful Commands

```bash
# Build project
npm run build

# Lint
npm run lint

# Tests
npm test

# Prisma Studio (database UI)
npx prisma studio
```

## Troubleshooting

### Port already in use
Change `PORT` in `.env` or adjust `main.ts`.

### Redis not connected
Ensure Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

### Database not reachable
Check the Postgres connection:
```bash
psql $POSTGRES_URI -c "SELECT 1;"
```

### Prisma migrations missing
```bash
npx prisma migrate deploy
```

