import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const CIRCUIT_OPEN_MS = 30_000;
const CIRCUIT_THRESHOLD = 3;

const TASK_TIMEOUTS_MS: Record<string, number> = {
  scene_parser: 60_000,
  image_gen: 120_000,
  motion: 360_000,
  voice: 60_000,
  timeline: 60_000,
  render: 660_000,
  publish: 300_000,
};

@Injectable()
export class TaskRouterService {
  private readonly logger = new Logger(TaskRouterService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  private readonly circuits = new Map<string, CircuitState>();

  private getCircuit(provider: string): CircuitState {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, { failures: 0, openedAt: null });
    }
    return this.circuits.get(provider)!;
  }

  private isOpen(provider: string): boolean {
    const c = this.getCircuit(provider);
    if (!c.openedAt) return false;
    if (Date.now() - c.openedAt > CIRCUIT_OPEN_MS) {
      c.failures = 0;
      c.openedAt = null;
      return false;
    }
    return true;
  }

  private onFailure(provider: string) {
    const c = this.getCircuit(provider);
    c.failures++;
    if (c.failures >= CIRCUIT_THRESHOLD) {
      c.openedAt = Date.now();
      this.logger.warn(`Circuit OPEN for ${provider}`);
    }
  }

  private onSuccess(provider: string) {
    const c = this.getCircuit(provider);
    c.failures = 0;
    c.openedAt = null;
  }

  async executeTask(
    episodeId: string,
    nodeId: string,
    nodeType: string,
    config: Record<string, any>,
    inputs: Record<string, any>,
  ): Promise<any> {
    switch (nodeType) {
      case 'scene_parser':
        return this.runSceneParser(config, inputs);
      case 'image_gen':
        return this.dispatchCelery('tasks.image.generate', { ...config, ...inputs }, 'leonardo');
      case 'motion':
        return this.dispatchCelery('tasks.motion.generate', { ...config, ...inputs }, 'sora');
      case 'voice':
        return this.dispatchCelery(
          'tasks.voice.synthesize',
          { ...config, ...inputs },
          'elevenlabs',
        );
      case 'timeline':
        return this.dispatchCelery('tasks.timeline.assemble', { ...config, ...inputs }, 'ffmpeg');
      case 'render':
        return this.dispatchCelery('tasks.render.compose', { ...config, ...inputs }, 'ffmpeg');
      case 'publish':
        return this.handlePublish(episodeId, config, inputs);
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }
  }

  private async runSceneParser(
    config: Record<string, any>,
    inputs: Record<string, any>,
  ): Promise<any> {
    const provider = 'anthropic';
    if (this.isOpen(provider)) throw new Error('Circuit open for Anthropic');

    try {
      const script = config.rawScript ?? (inputs as any)?.rawScript ?? '';
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Parse this animation script into structured scenes. Return a JSON array only (no markdown), where each scene has: { sceneNumber, location, characters, actions, dialogue, duration_seconds }.\n\nScript:\n${script}`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const scenes = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      this.onSuccess(provider);
      return { scenes, totalScenes: scenes.length };
    } catch (err) {
      this.onFailure(provider);
      throw err;
    }
  }

  private async dispatchCelery(
    taskName: string,
    payload: Record<string, any>,
    provider: string,
  ): Promise<any> {
    if (this.isOpen(provider)) throw new Error(`Circuit open for ${provider}`);

    const flowerUrl = process.env.CELERY_FLOWER_URL ?? 'http://localhost:5555';
    const timeout = TASK_TIMEOUTS_MS[taskName.split('.')[1]] ?? 120_000;

    try {
      const submitResp = await axios.post(
        `${flowerUrl}/api/task/async-apply/${taskName}`,
        { args: [], kwargs: payload },
        { timeout: 15_000 },
      );

      const taskId = submitResp.data['task-id'] ?? submitResp.data.task_id;
      if (!taskId) throw new Error('No task-id returned from Flower');

      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusResp = await axios.get(`${flowerUrl}/api/task/result/${taskId}`, {
          timeout: 8_000,
        });
        const { state, result } = statusResp.data;

        if (state === 'SUCCESS') {
          this.onSuccess(provider);
          return result;
        }
        if (state === 'FAILURE') {
          this.onFailure(provider);
          throw new Error(result?.exc_message ?? 'Celery task failed');
        }
      }

      throw new Error(`Task ${taskId} timed out after ${timeout}ms`);
    } catch (err: any) {
      if (err.response?.status >= 500 || err.code === 'ECONNREFUSED') {
        this.onFailure(provider);
      }
      throw err;
    }
  }

  private async handlePublish(
    episodeId: string,
    config: Record<string, any>,
    inputs: Record<string, any>,
  ): Promise<any> {
    const channelId = config.channelId;
    if (!channelId) throw new Error('channelId required in publish node config');

    const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
    const channelResp = await axios.get(`${apiUrl}/internal/channels/${channelId}/config`, {
      headers: { 'x-internal-secret': process.env.INTERNAL_SECRET },
    });

    return this.dispatchCelery(
      'tasks.publish.youtube',
      {
        episodeId,
        videoUrl: inputs.videoUrl ?? config.videoUrl,
        thumbnailUrl: inputs.thumbnailUrl ?? config.thumbnailUrl,
        title: config.title ?? 'New Episode',
        description: config.description ?? '',
        tokens: channelResp.data,
      },
      'youtube',
    );
  }
}
