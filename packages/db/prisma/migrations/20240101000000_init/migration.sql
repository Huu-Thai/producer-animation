-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable: users
CREATE TABLE "users" (
    "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    "email"              TEXT        NOT NULL,
    "password_hash"      TEXT        NOT NULL,
    "name"               TEXT,
    "refresh_token_hash" TEXT,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: users_email_unique
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable: series
CREATE TABLE "series" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"             VARCHAR(255) NOT NULL,
    "description"      TEXT,
    "genre"            VARCHAR(100),
    "art_style"        VARCHAR(100),
    "default_language" VARCHAR(5)   NOT NULL DEFAULT 'en',
    "created_by"       UUID         NOT NULL,
    "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"       TIMESTAMPTZ,
    "deleted_at"       TIMESTAMPTZ,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: series.created_by → users.id
ALTER TABLE "series" ADD CONSTRAINT "series_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: sessions
CREATE TABLE "sessions" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "series_id"      UUID         NOT NULL,
    "name"           VARCHAR(255),
    "global_context" JSONB,
    "memory_summary" TEXT,
    "embedding"      vector(1536),
    "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: sessions.series_id → series.id
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: sessions embedding IVFFlat index for cosine similarity search
CREATE INDEX "sessions_embedding_idx" ON "sessions"
    USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- CreateTable: episodes
CREATE TABLE "episodes" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "series_id"        UUID        NOT NULL,
    "session_id"       UUID,
    "title"            VARCHAR(255),
    "synopsis"         TEXT,
    "language"         VARCHAR(5)  NOT NULL DEFAULT 'en',
    "duration_target"  INTEGER,
    "status"           VARCHAR(20) NOT NULL DEFAULT 'draft',
    "workflow_version" INTEGER     NOT NULL DEFAULT 1,
    "workflow"         JSONB,
    "final_video_url"  TEXT,
    "thumbnail_url"    TEXT,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"       TIMESTAMPTZ,
    "deleted_at"       TIMESTAMPTZ,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: episodes.series_id → series.id
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: episodes.session_id → sessions.id
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: episodes status index for FSM queries
CREATE INDEX "episodes_status_idx" ON "episodes"("status");
CREATE INDEX "episodes_series_id_idx" ON "episodes"("series_id");

-- CreateTable: scripts
CREATE TABLE "scripts" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "episode_id"  UUID        NOT NULL,
    "raw_script"  TEXT        NOT NULL,
    "parsed_json" JSONB,
    "language"    VARCHAR(5),
    "version"     INTEGER     NOT NULL DEFAULT 1,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: scripts.episode_id → episodes.id
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_episode_id_fkey"
    FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: characters
CREATE TABLE "characters" (
    "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    "series_id"          UUID         NOT NULL,
    "name"               VARCHAR(255) NOT NULL,
    "personality_prompt" TEXT,
    "visual_prompt"      TEXT,
    "voice_id"           VARCHAR(255),
    "embedding"          vector(1536),
    "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"         TIMESTAMPTZ,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: characters.series_id → series.id
ALTER TABLE "characters" ADD CONSTRAINT "characters_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex: characters embedding IVFFlat index
CREATE INDEX "characters_embedding_idx" ON "characters"
    USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- CreateTable: assets
CREATE TABLE "assets" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "type"        VARCHAR(50) NOT NULL,
    "storage_key" TEXT        NOT NULL,
    "metadata"    JSONB,
    "reusable"    BOOLEAN     NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at"  TIMESTAMPTZ,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: series_assets (join table)
CREATE TABLE "series_assets" (
    "series_id"  UUID        NOT NULL,
    "asset_id"   UUID        NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "series_assets_pkey" PRIMARY KEY ("series_id","asset_id")
);

-- AddForeignKey: series_assets.series_id → series.id
ALTER TABLE "series_assets" ADD CONSTRAINT "series_assets_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: series_assets.asset_id → assets.id
ALTER TABLE "series_assets" ADD CONSTRAINT "series_assets_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: channels
CREATE TABLE "channels" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "series_id"  UUID        NOT NULL,
    "platform"   VARCHAR(50) NOT NULL DEFAULT 'youtube',
    "name"       VARCHAR(255),
    "config"     JSONB       NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: channels.series_id → series.id
ALTER TABLE "channels" ADD CONSTRAINT "channels_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: episode_publications
CREATE TABLE "episode_publications" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "episode_id"        UUID        NOT NULL,
    "channel_id"        UUID        NOT NULL,
    "platform_video_id" VARCHAR(255),
    "status"            VARCHAR(20) NOT NULL DEFAULT 'pending',
    "published_at"      TIMESTAMPTZ,
    "metadata"          JSONB,

    CONSTRAINT "episode_publications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: episode_publications.episode_id → episodes.id
ALTER TABLE "episode_publications" ADD CONSTRAINT "episode_publications_episode_id_fkey"
    FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: episode_publications.channel_id → channels.id
ALTER TABLE "episode_publications" ADD CONSTRAINT "episode_publications_channel_id_fkey"
    FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: voice_cache
CREATE TABLE "voice_cache" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "voice_id"   VARCHAR(255) NOT NULL,
    "text_hash"  VARCHAR(64)  NOT NULL,
    "audio_url"  TEXT         NOT NULL,
    "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "voice_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: voice_cache unique on (voice_id, text_hash)
CREATE UNIQUE INDEX "voice_cache_voice_id_text_hash_key" ON "voice_cache"("voice_id","text_hash");

-- CreateTable: node_runs
CREATE TABLE "node_runs" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "episode_id"   UUID         NOT NULL,
    "node_id"      VARCHAR(255) NOT NULL,
    "node_type"    VARCHAR(50)  NOT NULL,
    "status"       VARCHAR(20)  NOT NULL DEFAULT 'pending',
    "config"       JSONB,
    "input"        JSONB,
    "output"       JSONB,
    "error"        TEXT,
    "attempts"     INTEGER      NOT NULL DEFAULT 0,
    "started_at"   TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "node_runs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: node_runs.episode_id → episodes.id
ALTER TABLE "node_runs" ADD CONSTRAINT "node_runs_episode_id_fkey"
    FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex: node_runs unique (episode_id, node_id) for idempotency
CREATE UNIQUE INDEX "episodeId_nodeId" ON "node_runs"("episode_id","node_id");

-- CreateIndex: node_runs status index for queue queries
CREATE INDEX "node_runs_status_idx" ON "node_runs"("status");
CREATE INDEX "node_runs_episode_id_idx" ON "node_runs"("episode_id");
