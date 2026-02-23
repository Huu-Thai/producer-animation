# AI Animation Studio Platform – Comprehensive Architecture

> **Tech Stack (2026 Stable)**
> Next.js 15 · React 19 · NestJS 11 · Node.js 22 LTS · BullMQ 5 · Redis 7 · PostgreSQL 16 · Python 3.12 · Celery 6 · FFmpeg 7

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Domain Model](#4-domain-model)
5. [Service Architecture](#5-service-architecture)
6. [React Flow DAG System](#6-react-flow-dag-system)
7. [DAG Execution Engine](#7-dag-execution-engine)
8. [AI Worker Pipeline](#8-ai-worker-pipeline)
9. [Data Flow – Episode End-to-End](#9-data-flow--episode-end-to-end)
10. [API Design](#10-api-design)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Observability](#12-observability)
13. [Security](#13-security)
14. [Scaling Strategy](#14-scaling-strategy)

---

## 1. System Overview

The AI Animation Studio Platform is a production-grade system that automates the creation and publishing of AI-generated animated video episodes. It supports:

- **Series & Session Management** – IP hierarchy with creative context memory
- **Multi-Episode Automation** – Script → render → publish pipeline
- **Visual DAG Builder** – Drag-and-drop React Flow workflow editor
- **Character & Asset Reuse** – Persistent embeddings and LoRA model registry
- **Multi-Language** – Vietnamese (vi) and English (en)
- **Auto-Publishing** – YouTube Data API v3 OAuth flow
- **GPU-Scalable AI** – Celery workers for Image / Motion / Voice / Render

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│                     FRONTEND                         │
│         Next.js 15 (App Router) + React 19           │
│         React Flow 12+ (DAG Builder)                 │
└────────────────────────┬─────────────────────────────┘
                         │ REST / WebSocket (Socket.io)
┌────────────────────────▼─────────────────────────────┐
│                   API SERVICE                        │
│               NestJS 11 (Port 3001)                  │
│  Auth · Series · Episodes · Channels · Assets        │
└───────┬──────────────────────────────────────────────┘
        │
┌───────▼─────────────────────┐
│      WORKFLOW ENGINE         │
│   NestJS 11 (Port 3002)      │
│  DAG Executor · BullMQ 5     │
└───────┬─────────────────────┘
        │ Queue: workflow:*
┌───────▼──────────────────────────────┐
│          Redis 7 Cluster             │
│  Queues · Locks · Cache · PubSub     │
└───────┬──────────────────────────────┘
        │ Queue: ai:*
┌───────▼──────────────────────────────┐
│         AI GATEWAY SERVICE           │
│     NestJS 11 (Port 3003)            │
│   HTTP Bridge → Celery Task Router   │
└───────┬──────────────────────────────┘
        │ HTTP / Celery Beat
┌───────▼──────────────────────────────────────────────┐
│              CELERY WORKERS (Python 3.12)             │
│  image-worker   │ motion-worker │ voice-worker        │
│  (Leonardo.ai)  │ (Sora)        │ (ElevenLabs)        │
│                 │ render-worker (FFmpeg 7 GPU)         │
└───────┬──────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────┐
│     Object Storage (AWS S3 / R2)     │
│     CDN (CloudFront / Cloudflare)    │
└──────────────────────────────────────┘
        │
┌───────▼──────────────────────────────┐
│       PUBLISH SERVICE                │
│   YouTube Data API v3 OAuth          │
└──────────────────────────────────────┘
```

---

## 3. Monorepo Structure

```
producer-animation/
├── apps/
│   ├── web/                        # Next.js 15 frontend
│   │   ├── app/                    # App Router pages
│   │   │   ├── (dashboard)/
│   │   │   │   ├── series/
│   │   │   │   ├── episodes/
│   │   │   │   └── workflow/
│   │   │   └── api/                # Next.js route handlers (BFF)
│   │   ├── components/
│   │   │   ├── flow/               # React Flow nodes & edges
│   │   │   └── ui/                 # shadcn/ui components
│   │   └── lib/
│   │
│   ├── api/                        # NestJS API Service (Port 3001)
│   │   └── src/
│   │       ├── auth/
│   │       ├── series/
│   │       ├── episodes/
│   │       ├── channels/
│   │       └── assets/
│   │
│   ├── workflow-engine/            # NestJS Workflow Engine (Port 3002)
│   │   └── src/
│   │       ├── dag/
│   │       ├── queues/
│   │       └── node-runners/
│   │
│   ├── ai-gateway/                 # NestJS AI Gateway (Port 3003)
│   │   └── src/
│   │       ├── bridge/
│   │       └── task-router/
│   │
│   └── ai-workers/                 # Python 3.12 Celery workers
│       ├── workers/
│       │   ├── image_worker.py
│       │   ├── motion_worker.py
│       │   ├── voice_worker.py
│       │   └── render_worker.py
│       └── tasks/
│
├── packages/
│   ├── shared-types/               # TypeScript types shared across apps
│   ├── db/                         # Prisma schema + migrations
│   └── config/                     # Shared env config
│
├── infra/
│   ├── k8s/                        # Kubernetes manifests
│   ├── docker/                     # Dockerfiles per service
│   └── terraform/                  # Cloud infrastructure
│
└── docker-compose.yml              # Local development
```

---

## 4. Domain Model

### 4.1 Entity Relationship

```
Series (IP)
  └── Sessions (Creative context / season)
       └── Episodes
            ├── Scripts
            ├── Node Runs (DAG execution state)
            └── Episode Publications
                 └── Channels (YouTube)

Characters (linked to Series)
Assets (global, reusable)
Voice Cache (deduplication)
```

### 4.2 Database Schema (PostgreSQL 16)

#### Series

```sql
CREATE TABLE series (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  genre           VARCHAR(100),
  art_style       VARCHAR(100),
  default_language VARCHAR(5) NOT NULL DEFAULT 'en', -- 'vi' | 'en'
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);
```

#### Sessions

```sql
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id       UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name            VARCHAR(255),
  global_context  JSONB,            -- style guidelines, world rules
  memory_summary  TEXT,             -- LLM-compressed episode summaries
  embedding       VECTOR(1536),     -- pgvector for semantic search
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### Episodes

```sql
CREATE TABLE episodes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id        UUID NOT NULL REFERENCES series(id),
  session_id       UUID REFERENCES sessions(id),
  title            VARCHAR(255),
  synopsis         TEXT,
  language         VARCHAR(5) NOT NULL DEFAULT 'en',
  duration_target  INT,             -- seconds
  status           VARCHAR(20) NOT NULL DEFAULT 'draft',
  workflow_version INT DEFAULT 1,
  final_video_url  TEXT,
  thumbnail_url    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ,

  CONSTRAINT episodes_status_check
    CHECK (status IN ('draft','processing','rendering','ready','publishing','public','failed'))
);
```

#### Episode Status FSM

```
draft → processing → rendering → ready → publishing → public
                                               ↓ (on error)
                                            failed
```

#### Scripts

```sql
CREATE TABLE scripts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id  UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  raw_script  TEXT NOT NULL,
  parsed_json JSONB,               -- structured scenes after parsing
  language    VARCHAR(5),
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Characters

```sql
CREATE TABLE characters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id          UUID NOT NULL REFERENCES series(id),
  name               VARCHAR(255) NOT NULL,
  personality_prompt TEXT,
  visual_prompt      TEXT,
  voice_id           VARCHAR(255),   -- ElevenLabs voice ID
  embedding          VECTOR(1536),   -- for semantic character search
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

#### Assets

```sql
CREATE TABLE assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(50) NOT NULL,  -- image | bg | music | sfx | lora
  storage_key TEXT NOT NULL,
  metadata    JSONB,
  reusable    BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Channels

```sql
CREATE TABLE channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id   UUID NOT NULL REFERENCES series(id),
  platform    VARCHAR(50) NOT NULL DEFAULT 'youtube',
  name        VARCHAR(255),
  config      JSONB NOT NULL,    -- AES-256 encrypted OAuth tokens
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Episode Publications

```sql
CREATE TABLE episode_publications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id        UUID NOT NULL REFERENCES episodes(id),
  channel_id        UUID NOT NULL REFERENCES channels(id),
  platform_video_id VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  published_at      TIMESTAMPTZ,
  metadata          JSONB
);
```

#### Voice Cache

```sql
CREATE TABLE voice_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id    VARCHAR(255) NOT NULL,
  text_hash   VARCHAR(64) NOT NULL,   -- sha256(text + voice_id + model_version)
  audio_url   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (voice_id, text_hash)
);
```

#### Node Runs (DAG Execution State)

```sql
CREATE TABLE node_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id  UUID NOT NULL REFERENCES episodes(id),
  node_id     VARCHAR(255) NOT NULL,  -- React Flow node ID
  node_type   VARCHAR(50) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  input       JSONB,
  output      JSONB,
  error       TEXT,
  attempts    INT DEFAULT 0,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (episode_id, node_id)         -- idempotency key
);
```

---

## 5. Service Architecture

### 5.1 API Service (NestJS 11, Port 3001)

**Responsibilities:**

- JWT authentication (access + refresh tokens)
- CRUD for Series, Sessions, Episodes, Characters, Assets, Channels
- WebSocket gateway for real-time episode status updates
- File upload presigned URLs

**Key Modules:**

```
AuthModule       → JWT, refresh token rotation
SeriesModule     → series + sessions CRUD
EpisodeModule    → episode + script CRUD, status tracking
CharacterModule  → character management + embedding upsert
AssetModule      → asset registry + S3 presigned URLs
ChannelModule    → OAuth flow + token encryption
WebSocketModule  → Socket.io rooms per episode
```

### 5.2 Workflow Engine (NestJS 11, Port 3002)

**Responsibilities:**

- Receive workflow definition (DAG JSON from frontend)
- Validate graph: cycle detection, required inputs
- Topological sort → determine execution order
- Enqueue root nodes into BullMQ
- Track node completion → unlock downstream nodes
- Update episode status at end of pipeline

**Queue Design:**

```
workflow:node:{episodeId}     → node execution jobs
workflow:retry:{episodeId}    → retry queue (exponential backoff)
workflow:dlq                  → dead letter queue
```

### 5.3 AI Gateway Service (NestJS 11, Port 3003)

**Responsibilities:**

- Receive node execution requests from Workflow Engine
- Route to the correct Celery task via HTTP (Flower API) or direct queue
- Poll for completion / receive webhook callback
- Return result to Workflow Engine

**Routing Table:**

```
node_type: scene_parser   → internal NestJS handler (Claude API)
node_type: image          → celery: tasks.image.generate
node_type: motion         → celery: tasks.motion.generate
node_type: voice          → celery: tasks.voice.synthesize (cache check first)
node_type: render         → celery: tasks.render.compose
node_type: publish        → publish-service HTTP call
```

### 5.4 AI Workers (Python 3.12 + Celery 6)

**Image Worker** (`tasks.image.generate`)

- Provider: Leonardo.ai
- Input: `{ prompt, style, character_refs, width, height, lora_id? }`
- Output: `{ image_url, asset_id }`

**Motion Worker** (`tasks.motion.generate`)

- Provider: OpenAI Sora
- Input: `{ image_url, motion_prompt, duration_seconds }`
- Output: `{ video_url, asset_id }`

**Voice Worker** (`tasks.voice.synthesize`)

- Provider: ElevenLabs (`eleven_flash_v2_5`)
- Cache check: `sha256(text + voice_id + model_version)` → voice_cache table
- Input: `{ text, voice_id, language }`
- Output: `{ audio_url, duration_ms, from_cache: bool }`

**Render Worker** (`tasks.render.compose`)

- Tool: FFmpeg 7 (GPU-accelerated via NVENC/VAAPI)
- Input: `{ scenes: [{ video_url, audio_url, duration }], subtitles_srt }`
- Output: `{ final_video_url, thumbnail_url }`

### 5.5 Publish Service (NestJS module or standalone)

- YouTube OAuth 2.0 token refresh
- `videos.insert` with resumable upload
- Update `episode_publications` on success/failure
- Emit WebSocket event on completion

### 5.6 Asset Service

- S3 presigned URL generation (15-minute TTL)
- CloudFront/Cloudflare CDN signed URLs for delivery
- Asset deduplication by content hash

---

## 6. React Flow DAG System

### 6.1 Node Types

| Node              | Input                       | Output              | Provider    |
| ----------------- | --------------------------- | ------------------- | ----------- |
| `SceneParserNode` | raw script text             | `Scene[]` JSON      | Claude API  |
| `ImageGenNode`    | scene desc + character refs | image URL           | Leonardo.ai |
| `MotionNode`      | image URL + motion prompt   | video clip URL      | Sora        |
| `VoiceNode`       | scene dialogue + voice_id   | audio URL           | ElevenLabs  |
| `TimelineNode`    | scenes + audio clips        | timeline JSON + SRT | internal    |
| `RenderNode`      | timeline JSON               | final MP4 URL       | FFmpeg 7    |
| `PublishNode`     | final MP4 + metadata        | YouTube video ID    | YouTube API |

### 6.2 Edge Rules

- `SceneParserNode` → `ImageGenNode` (parallel per scene)
- `SceneParserNode` → `VoiceNode` (parallel per scene)
- `ImageGenNode` → `MotionNode`
- `[MotionNode[], VoiceNode[]]` → `TimelineNode` (fan-in)
- `TimelineNode` → `RenderNode`
- `RenderNode` → `PublishNode`

### 6.3 Workflow Definition Schema (stored in DB or JSON)

```typescript
interface WorkflowDefinition {
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>; // node-specific config
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}
```

---

## 7. DAG Execution Engine

### 7.1 Algorithm

```
function executeDAG(workflowDef, episodeId):
  1. Parse nodes and edges
  2. Build adjacency list + in-degree map
  3. Validate: no cycles (Kahn's algorithm)
  4. Find root nodes (in-degree = 0)
  5. Enqueue root nodes → BullMQ
  6. For each completed node:
     a. Update node_runs status = 'completed'
     b. Decrement in-degree of children
     c. Enqueue children with in-degree = 0
  7. On all nodes completed → set episode status = 'ready'
  8. On any node failed → set episode status = 'failed'
```

### 7.2 Idempotency

```
node_runs(episode_id, node_id) UNIQUE constraint
→ On re-enqueue: check if status = 'completed' → skip
→ On restart: only re-run 'failed' or 'pending' nodes
```

### 7.3 Retry Policy

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: false,
  removeOnFail: false,
}
```

### 7.4 Dead Letter Queue

Failed jobs after max attempts → `workflow:dlq` queue
→ Alert via Slack webhook
→ Manual replay endpoint: `POST /workflow/dlq/:jobId/replay`

---

## 8. AI Worker Pipeline

### 8.1 Voice Cache Flow

```
VoiceNode triggered
  │
  ├─ Compute hash = sha256(text + voice_id + "eleven_flash_v2_5")
  ├─ Query voice_cache WHERE voice_id = ? AND text_hash = ?
  │
  ├─ HIT  → return cached audio_url (skip ElevenLabs call)
  └─ MISS → call ElevenLabs API
              → upload audio to S3
              → INSERT into voice_cache
              → return audio_url
```

### 8.2 FFmpeg 7 Render Command (example)

```bash
ffmpeg -hwaccel cuda \
  -i concat_videos.txt \
  -i mixed_audio.wav \
  -vf "subtitles=subs.srt:force_style='Fontsize=24'" \
  -c:v h264_nvenc -preset p4 -cq 23 \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  output.mp4
```

---

## 9. Data Flow – Episode End-to-End

```
1. User uploads script
   → POST /episodes/:id/scripts
   → Episode status: draft → processing

2. Scene Parser Node runs
   → Claude API parses raw script
   → Returns structured Scene[] JSON
   → Stored in scripts.parsed_json

3. Image Generation (parallel per scene)
   → Celery image worker → Leonardo.ai
   → Images stored in S3

4. Motion Generation (parallel per scene)
   → Celery motion worker → Sora
   → Video clips stored in S3

5. Voice Generation (parallel per scene)
   → Cache check first
   → Celery voice worker → ElevenLabs
   → Audio stored in S3

6. Timeline Assembly
   → Merge scenes + audio + compute subtitle timing
   → Generate SRT/VTT

7. Render (FFmpeg 7 GPU)
   → Compose final MP4
   → Generate thumbnail
   → Episode status: rendering → ready

8. Publish to YouTube
   → OAuth token refresh
   → videos.insert (resumable upload)
   → Store youtube_video_id
   → Episode status: ready → publishing → public

9. WebSocket events emitted at each step
   → Frontend updates UI in real time
```

---

## 10. API Design

### 10.1 REST Endpoints

```
# Auth
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

# Series
GET    /series
POST   /series
GET    /series/:id
PATCH  /series/:id
DELETE /series/:id

# Sessions
GET    /series/:id/sessions
POST   /series/:id/sessions
PATCH  /sessions/:id

# Episodes
GET    /series/:id/episodes
POST   /series/:id/episodes
GET    /episodes/:id
PATCH  /episodes/:id
DELETE /episodes/:id
POST   /episodes/:id/scripts
POST   /episodes/:id/workflow/start
POST   /episodes/:id/workflow/retry
GET    /episodes/:id/node-runs

# Characters
GET    /series/:id/characters
POST   /series/:id/characters
PATCH  /characters/:id

# Channels
GET    /series/:id/channels
POST   /series/:id/channels/youtube/oauth
GET    /series/:id/channels/youtube/callback
DELETE /channels/:id

# Assets
GET    /assets
POST   /assets/presign
DELETE /assets/:id

# Workflow Engine (internal)
POST   /internal/workflow/node-complete
POST   /internal/workflow/node-failed
POST   /workflow/dlq/:jobId/replay
```

### 10.2 WebSocket Events

```typescript
// Client subscribes
socket.emit('join:episode', { episodeId })

// Server emits
'episode:status'   { episodeId, status }
'node:status'      { episodeId, nodeId, status, output? }
'episode:ready'    { episodeId, finalVideoUrl, thumbnailUrl }
'episode:published'{ episodeId, platformVideoId }
'episode:error'    { episodeId, nodeId, error }
```

---

## 11. Infrastructure & Deployment

### 11.1 Docker Compose (Local Dev)

```yaml
services:
  postgres:    image: pgvector/pgvector:pg16
  redis:       image: redis:7-alpine
  api:         build: ./apps/api
  workflow:    build: ./apps/workflow-engine
  ai-gateway:  build: ./apps/ai-gateway
  ai-workers:  build: ./apps/ai-workers
  web:         build: ./apps/web
```

### 11.2 Kubernetes (Production)

```
Namespaces:
  production/
    Deployments:
      - api             (replicas: 3, HPA: cpu>60%)
      - workflow-engine (replicas: 2, HPA: queue depth)
      - ai-gateway      (replicas: 2)
      - ai-workers-image  (replicas: 2-10, GPU nodes)
      - ai-workers-motion (replicas: 2-10, GPU nodes)
      - ai-workers-voice  (replicas: 2-5, CPU nodes)
      - ai-workers-render (replicas: 2-10, GPU nodes)
      - web             (replicas: 2)
    StatefulSets:
      - redis-cluster   (6 nodes: 3 primary + 3 replica)
    Services + Ingress (nginx)
    HPA (Horizontal Pod Autoscaler)
    PodDisruptionBudgets
```

### 11.3 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://cluster:6379

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AI Providers
LEONARDO_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=

# YouTube OAuth
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=
CDN_BASE_URL=

# Encryption
OAUTH_ENCRYPTION_KEY=   # AES-256 key for channel.config
```

---

## 12. Observability

### 12.1 Stack

- **Tracing:** OpenTelemetry → Jaeger
- **Metrics:** Prometheus + Grafana dashboards
- **Logging:** Pino (structured JSON) → Loki → Grafana
- **Alerting:** Grafana Alert rules → Slack/PagerDuty

### 12.2 Key Metrics

| Metric                                | Description             |
| ------------------------------------- | ----------------------- |
| `episode_processing_duration_seconds` | End-to-end episode time |
| `node_execution_duration_seconds`     | Per node type           |
| `bullmq_queue_depth`                  | Per queue               |
| `voice_cache_hit_rate`                | Cache efficiency        |
| `ai_api_error_rate`                   | Per provider            |
| `render_gpu_utilization`              | FFmpeg GPU usage        |

---

## 13. Security

- **Auth:** JWT RS256, refresh token rotation, httpOnly cookies
- **OAuth Tokens:** AES-256-GCM encryption at rest in `channels.config`
- **File Uploads:** Presigned S3 URLs (15-min TTL), type + size validation
- **API:** Rate limiting (throttler), request validation (class-validator)
- **Internal Services:** mTLS between NestJS services
- **Secrets:** Kubernetes Secrets + AWS Secrets Manager
- **CORS:** Strict origin whitelist
- **Input Sanitization:** Prompt injection guard on all AI inputs

---

## 14. Scaling Strategy

### GPU Worker Scaling

```
Trigger: BullMQ queue depth > 5 jobs
Scale up:  +2 GPU worker pods (max: 20)
Scale down: queue depth < 1 for 5 min → –1 pod
```

### Redis Cluster

- 6-node cluster (3 primary, 3 replica)
- BullMQ uses cluster-compatible client

### Database

- PostgreSQL primary + 1 read replica
- pgvector for character/session embedding search
- Connection pooling via PgBouncer

### Fault Tolerance

- Node-level retries (3x exponential backoff)
- Dead-letter queue for manual inspection
- Saga pattern for publish rollback (delete YouTube video on failure)
- Circuit breaker on AI provider calls
