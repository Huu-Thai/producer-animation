import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSeriesDto, UpdateSeriesDto } from './dto/create-series.dto';

@Injectable()
export class SeriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.series.findMany({
        where: { createdBy: userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.series.count({ where: { createdBy: userId, deletedAt: null } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string) {
    const series = await this.prisma.series.findUnique({ where: { id } });
    if (!series || series.deletedAt) throw new NotFoundException('Series not found');
    if (series.createdBy !== userId) throw new ForbiddenException();
    return series;
  }

  async create(dto: CreateSeriesDto, userId: string) {
    return this.prisma.series.create({
      data: { ...dto, createdBy: userId },
    });
  }

  async update(id: string, dto: UpdateSeriesDto, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.series.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.series.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
