import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Safe Door Brasil database...');

  // Create School
  const school = await prisma.school.upsert({
    where: { id: 'school-demo-001' },
    update: {},
    create: {
      id: 'school-demo-001',
      name: 'Escola Estadual Demo',
      cnpj: '00.000.000/0001-00',
      address: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      contactEmail: 'contato@escolademo.edu.br',
      contactPhone: '(11) 99999-9999',
      settings: {
        create: {
          entryStartTime: '06:30',
          entryEndTime: '08:30',
          exitStartTime: '12:00',
          exitEndTime: '17:30',
          minConfidence: 0.90,
          timezone: 'America/Sao_Paulo',
        },
      },
    },
  });

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@escolademo.edu.br' },
    update: {},
    create: {
      email: 'admin@escolademo.edu.br',
      name: 'Administrador Demo',
      passwordHash: adminPassword,
      role: 'ADMIN',
      schoolId: school.id,
      lgpdAccepted: true,
      lgpdAcceptedAt: new Date(),
    },
  });

  // Create Classes
  const classes = await Promise.all([
    prisma.class.upsert({
      where: { name_schoolId: { name: '1º Ano A', schoolId: school.id } },
      update: {},
      create: { name: '1º Ano A', grade: '1º Ano', schoolId: school.id },
    }),
    prisma.class.upsert({
      where: { name_schoolId: { name: '2º Ano B', schoolId: school.id } },
      update: {},
      create: { name: '2º Ano B', grade: '2º Ano', schoolId: school.id },
    }),
    prisma.class.upsert({
      where: { name_schoolId: { name: '3º Ano A', schoolId: school.id } },
      update: {},
      create: { name: '3º Ano A', grade: '3º Ano', schoolId: school.id },
    }),
  ]);

  // Create Demo Students
  const studentNames = [
    'Ana Silva Santos',
    'Bruno Costa Oliveira',
    'Carla Fernandes Lima',
    'Diego Martins Souza',
    'Elena Rodrigues Pereira',
    'Felipe Alves Nascimento',
  ];

  const students = await Promise.all(
    studentNames.map((name, i) =>
      prisma.student.upsert({
        where: { id: `student-demo-00${i + 1}` },
        update: {},
        create: {
          id: `student-demo-00${i + 1}`,
          name,
          classId: classes[Math.floor(i / 2)].id,
          schoolId: school.id,
          isActive: true,
        },
      })
    )
  );

  // Create Parent User
  const parentPassword = await bcrypt.hash('parent123', 12);
  const parentUser = await prisma.user.upsert({
    where: { email: 'mae@demo.com' },
    update: {},
    create: {
      email: 'mae@demo.com',
      name: 'Maria Silva Santos',
      passwordHash: parentPassword,
      role: 'PARENT',
      lgpdAccepted: true,
      lgpdAcceptedAt: new Date(),
    },
  });

  const parent = await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
      name: 'Maria Silva Santos',
      phone: '(11) 98888-7777',
    },
  });

  // Link parent to student
  await prisma.studentParent.upsert({
    where: { studentId_parentId: { studentId: students[0].id, parentId: parent.id } },
    update: {},
    create: {
      studentId: students[0].id,
      parentId: parent.id,
      relationship: 'Mãe',
      isPrimary: true,
    },
  });

  // Create Demo Device
  await prisma.device.upsert({
    where: { id: 'device-demo-001' },
    update: {},
    create: {
      id: 'device-demo-001',
      schoolId: school.id,
      name: 'Tablet Entrada Principal',
      description: 'iPad Pro 12.9" - Portaria Principal',
      type: 'TABLET',
      status: 'ONLINE',
      lastSeen: new Date(),
    },
  });

  // Create some demo attendance events for today
  const today = new Date();
  today.setHours(7, 15, 0, 0);

  const demoEvents = [
    { id: 'event-demo-001', studentId: students[0].id, timestamp: today, confidence: 0.97 },
    { id: 'event-demo-002', studentId: students[1].id, timestamp: new Date(today.getTime() + 5 * 60000), confidence: 0.95 },
    { id: 'event-demo-003', studentId: students[2].id, timestamp: new Date(today.getTime() + 12 * 60000), confidence: 0.98 },
  ];

  for (const ev of demoEvents) {
    await prisma.attendanceEvent.upsert({
      where: { id: ev.id },
      update: {},
      create: {
        id: ev.id,
        studentId: ev.studentId,
        deviceId: 'device-demo-001',
        timestamp: ev.timestamp,
        eventType: 'ENTRY',
        confidence: ev.confidence,
        notified: true,
      },
    });
  }

  console.log('✅ Seed completed!');
  console.log('');
  console.log('📧 Admin login: admin@escolademo.edu.br / admin123');
  console.log('📧 Parent login: mae@demo.com / parent123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
