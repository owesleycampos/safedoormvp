import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { isImpersonationExpired } from '@/lib/impersonation';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  // maxAge explícito: sessão de 7 dias (era o default de 30). Reduz a
  // janela de um token roubado / de papel desatualizado.
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  // Cookies endurecidos: em produção o NextAuth já prefixa __Secure- e usa
  // httpOnly/secure/sameSite=lax; explicitar deixa a intenção clara e
  // garante o comportamento independente de detecção de ambiente.
  useSecureCookies: process.env.NODE_ENV === 'production',
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { school: true, parent: true },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.schoolId = (user as any).schoolId;
      } else if (!token.schoolId && token.sub && token.role === 'PARENT') {
        // O vínculo pelo link da turma atribui a escola a uma conta que pode
        // já estar logada — sem esta releitura, o JWT ficava com schoolId
        // nulo até o próximo login e as inscrições de push nasciam órfãs.
        // Custo: 1 consulta apenas para tokens ainda sem escola.
        const fresh = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { schoolId: true, role: true },
        }).catch(() => null);
        if (fresh?.schoolId) {
          token.schoolId = fresh.schoolId;
          token.role = fresh.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        // Impersonação tem prazo ABSOLUTO (impExp). Como a sessão JWT é
        // rolante e o NextAuth reescreve o cookie com o maxAge global (7 dias)
        // a cada request, o teto de 1h só vale se for verificado aqui:
        // passado o prazo, a sessão impersonada deixa de autorizar (id/role em
        // branco → os guards devolvem 401) e o dono volta pelo banner.
        if (isImpersonationExpired(token as any, Date.now())) {
          return session;
        }
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).schoolId = token.schoolId;
        (session.user as any).impersonatedBy = (token as any).impersonatedBy ?? null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After sign-in, redirect based on role
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl;
    },
  },
  events: {
    async signIn({ user }) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_SIGNIN',
          entityType: 'User',
          entityId: user.id,
        },
      });
    },
  },
};
