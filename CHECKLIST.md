# AI Animation Studio – Implementation Checklist

> Track progress by replacing `[ ]` with `[x]` as items are completed.

---

## Phase 0 – Project Foundation

### Monorepo Setup

- [x] Initialize monorepo (pnpm workspaces or Turborepo)
- [x] Configure shared TypeScript config (`tsconfig.base.json`)
- [x] Set up shared ESLint + Prettier config
- [x] Create `packages/shared-types` for cross-service TypeScript interfaces
- [x] Set up `packages/db` with Prisma schema
- [x] Create `docker-compose.yml` for local dev (postgres, redis, pgvector)
- [x] Configure `.env.example` with all required variables
- [x] Set up CI pipeline (GitHub Actions) – lint, test, build

### Database Setup

- [x] Install pgvector extension on PostgreSQL 16
- [x] Create Prisma schema for all entities
- [x] Write and run initial migrations
- [x] Seed script for development data
- [x] Set up PgBouncer connection pooling config

---

## Phase 1 – Core Backend Services

### API Service (NestJS 11)

#### Authentication

- [x] JWT strategy with RS256 (RSA key pair generation)
- [x] Access token (15min) + refresh token (7 days)
- [x] Refresh token rotation on every use
- [x] HttpOnly cookie for refresh token
- [x] `POST /auth/login` endpoint
- [x] `POST /auth/refresh` endpoint
- [x] `POST /auth/logout` (invalidate refresh token)
- [x] Auth guard applied to all protected routes

#### Series Module

- [x] `GET /series` – list with pagination
- [x] `POST /series` – create
- [x] `GET /series/:id` – detail
- [x] `PATCH /series/:id` – update
- [x] `DELETE /series/:id` – soft delete
- [x] Ownership validation (created_by check)

#### Sessions Module

- [x] `GET /series/:id/sessions`
- [x] `POST /series/:id/sessions`
- [x] `PATCH /sessions/:id`
- [x] `global_context` JSONB validation
- [x] pgvector embedding upsert on session create/update

#### Episodes Module

- [x] `GET /series/:id/episodes` with status filter
- [x] `POST /series/:id/episodes`
- [x] `GET /episodes/:id` with node runs
- [x] `PATCH /episodes/:id`
- [x] `DELETE /episodes/:id`
- [x] Episode status FSM validation (no invalid transitions)
- [x] `POST /episodes/:id/scripts` – upload/update script

#### Characters Module

- [x] `GET /series/:id/characters`
- [x] `POST /series/:id/characters`
- [x] `PATCH /characters/:id`
- [x] `DELETE /characters/:id`
- [x] ElevenLabs voice_id validation on create
- [x] pgvector embedding generation on save

#### Assets Module

- [x] `POST /assets/presign` – generate S3 presigned upload URL
- [x] `GET /assets` – list with type filter
- [x] `DELETE /assets/:id` – soft delete + S3 cleanup
- [x] Content-type whitelist (image/jpeg, image/png, video/mp4, audio/mpeg)
- [x] Max file size enforcement

#### Channels Module

- [x] YouTube OAuth 2.0 authorization URL generation
- [x] OAuth callback handler + token exchange
- [x] Token encryption at rest (AES-256-GCM)
- [x] Token refresh on expiry
- [x] `DELETE /channels/:id`

#### WebSocket Gateway

- [x] Socket.io integration with NestJS
- [x] Room per episode (`join:episode`)
- [x] Auth middleware for WebSocket connections
- [x] Events: `episode:status`, `node:status`, `episode:ready`, `episode:published`, `episode:error`

#### Cross-Cutting

- [x] Request validation with `class-validator` on all DTOs
- [x] Global exception filter (standardized error responses)
- [x] Rate limiting (throttler) – 100 req/min per user
- [x] CORS configured with strict origin whitelist
- [x] Request logging (Pino)
- [x] Health check endpoint `GET /health`

---

### Workflow Engine (NestJS 11)

#### DAG Core

