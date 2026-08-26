import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkStudentCap } from '@/lib/plan-limits';

interface ImportRow {
  name: string;
  birthDate?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
}

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
  let studentRows: ImportRow[];

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

  // Mapa nome→id para deduplicar E para vincular responsáveis também a
  // alunos que já existiam (o caso "onboarding em massa" de uma turma que
  // já foi importada sem responsáveis).
  const existingStudents = await prisma.student.findMany({
    where: { schoolId, classId, isActive: true },
    select: { id: true, name: true },
  });
  const byName = new Map(existingStudents.map((s) => [s.name.toLowerCase().trim(), s.id]));

  // Teto do plano vale também para o caminho em massa — senão o import era
  // a porta dos fundos do limite.
  const newRows = studentRows.filter((r) => r.name?.trim() && !byName.has(r.name.trim().toLowerCase())).length;
  const capError = await checkStudentCap(schoolId, newRows);
  if (capError) return NextResponse.json({ error: capError }, { status: 403 });

  let created = 0;
  let skipped = 0;
  let parentsCreated = 0;
  let parentsLinked = 0;
  const errors: string[] = [];

  for (const row of studentRows) {
    const name = row.name?.trim();
    if (!name) { skipped++; continue; }
    const key = name.toLowerCase();

    let studentId = byName.get(key) ?? null;
    if (studentId) {
      skipped++;
    } else {
      try {
        const st = await prisma.student.create({
          data: {
            name,
            classId,
            schoolId,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
          },
          select: { id: true },
        });
        studentId = st.id;
        byName.set(key, st.id);
        created++;
      } catch (err: any) {
        errors.push(`${name}: ${err.message}`);
        continue;
      }
    }

    // ── Responsável em massa ─────────────────────────────────────────
    // Com e-mail na planilha, a conta nasce SEM senha e já vinculada: o
    // link de convite da turma vira só o "primeiro acesso" (definir a
    // senha), sem o responsável precisar procurar o filho na lista.
    const email = row.parentEmail?.trim().toLowerCase();
    if (studentId && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      try {
        let user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true, parent: { select: { id: true } } },
        });
        let parentId = user?.parent?.id ?? null;
        if (user && !user.parent && user.role !== 'PARENT') {
          errors.push(`${name}: e-mail ${email} pertence a outro tipo de usuário`);
        } else if (!user) {
          const parent = await prisma.parent.create({
            data: {
              name: row.parentName?.trim() || 'Responsável',
              phone: row.parentPhone?.trim() || null,
              user: { create: { email, name: row.parentName?.trim() || null, role: 'PARENT' } },
            },
            select: { id: true },
          });
          parentId = parent.id;
          parentsCreated++;
        } else if (user && !parentId) {
          const parent = await prisma.parent.create({
            data: { userId: user.id, name: row.parentName?.trim() || 'Responsável', phone: row.parentPhone?.trim() || null },
            select: { id: true },
          });
          parentId = parent.id;
        }
        if (parentId) {
          const isFirst = (await prisma.studentParent.count({ where: { studentId } })) === 0;
          await prisma.studentParent.createMany({
            data: [{ studentId, parentId, relationship: 'Responsável', isPrimary: isFirst }],
            skipDuplicates: true,
          });
          parentsLinked++;
        }
      } catch (err: any) {
        errors.push(`${name} (responsável): ${err.message}`);
      }
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

  const parts = [`${created} aluno${created !== 1 ? 's' : ''} importado${created !== 1 ? 's' : ''}`];
  if (parentsLinked > 0) parts.push(`${parentsLinked} responsável${parentsLinked !== 1 ? 'is' : ''} vinculado${parentsLinked !== 1 ? 's' : ''}`);
  if (skipped > 0) parts.push(`${skipped} já existente${skipped !== 1 ? 's' : ''}`);

  return NextResponse.json({
    success: true,
    created,
    skipped,
    parentsCreated,
    parentsLinked,
    total: studentRows.length,
    errors: errors.slice(0, 5),
    message: parts.join(', ') + '.',
  });
}

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const split = (line: string) =>
    (line.includes(';') ? line.split(';') : line.split(',')).map((c) =>
      c.trim().replace(/^["']|["']$/g, '')
    );

  // Detect if first line is header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('nome') || firstLine.includes('name') || firstLine.includes('aluno');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // O caminho CSV cru declarava os campos de responsável e jogava todos
  // fora — só nome e data sobreviviam. Mapeia pelo cabeçalho, com o mesmo
  // vocabulário que o dialog de import auto-detecta.
  let col = { birth: 1, pName: -1, pEmail: -1, pPhone: -1 };
  if (hasHeader) {
    const headers = split(lines[0]).map((h) => h.toLowerCase());
    const find = (...terms: string[]) =>
      headers.findIndex((h) => terms.some((t) => h.includes(t)));
    const birth = find('nascimento', 'birth', 'data');
    if (birth >= 0) col.birth = birth;
    col.pEmail = find('email', 'e-mail');
    col.pName = find('responsavel', 'responsável', 'mae', 'mãe', 'pai');
    col.pPhone = find('telefone', 'celular', 'whatsapp', 'fone');
  }

  return dataLines.map((line) => {
    const parts = split(line);
    const pick = (i: number) => (i >= 0 ? parts[i] || undefined : undefined);
    return {
      name: parts[0] || '',
      birthDate: pick(col.birth),
      parentName: pick(col.pName),
      parentEmail: pick(col.pEmail),
      parentPhone: pick(col.pPhone),
    };
  });
}
