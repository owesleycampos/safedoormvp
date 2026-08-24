/**
 * Seed for the local smoke-test database.
 * Run with: DATABASE_URL=... DIRECT_URL=... npx tsx tests/seed-smoke.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── Escola A (alvo dos testes) ──────────────────────────────
  const schoolA = await prisma.school.create({
    data: {
      name: 'Escola Teste A',
      status: 'ACTIVE',
      settings: {
        create: {
          timezone: 'America/Sao_Paulo',
          minConfidence: 0.9,
          notifyOnEntry: true,
          notifyOnExit: true,
        },
      },
    },
  });

  const classA = await prisma.class.create({
    data: { name: '1A', shift: 'MANHA', schoolId: schoolA.id },
  });

  const joao = await prisma.student.create({
    data: { name: 'João Silva', classId: classA.id, schoolId: schoolA.id },
  });
  const maria = await prisma.student.create({
    data: { name: 'Maria Souza', classId: classA.id, schoolId: schoolA.id },
  });

  const deviceA = await prisma.device.create({
    data: {
      name: 'Tablet Portaria A',
      schoolId: schoolA.id,
      apiKey: 'test-device-key-escola-a',
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@teste.com',
      name: 'Admin Teste',
      role: 'ADMIN',
      schoolId: schoolA.id,
      passwordHash: await bcrypt.hash('senha12345', 10),
    },
  });

  // ── Escola B (prova de isolamento de tenant) ────────────────
  const schoolB = await prisma.school.create({
    data: { name: 'Escola Teste B', status: 'ACTIVE' },
  });
  const classB = await prisma.class.create({
    data: { name: '1B', shift: 'MANHA', schoolId: schoolB.id },
  });
  const pedro = await prisma.student.create({
    data: { name: 'Pedro Escola B', classId: classB.id, schoolId: schoolB.id },
  });

  // ── Webhook secret da plataforma ────────────────────────────
  await prisma.platformSettings.create({
    data: { webhookSecret: 'whsec_test_123' },
  });

  console.log(JSON.stringify({
    schoolA: schoolA.id,
    schoolB: schoolB.id,
    joao: joao.id,
    maria: maria.id,
    pedro: pedro.id,
    deviceA: deviceA.id,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
