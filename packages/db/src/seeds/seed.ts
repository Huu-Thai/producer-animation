import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@producer.dev' },
    update: {},
    create: {
      email: 'admin@producer.dev',
      passwordHash,
      name: 'Admin User',
    },
  });

  const series = await prisma.series.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Anime Series',
      description: 'A demo animated series for testing',
      genre: 'Fantasy',
      artStyle: 'Anime',
      defaultLanguage: 'en',
      createdBy: user.id,
    },
  });

  await prisma.session.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      seriesId: series.id,
      name: 'Season 1',
      globalContext: { theme: 'adventure', setting: 'medieval fantasy' },
    },
  });

  await prisma.character.createMany({
    skipDuplicates: true,
    data: [
      {
        seriesId: series.id,
        name: 'Hero',
        personalityPrompt: 'Brave, determined, selfless warrior',
        visualPrompt: 'Young male warrior, blue armor, silver sword',
        voiceId: 'onwK4e9ZLuTAKqWW03F9',
      },
      {
        seriesId: series.id,
        name: 'Villain',
        personalityPrompt: 'Cunning, power-hungry, manipulative',
        visualPrompt: 'Tall male sorcerer, black robes, glowing red eyes',
        voiceId: 'TxGEqnHWrfWFTfGW9XjX',
      },
    ],
  });

  console.log('Seed completed successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
