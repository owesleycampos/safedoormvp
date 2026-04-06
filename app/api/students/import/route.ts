import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/students/import
 *
 * Bulk import students from CSV.
 * Body: { classId: string, students: Array<{ name: string, birthDate?: string }> }
 *
 * Or FormData with 'file' (CSV) and 'classId'.
 * CSV format: name,birthDate (one student per line, first line = header)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;
  const contentType = req.headers.get('content-type') || '';

  let classId: string;
  let studentRows: Array<{ name: string; birthDate?: string }>;

  if (contentType.includes('multipart/form-data')) {
    // CSV file upload
    const formData = await req.formData();
    classId = formData.get('classId') as string;
    const file = formData.get('file') as File | null;

    if (!classId || !file) {
      return NextResponse.json({ error: 'classId e arquivo CSV são obrigatórios.' }, { status: 400 });
    }

    const text = await file.text();
    studentRows = parseCsv(text);
  } else {
    // JSON body
    const body = await req.json();
    classId = body.classId;
    studentRows = body.students || [];
  }

  if (!classId) {
    return NextResponse.json({ error: 'classId é obrigatório.' }, { status: 400 });
  }

  // Verify class belongs to school
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) {
    return NextResponse.json({ error: 'Turma não encontrada.' }, { status: 404 });
  }

  if (studentRows.length === 0) {
    return NextResponse.json({ error: 'Nenhum aluno encontrado no arquivo.' }, { status: 400 });
  }

  // Cap at 200 students per import
  if (studentRows.length > 200) {
    return NextResponse.json({ error: 'Máximo de 200 alunos por importação.' }, { status: 400 });
  }

  // Check for existing names to avoid duplicates
  const existingStudents = await prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: { name: true },
  });
  const existingNames = new Set(existingStudents.map((s) => s.name.toLowerCase().trim()));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of studentRows) {
    const name = row.name?.trim();
    if (!name) { skipped++; continue; }

    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }

    try {
      await prisma.student.create({
        data: {
          name,
          classId,
          schoolId,
          birthDate: row.birthDate ? new Date(row.birthDate) : null,
        },
      });
      existingNames.add(name.toLowerCase());
      created++;
    } catch (err: any) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'STUDENTS_IMPORTED',
      entityType: 'Student',
      entityId: classId,
      metadata: JSON.stringify({
        className: cls.name,
        total: studentRows.length,
        created,
        skipped,
        errors: errors.length,
      }),
    },
  });

  return NextResponse.json({
    success: true,
    created,
    skipped,
    total: studentRows.length,
    errors: errors.slice(0, 5),
    message: `${created} aluno${created !== 1 ? 's' : ''} importado${created !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} ignorado${skipped !== 1 ? 's' : ''} — já existentes ou vazios)` : ''}.`,
  });
}

function parseCsv(text: string): Array<{ name: string; birthDate?: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Detect if first line is header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('nome') || firstLine.includes('name') || firstLine.includes('aluno');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    // Support both comma and semicolon separators
    const parts = line.includes(';') ? line.split(';') : line.split(',');
    const name = parts[0]?.trim().replace(/^["']|["']$/g, '') || '';
    const birthDate = parts[1]?.trim().replace(/^["']|["']$/g, '') || undefined;
    return { name, birthDate };
  });
}
