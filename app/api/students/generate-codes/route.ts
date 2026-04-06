import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/students/generate-codes
 *
 * Generate access codes for all students without one.
 * Body: { classId?: string } — optional, limit to a specific class.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const body = await req.json().catch(() => ({}));
  const classId = body.classId as string | undefined;

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      isActive: true,
      accessCode: null,
      ...(classId ? { classId } : {}),
    },
    select: { id: true, name: true },
  });

  if (students.length === 0) {
    return NextResponse.json({
      success: true,
      generated: 0,
      message: 'Todos os alunos já possuem código de acesso.',
    });
  }

  // Get existing codes to avoid collisions
  const existingCodes = await prisma.student.findMany({
    where: { accessCode: { not: null } },
    select: { accessCode: true },
  });
  const usedCodes = new Set(existingCodes.map((s) => s.accessCode));

  let generated = 0;
  for (const student of students) {
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (usedCodes.has(code) && attempts < 100);

    if (attempts >= 100) continue;

    await prisma.student.update({
      where: { id: student.id },
      data: { accessCode: code },
    });

    usedCodes.add(code);
    generated++;
  }

  return NextResponse.json({
    success: true,
    generated,
    total: students.length,
    message: `${generated} código${generated !== 1 ? 's' : ''} gerado${generated !== 1 ? 's' : ''}.`,
  });
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
