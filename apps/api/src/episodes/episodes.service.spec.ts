import { Test } from '@nestjs/testing';
import { EpisodesService } from './episodes.service';
import { PrismaService } from '../common/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  episode: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('EpisodesService – FSM', () => {
  let service: EpisodesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EpisodesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<EpisodesService>(EpisodesService);
    jest.clearAllMocks();
  });

  const validTransitions = [
    ['draft', 'processing'],
    ['processing', 'rendering'],
    ['processing', 'failed'],
    ['rendering', 'ready'],
    ['rendering', 'failed'],
    ['ready', 'publishing'],
    ['publishing', 'public'],
    ['publishing', 'failed'],
    ['failed', 'draft'],
  ];

  const invalidTransitions = [
    ['draft', 'ready'],
    ['draft', 'public'],
    ['rendering', 'draft'],
    ['public', 'draft'],
    ['ready', 'draft'],
  ];

  it.each(validTransitions)('should allow transition from %s → %s', async (from, to) => {
    const episode = {
      id: 'ep-1',
      status: from,
      seriesId: 'series-1',
      workflow: { nodes: [], edges: [] },
    };
    mockPrisma.episode.findFirst.mockResolvedValue(episode);
    mockPrisma.episode.update.mockResolvedValue({ ...episode, status: to });

    // updateStatus is the private FSM - call it via a public method that uses it
    // Testing via the update path that changes status
    await expect(service.updateStatus('ep-1', to as any)).resolves.toBeDefined();
  });

  it.each(invalidTransitions)('should reject invalid transition from %s → %s', async (from, to) => {
    const episode = { id: 'ep-1', status: from, seriesId: 'series-1' };
    mockPrisma.episode.findFirst.mockResolvedValue(episode);

    await expect(service.updateStatus('ep-1', to as any)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException for unknown episode', async () => {
    mockPrisma.episode.findFirst.mockResolvedValue(null);
    await expect(service.updateStatus('nonexistent', 'processing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
