import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Admin user
  const hashedPassword = await bcrypt.hash('Admin@1234', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@wellbeing.com' },
    update: {},
    create: {
      firstName: 'Sam',
      lastName: 'Admin',
      email: 'admin@wellbeing.com',
      password: hashedPassword,
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  console.log(`✅ Admin created: ${admin.email}`);

  // Create a sample consultation service
  await prisma.consultationService.upsert({
    where: { id: 'seed-service-1' },
    update: {},
    create: {
      id: 'seed-service-1',
      title: 'Personal Wellness Consultation',
      description: 'A 60-minute one-on-one session focused on your personal wellness journey.',
      price: 15000,
      duration: 60,
    },
  });

  // Create a sample program
  await prisma.program.upsert({
    where: { id: 'seed-program-1' },
    update: {
      description: 'Transform your mental wellness with this structured 30-day program. Through guided sessions and reflective practice, you build habits that support presence and resilience.',
      category: 'LEADERS',
      durationWeeks: 4,
      hoursPerWeek: 2,
      certificateLabel: 'Digital certificate',
      learningOutcomes: {
        set: [
          'Greater emotional awareness and self-understanding',
          'Practical tools for daily stress regulation',
          'A sustainable personal mindfulness practice',
        ],
      },
    },
    create: {
      id: 'seed-program-1',
      title: '30-Day Mindfulness Journey',
      category: 'LEADERS',
      description:
        'Transform your mental wellness with this structured 30-day program. Through guided sessions and reflective practice, you build habits that support presence and resilience.',
      price: 25000,
      durationWeeks: 4,
      hoursPerWeek: 2,
      certificateLabel: 'Digital certificate',
      learningOutcomes: [
        'Greater emotional awareness and self-understanding',
        'Practical tools for daily stress regulation',
        'A sustainable personal mindfulness practice',
      ],
      isPublished: true,
      weeks: {
        create: [
          {
            title: 'Week 1: Introduction to Mindfulness',
            description: 'What mindfulness is and why it matters.',
            order: 1,
            modules: {
               create: [
                 {
                    title: 'Breathing Techniques',
                    description: 'Core breathing exercises for daily practice.',
                    type: 'VIDEO',
                    contentUrl: 'https://youtube.com',
                    order: 1
                 }
               ]
            }
          }
        ],
      },
    },
  });

  console.log('✅ Sample data seeded.');
  console.log('\n🔑 Admin credentials:');
  console.log('   Email:    admin@wellbeing.com');
  console.log('   Password: Admin@1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
