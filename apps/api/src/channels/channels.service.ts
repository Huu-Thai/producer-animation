import { Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { google } from 'googleapis';
import { PrismaService } from '../common/prisma.service';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  private encrypt(text: string): string {
    const key = Buffer.from(process.env.ENCRYPTION_KEY ?? '0'.repeat(64), 'hex');
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted: encrypted.toString('hex'),
      tag: tag.toString('hex'),
    });
  }

  private decrypt(data: string): string {
    const { iv, encrypted, tag } = JSON.parse(data);
    const key = Buffer.from(process.env.ENCRYPTION_KEY ?? '0'.repeat(64), 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  getYouTubeAuthUrl(seriesId: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI,
    );
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
      state: seriesId,
      prompt: 'consent',
    });
  }

  async handleCallback(code: string, seriesId: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI,
    );
    const { tokens } = await oauth2Client.getToken(code);
    const encryptedConfig = this.encrypt(JSON.stringify(tokens));

    return this.prisma.channel.create({
      data: {
        seriesId,
        platform: 'youtube',
        name: 'YouTube Channel',
        config: encryptedConfig,
      },
    });
  }

  async findAll(seriesId: string) {
    const channels = await this.prisma.channel.findMany({ where: { seriesId } });
    // Never expose encrypted config
    return channels.map(({ config: _, ...c }) => c);
  }

  async remove(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) throw new NotFoundException('Channel not found');
    return this.prisma.channel.delete({ where: { id } });
  }

  async getDecryptedConfig(id: string): Promise<Record<string, any>> {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) throw new NotFoundException('Channel not found');
    return JSON.parse(this.decrypt(channel.config as string));
  }
}
