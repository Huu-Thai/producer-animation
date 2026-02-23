import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../common/prisma.service';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/create-episode.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['processing'],
  processing: ['rendering', 'failed'],
  rendering: ['ready', 'failed'],
  ready: ['publishing'],
  publishing: ['public', 'failed'],
  public: [],
  failed: ['draft'],
};

@Injectable()
export class EpisodesService {
  constructor(private prisma: PrismaService) {}

  async findAll(seriesId: string, status?: string) {
    return this.prisma.episode.findMany({
      where: { seriesId, deletedAt: null, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: {
        nodeRuns: { orderBy: { startedAt: 'asc' } },
        scripts: true,
      },
    });
    if (!episode || episode.deletedAt) throw new NotFoundException('Episode not found');
    return episode;
  }

  async create(seriesId: string, dto: CreateEpisodeDto) {
    return this.prisma.episode.create({
      data: { seriesId, ...dto, status: 'draft', workflowVersion: 1 },
    });
  }

  async update(id: string, dto: UpdateEpisodeDto) {
    await this.findOne(id);
    return this.prisma.episode.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.episode.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async uploadScript(episodeId: string, rawScript: string, language?: string) {
    const episode = await this.findOne(episodeId);
    const latestScript = await this.prisma.script.findFirst({
      where: { episodeId },
      orderBy: { version: 'desc' },
    });
    const version = (latestScript?.version ?? 0) + 1;
    return this.prisma.script.create({
      data: {
        episodeId,
        rawScript,
        language: language ?? episode.language ?? 'vi',
        version,
      },
    });
  }

  async updateStatus(id: string, newStatus: string) {
    const episode = await this.prisma.episode.findFirst({ where: { id, deletedAt: null } });
    if (!episode) throw new NotFoundException('Episode not found');
    if (!VALID_TRANSITIONS[episode.status]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition: ${episode.status} → ${newStatus}`);
    }
    return this.prisma.episode.update({ where: { id }, data: { status: newStatus } });
  }

  async startWorkflow(episodeId: string) {
    const episode = await this.findOne(episodeId);
    if (!VALID_TRANSITIONS[episode.status]?.includes('processing')) {
      throw new BadRequestException(`Cannot start workflow from status: ${episode.status}`);
    }
    if (!episode.workflow) {
      throw new BadRequestException('No workflow defined for episode');
    }

    await this.prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'processing' },
    });

    await axios.post(
      `${process.env.WORKFLOW_ENGINE_URL}/workflow/start`,
      {
        episodeId,
        workflow: episode.workflow,
        workflowVersion: episode.workflowVersion,
      },
      { headers: { 'x-internal-secret': process.env.INTERNAL_SECRET } },
    );

    return { success: true, status: 'processing' };
  }
}
