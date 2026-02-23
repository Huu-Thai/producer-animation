Excellent. Below is the **final standardized production architecture**, written fully in English, with clear boundaries, scalable design, and assuming **latest stable versions (2026)** of:

- **Next.js 15 (App Router)**
- **React 19**
- **NestJS 11**
- **Node.js 22 LTS**
- **BullMQ 5**
- **Redis 7**
- **PostgreSQL 16**
- **Python 3.12**
- **Celery 6**
- **FFmpeg 7**

---

# 🎬 AI Animation Studio Platform – Production Architecture

This platform enables:

- Series management
- Session (creative context) management
- Multi-episode automation
- Drag-and-drop DAG pipeline
- Character & asset reuse
- Automated publishing to YouTube
- Scalable GPU-based AI generation

---

# 1️⃣ High-Level Architecture

```
┌──────────────────────────────┐
│         Frontend             │
│  Next.js 15 + React Flow     │
└──────────────┬───────────────┘
               │ REST / WebSocket
┌──────────────▼───────────────┐
│         API Service          │
│       NestJS 11              │
└──────────────┬───────────────┘
               │
        ┌──────▼─────────┐
        │ Workflow Engine│
        │  (NestJS)      │
        └──────┬─────────┘
               │ BullMQ 5
         Redis 7 Cluster
               │
 ┌─────────────▼─────────────────────┐
 │        AI Gateway Service         │
 │    (HTTP bridge → Celery 6)       │
 └─────────────┬─────────────────────┘
               │
     Celery Workers (Python 3.12)
      ├── Image (Leonardo.ai)
      ├── Motion (Sora / Runway / Veo)
      ├── Voice (ElevenLabs)
      └── Render (FFmpeg 7)
               │
         Object Storage (S3)
               │
        CDN Distribution
```

---

# 2️⃣ Core Domain Model

---

## 🎞 Series

Represents an intellectual property (IP).

```sql
series (
  id uuid primary key,
  name varchar(255) not null,
  description text,
  genre varchar(100),
  art_style varchar(100),
  default_language varchar(5), -- 'vi' | 'en'
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz
);
```

---

## 🧠 Sessions (Creative Context)

Represents creative context per season, theme, or variation.

```sql
sessions (
  id uuid primary key,
  series_id uuid references series(id) on delete cascade,
  name varchar(255),
  global_context jsonb,
  memory_summary text,
  embedding vector(1536),
  created_at timestamptz default now()
);
```

---

## 🎬 Episodes

```sql
episodes (
  id uuid primary key,
  series_id uuid references series(id),
  session_id uuid references sessions(id),
  title varchar(255),
  synopsis text,
  language varchar(5), -- vi | en
  duration_target int, -- seconds
  status varchar(20),
  workflow_version int,
  final_video_url text,
  thumbnail_url text,
  created_at timestamptz default now()
);
```

---

### Episode Status (Standardized)

```ts
enum EpisodeStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  RENDERING = 'rendering',
  READY = 'ready', // Final video completed
  PUBLISHING = 'publishing',
  PUBLIC = 'public', // Successfully published
  FAILED = 'failed',
}
```

---

## 📝 Scripts (User-Created)

Supports Vietnamese & English.

```sql
scripts (
  id uuid primary key,
  episode_id uuid references episodes(id) on delete cascade,
  raw_script text not null,
  parsed_json jsonb,
  language varchar(5),
  version int default 1,
  created_at timestamptz default now()
);
```

---

## 🎭 Characters

Voice integration via ElevenLabs.

```sql
characters (
  id uuid primary key,
  series_id uuid references series(id),
  name varchar(255),
  personality_prompt text,
  visual_prompt text,
  voice_id varchar(255), -- ElevenLabs voice ID
  embedding vector(1536),
  created_at timestamptz default now()
);
```

---

## 🗂 Assets

```sql
assets (
  id uuid primary key,
  type varchar(50), -- image | bg | music | sfx | lora
  storage_key text,
  metadata jsonb,
  reusable boolean default true,
  created_at timestamptz default now()
);
```

---

## 📡 Channels (Publishing Platforms)

Supports:

- YouTube

