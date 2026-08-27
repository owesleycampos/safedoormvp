import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { encode } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/hq/impersonate — { userId }
 *
 * O dono do SaaS abre a tela COMO o usuário (admin de escola ou
 * responsável) para suporte, testes e correções — sem pedir senha de
 * ninguém. A sessão original fica guardada num cookie httpOnly e o
 * banner fixo oferece a volta. Tudo auditado.
 */

const SESSION_COOKIE = process.env.NEXTAUTH_URL?.startsWith('https')
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token';
const RETURN_COOKIE = 'hq-return';
const MARKER_COOKIE = 'hq-imp'; // legível pelo banner no cliente
const MAX_AGE = 60 * 60; // 1h de impersonação, de propósito curta

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'Informe o usuário.' }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true, name: true, email: true, role: true, schoolId: true },
  });
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  if (target.role === 'SUPERADMIN') {
    return NextResponse.json({ error: 'Não faz sentido impersonar outro superadmin.' }, { status: 400 });
  }

  const secret = process.env.NEXTAUTH_SECRET!;
  const originalToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!originalToken) {
    return NextResponse.json({ error: 'Sessão original não encontrada.' }, { status: 400 });
  }

  // Prazo ABSOLUTO da impersonação. O maxAge do token/cookie sozinho não
  // segura 1h: a sessão JWT do NextAuth é rolante e reescreve o cookie com o
  // maxAge global (7 dias) no próximo request do usuário impersonado. Por
  // isso o teto real é este timestamp, verificado no callback de sessão.
  const impExp = Date.now() + MAX_AGE * 1000;
  const impersonated = await encode({
    secret,
    maxAge: MAX_AGE,
    token: {
      sub: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      schoolId: target.schoolId,
      impersonatedBy: (session.user as any)?.id,
      impExp,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any)?.id,
      action: 'HQ_IMPERSONATE_START',
      entityType: 'User',
      entityId: target.id,
      metadata: JSON.stringify({ email: target.email, role: target.role }),
    },
  });

  const dest = target.role === 'ADMIN' ? '/admin/dashboard' : '/pwa/children';
  const res = NextResponse.json({ ok: true, dest, name: target.name || target.email });
  const secure = SESSION_COOKIE.startsWith('__Secure-');
  res.cookies.set(SESSION_COOKIE, impersonated, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: MAX_AGE,
  });
  res.cookies.set(RETURN_COOKIE, originalToken, {
    // Vive mais que a sessão impersonada (1h): senão, ao expirar a
    // impersonação o dono perdia também a própria sessão e caía no login.
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 8 * 60 * 60,
  });
  // Sem encodeURIComponent aqui: o next/server já codifica o valor do
  // cookie, e codificar de novo deixava "Maria%20Silva" na faixa.
  // Vive exatamente o tempo da impersonação (MAX_AGE): a faixa não pode
  // continuar afirmando "você está vendo como X" depois que a sessão
  // impersonada já expirou.
  res.cookies.set(MARKER_COOKIE, target.name || target.email || 'usuário', {
    httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: MAX_AGE,
  });
  return res;
}
