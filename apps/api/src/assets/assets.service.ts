import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../common/prisma.service';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'audio/mpeg'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

@Injectable()
export class AssetsService {
  private s3: S3Client;
  private bucket: string;

  constructor(private prisma: PrismaService) {
    this.s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
    this.bucket = process.env.S3_BUCKET ?? '';
  }

  async presign(contentType: string, fileName: string, fileSize: number) {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestException(`Content type not allowed: ${contentType}`);
    }
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large (max 500MB)');
    }

    const key = `uploads/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 });

    const asset = await this.prisma.asset.create({
      data: {
        type: contentType.split('/')[0],
        storageKey: key,
        metadata: { contentType, fileName, fileSize },
      },
    });

    return { uploadUrl, assetId: asset.id, key };
  }

  async findAll(type?: string) {
    return this.prisma.asset.findMany({
      where: { deletedAt: null, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.deletedAt) throw new NotFoundException('Asset not found');

    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.storageKey }));
    } catch {}

    return this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
