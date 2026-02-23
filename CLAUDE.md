# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Monorepo (run from root)

```bash
pnpm install            # Install all dependencies
pnpm dev                # Start all services via Turborepo
pnpm build              # Build all packages and apps
pnpm lint               # Lint all workspaces
pnpm test               # Run all tests
pnpm format             # Prettier format all files
pnpm -r tsc --noEmit    # Type-check all workspaces
```

### Per-service (NestJS apps)

```bash
pnpm --filter @producer/api start:dev
pnpm --filter @producer/workflow-engine start:dev
pnpm --filter @producer/ai-gateway start:dev
pnpm --filter @producer/web dev
```

### Database (packages/db)

```bash
pnpm --filter @producer/db generate       # Regenerate Prisma client after schema changes
pnpm --filter @producer/db migrate        # Run prisma migrate dev (local)
pnpm --filter @producer/db migrate:deploy # Apply migrations in CI/production
pnpm --filter @producer/db seed           # Seed the database
pnpm --filter @producer/db studio         # Open Prisma Studio
```

### Python workers (apps/ai-workers)

```bash
# Start all queues
celery -A celery_app worker --loglevel=info -Q image,motion,voice,render

# Start individual queue
celery -A celery_app worker --loglevel=info -Q image
celery -A celery_app worker --loglevel=info -Q voice

# Run Python tests
pytest tests/
```

### Local infrastructure

```bash
docker compose up -d postgres redis       # Start only databases (fastest for dev)
docker compose up -d                      # Start all services
docker compose up -d flower               # Start Celery monitoring UI at :5555
```

### Running a single test

```bash
# NestJS (Jest)
pnpm --filter @producer/api test -- --testPathPattern=auth.service
pnpm --filter @producer/api test -- --testNamePattern="should login"

# Python
pytest tests/test_voice_cache.py -v
```

## Architecture Overview

This is a pnpm + Turborepo monorepo implementing an AI animation pipeline: **script → parse → image → motion + voice → render → YouTube publish**.

### Service Map

| Service                | Package                     | Port | Role                                    |
| ---------------------- | --------------------------- | ---- | --------------------------------------- |
| `apps/web`             | `@producer/web`             | 3000 | Next.js 15 App Router frontend          |
| `apps/api`             | `@producer/api`             | 3001 | NestJS main API (auth, CRUD, WebSocket) |
| `apps/workflow-engine` | `@producer/workflow-engine` | 3002 | DAG execution + BullMQ orchestration    |
| `apps/ai-gateway`      | `@producer/ai-gateway`      | 3003 | Routes to Celery workers via HTTP       |
| `apps/ai-workers`      | —                           | —    | Python 3.12 Celery workers              |

Shared code lives in:

- `packages/db` — Prisma schema and client (PostgreSQL 16 + pgvector)
- `packages/shared-types` — TypeScript interfaces used across all apps
- `packages/config` — Shared environment config

### Request Flow

```
User → web (3000) → api (3001) → workflow-engine (3002) → ai-gateway (3003) → Celery workers
                                                                ↑
                                         api ←─ internal webhooks ─┘
```

The API triggers workflow via `POST /episodes/:id/workflow/start`, which calls the workflow-engine. The workflow-engine enqueues jobs into BullMQ/Redis. The ai-gateway polls Flower (`:5555`) for Celery task completion and calls back to the API via internal webhooks.

### Inter-service Auth

All service-to-service HTTP calls use the `x-internal-secret` header validated against `process.env.INTERNAL_SERVICE_SECRET`. Internal webhook endpoints are `POST /internal/episode/status`, `POST /internal/node/status`, and `POST /internal/publish`.

### Key Architectural Patterns

**Episode Status FSM** (`apps/api/src/episodes/episodes.service.ts`):

```
draft → processing → rendering → ready → publishing → public
                 ↘              ↗              ↘
                          failed ←──────────────┘
failed → draft (retry)
```

Status transitions are validated via `VALID_TRANSITIONS` map; invalid transitions throw `BadRequestException`.

**DAG execution** (`apps/workflow-engine/src/dag/`):

- Kahn's algorithm for topological sort + cycle detection
- Root nodes (in-degree = 0) enqueued first; children unlock when all parents complete (fan-in)
- BullMQ jobs: 3 retries, exponential backoff (5s base), DLQ at `workflow:dlq`
- Idempotency: `node_runs(episode_id, node_id)` has a `@@unique` constraint

**Circuit breaker** (`apps/ai-gateway/src/task-router/`):

- 3 failures → open for 30 seconds before retrying AI provider calls

**Voice cache** (`apps/ai-workers/workers/voice_worker.py`):

- Cache key: `sha256(text + voice_id + "eleven_flash_v2_5")`
- Checked before any ElevenLabs API call; stored in `voice_cache` table

**Channel token encryption** (`apps/api/src/channels/`):

- YouTube OAuth tokens encrypted with AES-256-GCM before storing in `channels.config`

### Prisma Schema Critical Details

Use exact field names when querying:

- `User.refreshTokenHash` (not `refreshToken`)
- `Episode.workflow` (not `workflowJson`) — stores the ReactFlow DAG JSON
- `NodeRun.completedAt` (not `finishedAt`)
- `NodeRun.config Json?` exists on NodeRun
- NodeRun unique constraint: `@@unique([episodeId, nodeId], name: "episodeId_nodeId")`
- Soft deletes: `Series`, `Episode` have `deletedAt`; always filter with `deletedAt: null`

### Frontend (apps/web)

- **DAG editor**: `src/components/flow/DagEditor.tsx` with 7 custom ReactFlow nodes in `src/components/flow/nodes/`
- **State**: Zustand in `src/store/workflow.store.ts` (DAG state) and `src/store/auth.store.ts`
- **API client**: `src/lib/api.ts` — Axios instance with 401 auto-refresh interceptor
- **Real-time**: `src/hooks/useSocket.ts` — Socket.io joining episode rooms
- **Data fetching**: TanStack Query v5 throughout

### AI Models Used

- Scene parsing: `claude-sonnet-4-6` via `@anthropic-ai/sdk`
- Image generation: Leonardo.ai
- Motion: OpenAI Sora
- Voice synthesis: ElevenLabs `eleven_flash_v2_5`
- Render: FFmpeg 7 with `h264_nvenc` GPU encoding

### Environment Variables

All services read from a root `.env` file (passed via `env_file` in docker-compose). Key variables:

```
DATABASE_URL, REDIS_URL
JWT_SECRET, JWT_REFRESH_SECRET
INTERNAL_SERVICE_SECRET          # x-internal-secret header value
ANTHROPIC_API_KEY
LEONARDO_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY
YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, CDN_BASE_URL
OAUTH_ENCRYPTION_KEY             # AES-256 key for channel tokens
CELERY_BROKER_URL                # Redis DB 1
CELERY_RESULT_BACKEND            # Redis DB 2
```