```sql
channels (
  id uuid primary key,
  series_id uuid references series(id),
  platform varchar(50), -- youtube
  name varchar(255),
  config jsonb, -- encrypted OAuth config
  created_at timestamptz default now()
);
```

---

## 📺 Episode Publications

```sql
episode_publications (
  id uuid primary key,
  episode_id uuid references episodes(id),
  channel_id uuid references channels(id),
  platform_video_id varchar(255),
  status varchar(20),
  published_at timestamptz,
  metadata jsonb
);
```

---

## 🔊 Voice Cache (Critical Optimization)

Prevents duplicate generation.

```sql
voice_cache (
  id uuid primary key,
  voice_id varchar(255),
  text_hash varchar(64),
  audio_url text,
  created_at timestamptz default now(),
  unique (voice_id, text_hash)
);
```

Hash formula:

```
sha256(text + voice_id + model_version)
```

Voice model:

- ElevenLabs
  Model: `eleven_flash_v2_5`

---

# 3️⃣ React Flow Node System (Standardized)

Frontend:

- Next.js 15
- React 19
- React Flow 12+

---

## Supported Node Types

### 1. Scene Parser Node

Input: raw script
Output: structured scenes

---

### 2. Image Generation Node

Provider:

- Leonardo.ai

---

### 3. Motion Node

Providers:

- OpenAI (Sora)

---

### 4. Voice Node

Provider:

- ElevenLabs

Includes:

- Cache lookup
- Retry safe

---

### 5. Timeline Assembly Node

- Sync audio
- Generate subtitles (SRT/VTT)

---

### 6. Render Node

Uses:

- FFmpeg 7 (GPU accelerated)

---

### 7. Publish Node

YouTube Data API v3:

```
videos.insert
```

---

# 4️⃣ DAG Execution Engine (NestJS 11)

---

## Responsibilities

- DAG validation
- Cycle detection
- Topological sorting
- Node dependency resolution
- Retry & idempotency
- Unlock downstream nodes

---

## Execution Flow

1. Validate workflow
2. Persist node runs
3. Enqueue root nodes
4. Execute node
5. Mark completed
6. Unlock children
7. If final node → update episode status

---

## Idempotency Rule

Each node run:

```
unique(episode_id, node_id)
```

If already completed → skip execution.

---

# 5️⃣ Microservices Architecture

---

## Services

### 1️⃣ API Service (NestJS 11)

- Authentication
- Series management
- Episode management
- Channel management

---

### 2️⃣ Workflow Engine

- DAG executor
- Node state tracking
- BullMQ orchestration

---

### 3️⃣ AI Gateway

- HTTP bridge to Celery
- Task routing

---

### 4️⃣ AI Workers (Celery 6)

- Image worker
- Motion worker
- Voice worker
- Render worker

---

### 5️⃣ Publish Service

Handles YouTube OAuth & uploads.

---

### 6️⃣ Asset Service

- S3
- CDN
- Signed URLs

---

# 6️⃣ Episode End-to-End Simulation

---

### Step 1 – Script Uploaded

Status → `processing`

---

### Step 2 – Scene Parsing

---

### Step 3 – Image Generation (Leonardo)

---

### Step 4 – Motion Generation (Sora / Runway / Veo)

---

### Step 5 – Voice Generation (with cache check)

---

### Step 6 – Timeline Assembly

---

### Step 7 – Render (FFmpeg 7 GPU)

Status → `ready`

---

### Step 8 – Publish to YouTube

Status → `public`

---

# 7️⃣ Production Scaling Strategy

---

## Horizontal Scaling

- Redis cluster for BullMQ
- Separate Celery GPU clusters
- K8s auto-scaling

---

## Observability

- OpenTelemetry
- Prometheus
- Grafana

---

## Fault Tolerance

- Node-level retries
- Dead-letter queue
- Saga pattern for publish rollback

---

# Final Result

You now have a fully standardized, production-grade:

- AI animation generation engine
- DAG workflow platform
- Character-aware content system
- Multi-language support (VI / EN)
- Auto-publishing video distribution system
- Horizontally scalable GPU architecture

---

If you want next, I can:

- Provide a **complete folder structure for monorepo setup**
- Design a **Kubernetes deployment architecture**
- Calculate **cost per 8-minute episode**
- Or design a **multi-tenant SaaS version** of this system 🚀
