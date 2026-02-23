// ============================================================
// Enums
// ============================================================

export enum EpisodeStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  RENDERING = 'rendering',
  READY = 'ready',
  PUBLISHING = 'publishing',
  PUBLIC = 'public',
  FAILED = 'failed',
}

export enum NodeType {
  SCENE_PARSER = 'scene_parser',
  IMAGE_GEN = 'image_gen',
  MOTION = 'motion',
  VOICE = 'voice',
  TIMELINE = 'timeline',
  RENDER = 'render',
  PUBLISH = 'publish',
}

export enum NodeRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum AssetType {
  IMAGE = 'image',
  BG = 'bg',
  MUSIC = 'music',
  SFX = 'sfx',
  LORA = 'lora',
}

export enum Language {
  VI = 'vi',
  EN = 'en',
}

export enum Platform {
  YOUTUBE = 'youtube',
}

// ============================================================
// Core Domain Interfaces
// ============================================================

export interface Series {
  id: string;
  name: string;
  description?: string;
  genre?: string;
  artStyle?: string;
  defaultLanguage: Language;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Session {
  id: string;
  seriesId: string;
  name?: string;
  globalContext?: Record<string, unknown>;
  memorySummary?: string;
  createdAt: Date;
}

export interface Episode {
  id: string;
  seriesId: string;
  sessionId?: string;
  title?: string;
  synopsis?: string;
  language: Language;
  durationTarget?: number;
  status: EpisodeStatus;
  workflowVersion: number;
  finalVideoUrl?: string;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Script {
  id: string;
  episodeId: string;
  rawScript: string;
  parsedJson?: SceneParsed[];
  language?: Language;
  version: number;
  createdAt: Date;
}

export interface Character {
  id: string;
  seriesId: string;
  name: string;
  personalityPrompt?: string;
  visualPrompt?: string;
  voiceId?: string;
  createdAt: Date;
}

export interface Asset {
  id: string;
  type: AssetType;
  storageKey: string;
  metadata?: Record<string, unknown>;
  reusable: boolean;
  createdAt: Date;
}

export interface Channel {
  id: string;
  seriesId: string;
  platform: Platform;
  name?: string;
  createdAt: Date;
}

export interface EpisodePublication {
  id: string;
  episodeId: string;
  channelId: string;
  platformVideoId?: string;
  status: string;
  publishedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface NodeRun {
  id: string;
  episodeId: string;
  nodeId: string;
  nodeType: NodeType;
  status: NodeRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  attempts: number;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
}

// ============================================================
// Workflow / DAG Types
// ============================================================

export interface WorkflowDefinition {
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// ============================================================
// Scene Types (parsed from script)
// ============================================================

export interface SceneParsed {
  sceneNumber: number;
  description: string;
  dialogue?: DialogueLine[];
  characters?: string[];
  setting?: string;
  motionPrompt?: string;
  duration?: number;
}

export interface DialogueLine {
  character: string;
  text: string;
  emotion?: string;
}

// ============================================================
// AI Task Payloads
// ============================================================

export interface ImageTaskPayload {
  prompt: string;
  style?: string;
  characterRefs?: string[];
  width?: number;
  height?: number;
  loraId?: string;
}

export interface MotionTaskPayload {
  imageUrl: string;
  motionPrompt: string;
  durationSeconds: number;
}

export interface VoiceTaskPayload {
  text: string;
  voiceId: string;
  language: Language;
}

export interface RenderTaskPayload {
  scenes: RenderScene[];
  subtitlesSrt?: string;
}

export interface RenderScene {
  videoUrl: string;
  audioUrl?: string;
  duration: number;
}

// ============================================================
// AI Task Results
// ============================================================

export interface ImageTaskResult {
  imageUrl: string;
  assetId: string;
}

export interface MotionTaskResult {
  videoUrl: string;
  assetId: string;
}

export interface VoiceTaskResult {
  audioUrl: string;
  durationMs: number;
  fromCache: boolean;
}

export interface RenderTaskResult {
  finalVideoUrl: string;
  thumbnailUrl: string;
}

// ============================================================
// WebSocket Events
// ============================================================

export interface WsEpisodeStatus {
  episodeId: string;
  status: EpisodeStatus;
}

export interface WsNodeStatus {
  episodeId: string;
  nodeId: string;
  status: NodeRunStatus;
  output?: Record<string, unknown>;
}

export interface WsEpisodeReady {
  episodeId: string;
  finalVideoUrl: string;
  thumbnailUrl: string;
}

export interface WsEpisodePublished {
  episodeId: string;
  platformVideoId: string;
}

export interface WsEpisodeError {
  episodeId: string;
  nodeId?: string;
  error: string;
}

// ============================================================
// Internal Service Message Contracts
// ============================================================

export interface NodeCompleteMessage {
  episodeId: string;
  nodeId: string;
  nodeType: NodeType;
  output: Record<string, unknown>;
}

export interface NodeFailedMessage {
  episodeId: string;
  nodeId: string;
  nodeType: NodeType;
  error: string;
}

export interface WorkflowStartMessage {
  episodeId: string;
  workflow: WorkflowDefinition;
}

// ============================================================
// API Response Types
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
