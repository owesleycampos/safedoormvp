/**
 * Seeder do teste de carga — cria escolas/turmas/dispositivos/alunos num banco
 * de STAGING e escreve tests/load/load-fixtures.json (pares deviceKey+studentId)
 * que o k6 consome.
 *
 * NUNCA rode contra produção. Aponte DATABASE_URL para o banco de staging.
 *
 * Uso:
 *   DATABASE_URL=postgres://...:5432/safedoor_staging \
 *   SCHOOLS=100 STUDENTS_PER_SCHOOL=30 DEVICES_PER_SCHOOL=2 \
 *   npx tsx tests/load/seed-load.ts
 *
 * Cada escola nasce ACTIVE, com uma turma MANHA, N alunos e M dispositivos. As
 * escolas ficam com nome prefixado "LOADTEST " para você limpar fácil depois:
 *   DELETE FROM "School" WHERE name LIKE 'LOADTEST %';
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const SCHOOLS = Number(process.env.SCHOOLS || 100);
const STUDENTS_PER_SCHOOL = Number(process.env.STUDENTS_PER_SCHOOL || 30);
const DEVICES_PER_SCHOOL = Number(process.env.DEVICES_PER_SCHOOL || 2);

async function main() {
  if (/prod|neon\.tech/.test(process.env.DATABASE_URL || '') && !process.env.I_KNOW_ITS_STAGING) {
    throw new Error('DATABASE_URL parece produção. Aborte. Defina I_KNOW_ITS_STAGING=1 se for staging mesmo.');
  }

  const fixtures: Array<{ deviceKey: string; studentId: string; schoolId: string }> = [];
  const stamp = Date.now();

  for (let s = 0; s < SCHOOLS; s++) {
    const school = await prisma.school.create({
      data: {
        name: `LOADTEST Escola ${stamp}-${s}`,
        status: 'ACTIVE',
        settings: { create: { timezone: 'America/Sao_Paulo', minConfidence: 0.9, notifyOnEntry: true, notifyOnExit: true } },
      },
    });
    const klass = await prisma.class.create({ data: { name: 'Turma 1', shift: 'MANHA', schoolId: school.id } });

    const deviceKeys: string[] = [];
    for (let d = 0; d < DEVICES_PER_SCHOOL; d++) {
      const apiKey = `loadtest-${stamp}-${s}-${d}`;
      await prisma.device.create({ data: { name: `Portaria ${d}`, schoolId: school.id, apiKey } });
      deviceKeys.push(apiKey);
    }

    const students = await prisma.$transaction(
      Array.from({ length: STUDENTS_PER_SCHOOL }, (_, i) =>
        prisma.student.create({ data: { name: `Aluno ${s}-${i}`, classId: klass.id, schoolId: school.id }, select: { id: true } })
      )
    );

    // Um par por aluno, distribuindo os dispositivos da escola.
    students.forEach((st, i) => {
      fixtures.push({ deviceKey: deviceKeys[i % deviceKeys.length], studentId: st.id, schoolId: school.id });
    });

    if ((s + 1) % 10 === 0) console.log(`  ${s + 1}/${SCHOOLS} escolas...`);
  }

  const out = join(__dirname, 'load-fixtures.json');
  writeFileSync(out, JSON.stringify(fixtures, null, 0));
  console.log(`\nOK: ${SCHOOLS} escolas, ${fixtures.length} pares → ${out}`);
}

main().finally(() => prisma.$disconnect());