- [x] Workflow definition parser (nodes + edges from JSON)
- [x] Cycle detection (Kahn's algorithm / DFS)
- [x] Topological sort
- [x] In-degree map construction
- [x] Root node identification

#### Execution

- [x] `POST /workflow/start` – receive workflow + episodeId → enqueue root nodes
- [x] BullMQ worker processes `workflow:node` queue
- [x] Node execution: call AI Gateway with node config + inputs
- [x] Node completion handler: update node_runs, decrement children in-degree
- [x] Unlock and enqueue ready children
- [x] Final node detection → update episode status to `ready`

#### State Management

- [x] `node_runs` record created for each node on enqueue
- [x] Idempotency check: skip if node_run.status = 'completed'
- [x] Pass outputs between nodes via node_runs.output JSONB
- [x] Failed node → update episode status to `failed` + emit WebSocket event

#### Retry & DLQ

- [x] Exponential backoff retry (3 attempts, 5s base delay)
- [x] Dead letter queue on max attempts exceeded
- [x] `POST /workflow/dlq/:jobId/replay` – manual replay
- [x] Slack alert on DLQ job arrival

#### Internal API

- [x] `POST /internal/workflow/node-complete` – called by AI Gateway on success
- [x] `POST /internal/workflow/node-failed` – called by AI Gateway on failure
- [x] mTLS or shared secret for internal service auth

---

### AI Gateway (NestJS 11)

- [x] Task router: map node_type → Celery task name
- [x] Celery task dispatch via HTTP (Flower) or direct Redis queue
- [x] Async result polling OR webhook receiver for task completion
- [x] Timeout handling per task type (image: 60s, motion: 300s, voice: 30s, render: 600s)
- [x] Circuit breaker per AI provider (fail fast after 3 consecutive errors)
- [x] Retry on transient errors (5xx, network timeout)
- [x] Forward result to Workflow Engine on completion

---

## Phase 2 – AI Workers (Python 3.12)

### Project Setup

- [x] Poetry / uv for dependency management
- [x] Celery 6 app initialization with Redis broker
- [x] Celery Beat for scheduled tasks
- [x] Flower dashboard for task monitoring
- [x] Sentry integration for Python error tracking
- [x] Structured logging (structlog)

### Image Worker (`tasks.image.generate`)

- [x] Leonardo.ai API client integration
- [x] Accept: `{ prompt, style, character_refs, width, height, lora_id? }`
- [x] Apply LoRA if `lora_id` provided
- [x] Download generated image → upload to S3
- [x] Return: `{ image_url, asset_id }`
- [x] Retry on Leonardo rate limit (429) with backoff

### Motion Worker (`tasks.motion.generate`)

- [x] OpenAI Sora API client integration
- [x] Accept: `{ image_url, motion_prompt, duration_seconds }`
- [x] Poll for completion (async generation)
- [x] Download video clip → upload to S3
- [x] Return: `{ video_url, asset_id }`
- [x] Handle long generation time (up to 5 min timeout)

### Voice Worker (`tasks.voice.synthesize`)

- [x] ElevenLabs Python SDK integration
- [x] Model: `eleven_flash_v2_5`
- [x] Cache lookup before API call: `sha256(text + voice_id + "eleven_flash_v2_5")`
- [x] On cache hit: return cached `audio_url`, `from_cache: true`
- [x] On cache miss: call ElevenLabs → upload to S3 → insert voice_cache
- [x] Return: `{ audio_url, duration_ms, from_cache }`
- [x] Handle Vietnamese language correctly (voice_id selection)

### Render Worker (`tasks.render.compose`)

- [x] FFmpeg 7 installation with GPU support (NVENC/VAAPI)
- [x] Accept: `{ scenes: [{ video_url, audio_url, duration }], subtitles_srt? }`
- [x] Download all scene clips from S3
- [x] Concatenate video clips (FFmpeg concat demuxer)
- [x] Mix audio tracks
- [x] Burn subtitles (SRT) if provided
- [x] Hardware-accelerated encode (h264_nvenc)
- [x] Generate thumbnail (frame at 10% of duration)
- [x] Upload final MP4 + thumbnail to S3
- [x] Return: `{ final_video_url, thumbnail_url }`
- [x] Cleanup temp files after completion

---

## Phase 3 – Frontend (Next.js 15)

### Project Setup

- [x] Next.js 15 App Router initialization
- [x] React 19 with concurrent features
- [ ] shadcn/ui component library setup
- [x] Tailwind CSS configuration
- [x] React Query (TanStack Query v5) for server state
- [x] Zustand for client state (DAG editor state)
- [x] Socket.io client setup with episode room subscription

### Auth Pages

- [x] Login page with form validation
- [x] Token refresh on 401 (axios interceptor)
- [x] Protected route middleware (`middleware.ts`)
- [x] Logout with cookie clearing

### Dashboard

- [x] Series list page with pagination
- [x] Series detail page (sessions + episodes list)
- [x] Episode status badges with real-time updates
- [x] Episode detail page (node run log, video preview)

### DAG Editor (React Flow 12)

- [x] React Flow canvas with custom nodes
- [x] Node palette (sidebar) for adding nodes
- [x] Drag-and-drop node placement
- [ ] Edge connection validation (type compatibility)
- [x] Node config panel (right sidebar) per node type
- [x] Workflow save (serialize to JSON → API)
- [x] Workflow load (deserialize from API → React Flow)
- [x] Run workflow button → `POST /episodes/:id/workflow/start`
- [x] Real-time node status colors (pending/running/done/failed)
- [x] Node output preview on click (image/video/audio)

#### Custom Nodes

- [x] `SceneParserNode` – script text input
- [x] `ImageGenNode` – prompt + character selector
- [x] `MotionNode` – motion prompt input
- [x] `VoiceNode` – character voice selector
- [x] `TimelineNode` – subtitle language toggle
- [x] `RenderNode` – quality settings (resolution, bitrate)
- [x] `PublishNode` – channel selector + title/description

### Character Manager

- [x] Character list per series
- [x] Create character form (name, personality, visual prompt, voice_id)
- [x] Voice preview (call ElevenLabs TTS sample)
- [x] Character edit / delete

### Asset Library

- [x] Asset browser (filterable by type)
- [ ] Drag asset into DAG node
- [x] Upload with presigned URL + progress indicator

### Channel Management

- [x] Connect YouTube channel (OAuth popup flow)
- [x] Display connected channels per series
- [x] Revoke / reconnect channel

---

## Phase 4 – Publish Pipeline

- [x] YouTube OAuth 2.0 token refresh logic
- [x] Resumable video upload (YouTube Data API v3 resumable upload)
- [x] Metadata mapping: episode title → YouTube title, synopsis → description
- [x] Upload progress tracking → WebSocket event
- [x] Store `platform_video_id` in `episode_publications`
- [x] Episode status → `public` on success
- [ ] Publish failure handling → Saga rollback (optional: delete draft video)
- [x] Retry publish on transient failure

---

## Phase 5 – Observability & Operations

### Logging

- [x] Pino structured logging in all NestJS services
- [x] structlog in Python workers
- [ ] Log correlation IDs (trace-id) across services
- [ ] Log shipping to Loki (Promtail agent)
- [ ] Grafana log dashboard

### Metrics

- [x] Prometheus metrics endpoint `GET /metrics` on each service
- [x] Custom metrics: episode duration, voice cache hit rate, queue depth
- [ ] Grafana dashboards per service
- [ ] BullMQ metrics exporter

### Tracing

- [x] OpenTelemetry SDK in NestJS services
- [ ] OpenTelemetry SDK in Python workers
- [ ] Jaeger for trace visualization
- [ ] Trace sampling: 100% errors, 10% success in production

### Alerting

- [x] Alert: DLQ depth > 0 → Slack
- [x] Alert: Episode failed rate > 5% → PagerDuty
- [x] Alert: AI provider error rate > 10% → Slack
- [x] Alert: Queue depth > 50 for > 5 minutes → Slack
- [x] Alert: GPU worker memory > 90% → auto scale

---

## Phase 6 – Infrastructure

### Docker

- [x] `Dockerfile` per service (multi-stage builds)
- [x] `.dockerignore` per service
- [x] `docker-compose.yml` for local dev with hot reload
- [x] `docker-compose.prod.yml` for production reference

### Kubernetes

- [x] Kubernetes manifests for each service deployment
- [x] ConfigMaps for non-secret env vars
- [x] Kubernetes Secrets (or external secrets operator)
- [x] HPA for API, workflow-engine, AI workers
- [x] GPU node pool configuration (tolerations + node selectors)
- [x] PodDisruptionBudgets for zero-downtime deploys
- [x] Nginx Ingress with TLS termination
- [x] Redis Cluster StatefulSet (6 nodes)
- [x] PgBouncer deployment

### CI/CD

- [x] GitHub Actions: lint + test on PR
- [x] GitHub Actions: build + push Docker images on merge to main
- [x] GitHub Actions: deploy to staging (auto)
- [x] GitHub Actions: deploy to production (manual approval)
- [x] Database migration job in pipeline

### Security

- [ ] mTLS configured between internal services
- [x] Kubernetes NetworkPolicy (restrict inter-service traffic)
- [x] AWS Secrets Manager / Vault for secret rotation
- [ ] Regular dependency vulnerability scans (Snyk / Dependabot)
- [ ] Penetration test: OWASP top 10 check before launch

---

## Phase 7 – Testing

### Unit Tests

- [x] Auth service: token generation + validation
- [x] DAG engine: cycle detection, topological sort
- [x] Voice cache: hash computation, cache hit/miss logic
- [x] Episode FSM: valid/invalid state transitions

### Integration Tests

- [ ] API endpoints: CRUD + auth flow (supertest)
- [ ] Workflow engine: enqueue + complete cycle (BullMQ test)
- [ ] Voice worker: cache hit and miss paths (mock ElevenLabs)

### E2E Tests

- [ ] Full episode pipeline: script upload → mock AI nodes → render → status = ready
- [ ] Publish flow: mock YouTube API → status = public

### Load Tests

- [ ] 10 concurrent episode runs
- [ ] BullMQ queue saturation test
- [ ] WebSocket: 100 concurrent connections, 50 active episodes

---

## Pre-Launch Checklist

### Functionality

- [ ] Full episode pipeline tested end-to-end in staging
- [ ] YouTube publish tested with real channel
- [ ] Voice cache tested (verify no duplicate ElevenLabs charges)
- [ ] DAG retry tested (simulate node failure + recovery)
- [ ] WebSocket real-time updates verified
- [ ] Multi-language (vi + en) tested for voice generation

### Performance

- [ ] Episode end-to-end time < 15 minutes (8-min episode target)
- [ ] API response time p95 < 200ms
- [ ] WebSocket message delivery < 500ms
- [ ] Render worker GPU utilization > 70% during encode

### Security

- [ ] OAuth tokens encrypted at rest (verified in DB)
- [ ] JWT secret rotated from default
- [ ] S3 bucket: no public access, only presigned URL access
- [ ] CORS: no wildcard origins
- [ ] Rate limiting tested (verify 429 on excess)
- [ ] Prompt injection guards on all AI inputs tested

### Reliability

- [ ] Redis cluster failover tested (kill primary → verify continuity)
- [ ] Database replica failover tested
- [ ] DLQ alert received when job fails max retries
- [ ] GPU worker pod OOM → K8s restart → job re-queued (not lost)

### Operations

- [ ] Runbook written: DLQ replay procedure
- [ ] Runbook written: YouTube OAuth re-authorization
- [ ] Runbook written: GPU worker scaling manual override
- [ ] Grafana dashboards reviewed and thresholds calibrated
- [ ] On-call rotation configured in PagerDuty
