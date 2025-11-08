## Deployment Checklist

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

> NestJS 11 and the current `@nestjs/swagger` version have conflicting peer dependencies. The `--legacy-peer-deps` flag is required to avoid `ERESOLVE`.

### 2. Build & Test

```bash
npm run build
npm test
```

Optional extras:

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

Create a `.env` file (or host-level secrets) with:

```
POSTGRES_URI=postgresql://user:password@host:5433/db?schema=public
# (optional) DATABASE_URL=the same URI if tooling expects it

EVENTS_REDIS_URL=redis://host:port
# or REDIS_HOST / REDIS_PORT

PRIVATE_NODE_BASE_SEPOLIA_WS=wss://...
PRIVATE_NODE_BASE_SEPOLIA_HTTPS=https://...
TEST_MINER_CONTRACT=0x...

PORT=3000          # API (optional)
INDEXER_PORT=3001  # override indexer port if needed
```

### 5. Run Services

- API: `npm run start:api`
- Indexer: `npm run start:indexer`

Both services use the `ts-node` compiler, so no extra webpack dependencies are needed.

### 5a. Docker Compose Deployment

1. Copy and fill the environment file:
   ```bash
   cp env.docker.example .env.docker
   ```

2. Build and start the stack:
   ```bash
   docker compose up --build -d
   ```

   Includes `postgres`, `redis`, one-shot `migrate` (runs `prisma migrate deploy`), `api`, `indexer`.

3. Check logs:
   ```bash
   docker compose logs -f api
   docker compose logs -f indexer
   ```

### 6. Health Checks

- Swagger: `http://<host>:3000/docs`
- SSE Stream: `http://<host>:3000/events`
- Leaderboard: `GET /api/leaderboard`
- TVL Chart: `GET /api/tvl-chart`
- Weekly Compound: `GET /api/weekly-compound-ranking`

### 7. Monitoring Notes

- The indexer publishes `user:update`, `tvl:update`, `weekly-compound:update` to the Redis `events` channel. Ensure Redis is reachable and `EVENTS_REDIS_URL` is correct.
- Monitor BullMQ and Prisma logs during the initial sync (large datasets may trigger longer queries).

### 8. Optional: Docker

For standalone container builds, use the existing Dockerfile. Example plan:

1. Build image (`node:20-alpine` → `npm install --legacy-peer-deps` → `npm run build`).
2. Run API / Indexer in separate containers, wiring env vars and network dependencies.

> The repository already includes Dockerfile and docker-compose. For standalone images without compose, build via `docker build -t dapp-backend .` and run with the desired `CMD` (`node dist/apps/api/main.js` or `node dist/apps/indexer/main.js`).

---

Following these steps prepares the project for staging or production. After final verification, push to GitHub and wire up CI/CD with these commands.

