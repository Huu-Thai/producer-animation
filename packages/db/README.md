# @producer/db

Prisma schema and migrations for the Producer Animation platform.

## Requirements

- PostgreSQL 16 with `pgvector` and `pgcrypto` extensions
- Node.js 20+
- pnpm

## Setup

```bash
# 1. Set DATABASE_URL in your environment
export DATABASE_URL="postgresql://producer:producer@localhost:5432/producer_animation"

# 2. Generate Prisma client
pnpm generate

# 3. Run migrations (development – creates DB + applies all pending migrations)
pnpm migrate

# 4. Seed development data
pnpm seed
```

## Commands

| Command               | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `pnpm generate`       | Re-generate Prisma Client after schema changes                           |
| `pnpm migrate`        | `prisma migrate dev` – apply pending migrations + regenerate client      |
| `pnpm migrate:deploy` | `prisma migrate deploy` – apply migrations in CI/production (no prompts) |
| `pnpm seed`           | Insert seed data (admin user, demo series, characters)                   |
| `pnpm studio`         | Open Prisma Studio GUI                                                   |

## Creating a new migration

```bash
# After editing schema.prisma:
pnpm migrate --name describe_your_change
```

Prisma will diff the schema against the last migration and generate the SQL automatically.

## Production deploy

```bash
# Run in CI/CD pipeline before starting services:
DATABASE_URL=$DATABASE_URL pnpm migrate:deploy
```

The `migrate:deploy` command is idempotent – it only applies migrations that have not yet been applied.

## Extensions

The migration enables two PostgreSQL extensions:

- **pgvector** – stores 1536-dimension embeddings on `sessions.embedding` and `characters.embedding` for semantic similarity search
- **pgcrypto** – provides `gen_random_uuid()` used as the default primary key generator

## IVFFlat indexes

Vector columns use IVFFlat indexes (`lists = 100`) for approximate nearest-neighbour search.
These indexes require data to be loaded before they become efficient — run `ANALYZE` after bulk inserts.
