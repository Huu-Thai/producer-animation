import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import OpenAI from 'openai';
import axios from 'axios';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function computeEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

async function validateElevenLabsVoiceId(voiceId: string): Promise<void> {
  if (!process.env.ELEVENLABS_API_KEY) return; // skip validation if no key configured
  try {
    await axios.get(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    });
  } catch {
    throw new BadRequestException(`Invalid ElevenLabs voice_id: ${voiceId}`);
  }
}

@Injectable()
export class CharactersService {
  constructor(private prisma: PrismaService) {}

  async findAll(seriesId: string) {
    return this.prisma.character.findMany({
      where: { seriesId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(seriesId: string, dto: CreateCharacterDto) {
    if (dto.voiceId) {
      await validateElevenLabsVoiceId(dto.voiceId);
    }

    const character = await this.prisma.character.create({ data: { seriesId, ...dto } });
    await this.upsertEmbedding(character.id, dto);
    return character;
  }

  async update(id: string, dto: Partial<CreateCharacterDto>) {
    const char = await this.prisma.character.findUnique({ where: { id } });
    if (!char || char.deletedAt) throw new NotFoundException('Character not found');

    if (dto.voiceId && dto.voiceId !== char.voiceId) {
      await validateElevenLabsVoiceId(dto.voiceId);
    }

    const updated = await this.prisma.character.update({ where: { id }, data: dto });
    await this.upsertEmbedding(id, dto);
    return updated;
  }

  async remove(id: string) {
    const char = await this.prisma.character.findUnique({ where: { id } });
    if (!char || char.deletedAt) throw new NotFoundException('Character not found');
    return this.prisma.character.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async previewVoice(voiceId: string, text = 'Hello! This is a voice preview.') {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }
    const resp = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      },
    );
    // Upload to S3 temp path and return presigned URL
    const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const key = `voice-previews/${voiceId}-${Date.now()}.mp3`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: Buffer.from(resp.data),
        ContentType: 'audio/mpeg',
      }),
    );
    const audioUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
      }),
      { expiresIn: 900 },
    );
    return { audioUrl };
  }

  private async upsertEmbedding(id: string, dto: Partial<CreateCharacterDto>) {
    const textParts = [dto.name ?? '', dto.personalityPrompt ?? '', dto.visualPrompt ?? ''].filter(
      Boolean,
    );

    if (!textParts.length || !process.env.OPENAI_API_KEY) return;

    const embedding = await computeEmbedding(textParts.join(' '));
    if (!embedding.length) return;

    const vector = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`
      UPDATE characters SET embedding = ${vector}::vector WHERE id = ${id}::uuid
    `;
  }
}
