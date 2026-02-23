import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function computeEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(seriesId: string) {
    return this.prisma.session.findMany({
      where: { seriesId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(seriesId: string, dto: CreateSessionDto) {
    const session = await this.prisma.session.create({
      data: { seriesId, ...dto, globalContext: dto.globalContext ?? {} },
    });
    await this.upsertEmbedding(session.id, dto);
    return session;
  }

  async update(id: string, dto: Partial<CreateSessionDto>) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    const updated = await this.prisma.session.update({ where: { id }, data: dto });
    await this.upsertEmbedding(id, dto);
    return updated;
  }

  private async upsertEmbedding(id: string, dto: Partial<CreateSessionDto>) {
    const textParts = [
      dto.name ?? '',
      typeof dto.globalContext === 'object' ? JSON.stringify(dto.globalContext) : '',
    ].filter(Boolean);

    if (!textParts.length || !process.env.OPENAI_API_KEY) return;

    const embedding = await computeEmbedding(textParts.join(' '));
    if (!embedding.length) return;

    const vector = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`
      UPDATE sessions SET embedding = ${vector}::vector WHERE id = ${id}::uuid
    `;
  }
}
