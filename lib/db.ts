import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma.
 *
 * Em serverless (Vercel) sobre Neon, a conexão TCP direta faz cada request
 * abrir uma conexão nova e o pool efetivo vira ~1 — então as ~9 queries do
 * dashboard, mesmo em Promise.all, rodavam em série (~1,9s). O driver
 * serverless do Neon (HTTP) manda cada query como um fetch independente:
 * elas voltam a rodar em paralelo de verdade e sem custo de handshake.
 *
 * Só entra quando o banco é Neon (produção). No Postgres local do docker
 * (testes) segue o cliente normal, que o driver HTTP do Neon não atende.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL || '';
  const isNeon = url.includes('neon.tech');

  if (isNeon) {
    // require dinâmico: evita carregar o driver quando não é Neon (local).
    const { Pool, neonConfig } = require('@neondatabase/serverless');
    const { PrismaNeon } = require('@prisma/adapter-neon');
    const ws = require('ws');
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
