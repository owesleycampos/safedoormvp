import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireActiveSchool } from '@/lib/require-active-school';

/**
 * A parent belongs to a school through their children, NOT through
 * User.schoolId — that column is only set for ADMIN users and is always
 * null for parents. Filtering by it returns an empty list every time.
 */
function parentsOfSchool(schoolId: string): Prisma.ParentWhereInput {
  return { students: { some: { student: { schoolId } } } };
}

export async function GET(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() || '';
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  // Parents not yet linked to any student are invisible to the school-scoped
  // filter, so allow explicitly asking for them (used by the link picker).
  const includeUnlinked = searchParams.get('includeUnlinked') === 'true';

  const matchesSearch: Prisma.ParentWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { phone: { contains: search } },
        ],
      }
    : {};

  const scope: Prisma.ParentWhereInput = includeUnlinked
    ? { OR: [parentsOfSchool(auth.schoolId), { students: { none: {} } }] }
    : parentsOfSchool(auth.schoolId);

  const parents = await prisma.parent.findMany({
    where: { AND: [scope, matchesSearch] },
    include: {
      user: { select: { id: true, email: true, name: true, image: true, createdAt: true } },
      students: {
        include: { student: { select: { id: true, name: true, class: { select: { name: true } } } } },
      },
    },
    orderBy: { name: 'asc' },
    take: limit,
  });

  return NextResponse.json({ parents });
}

/**
 * POST /api/parents — create a parent (User + Parent) for this school.
 * Body: { name, email, phone?, cpf?, password? }
 *
 * The password is optional: when omitted the account is created without one
 * and the parent sets it themselves through the invite link, so the admin
 * never has to invent and hand over a password.
 */
export async function POST(req: NextRequest) {
  const auth = await requireActiveSchool();
  if ('error' in auth) return auth.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = body.phone ? String(body.phone).trim() : null;
  const cpf = body.cpf ? String(body.cpf).trim() : null;
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, parent: { select: { id: true } } },
  });
  if (existingUser) {
    return NextResponse.json(
      {
        error: existingUser.parent
          ? 'Já existe um responsável com este e-mail. Busque por ele para vincular.'
          : 'Este e-mail já está em uso por outro usuário.',
      },
      { status: 409 }
    );
  }

  if (cpf) {
    const cpfTaken = await prisma.parent.findFirst({ where: { cpf }, select: { id: true } });
    if (cpfTaken) {
      return NextResponse.json({ error: 'Já existe um responsável com este CPF.' }, { status: 409 });
    }
  }

  try {
    const parent = await prisma.parent.create({
      data: {
        name,
        phone,
        cpf,
        user: {
          create: {
            email,
            name,
            role: 'PARENT',
            ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
          },
        },
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true, createdAt: true } },
        students: {
          include: { student: { select: { id: true, name: true, class: { select: { name: true } } } } },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: (auth.session.user as any)?.id ?? null,
        action: 'PARENT_CREATED',
        entityType: 'Parent',
        entityId: parent.id,
        metadata: JSON.stringify({ name, email, hasPassword: !!password }),
      },
    }).catch(() => {});

    // Não devolve o CPF (PII write-only) na resposta.
    const { cpf: _cpf, ...safeParent } = parent as any;
    return NextResponse.json(safeParent, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'E-mail ou CPF já cadastrado.' }, { status: 409 });
    }
    throw err;
  }
}
