import { NextRequest, NextResponse } from 'next/server';
import { decode } from 'next-auth/jwt';
import { prisma } from '@/lib/db';

/**
 * POST /api/hq/restore — volta da impersonação para a sessão original do
 * superadmin (guardada no cookie httpOnly hq-return).
 */

const SESSION_COOKIE = process.env.NEXTAUTH_URL?.startsWith('https')
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token';
const RETURN_COOKIE = 'hq-return';
const MARKER_COOKIE = 'hq-imp';

export async function POST(req: NextRequest) {
  const original = req.cookies.get(RETURN_COOKIE)?.value;
  if (!original) {
    return NextResponse.json({ error: 'Nenhuma sessão original para restaurar.' }, { status: 400 });
  }

  // Só restaura se o token guardado é mesmo de um SUPERADMIN válido.
  const decoded = await decode({ token: original, secret: process.env.NEXTAUTH_SECRET! }).catch(() => null);
  if (!decoded || (decoded as any).role !== 'SUPERADMIN') {
    const res = NextResponse.json({ error: 'Sessão original inválida ou expirada. Entre de novo.' }, { status: 401 });
    res.cookies.delete(RETURN_COOKIE);
    res.cookies.delete(MARKER_COOKIE);
    return res;
  }

  await prisma.auditLog.create({
    data: {
      userId: (decoded as any).sub ?? null,
      action: 'HQ_IMPERSONATE_END',
      entityType: 'User',
      entityId: (decoded as any).sub ?? null,
    },
  }).catch(() => {});

  const secure = SESSION_COOKIE.startsWith('__Secure-');
  const res = NextResponse.json({ ok: true, dest: '/hq' });
  res.cookies.set(SESSION_COOKIE, original, {
    httpOnly: true, sameSite: 'lax', secure, path: '/',
  });
  res.cookies.delete(RETURN_COOKIE);
  res.cookies.delete(MARKER_COOKIE);
  return res;
}
