import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },
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
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).schoolId = token.schoolId;
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
