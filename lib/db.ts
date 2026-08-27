import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma.
 *
 * Em serverless (Vercel) sobre Neon, a conexão TCP direta faz cada request
 * abrir uma conexão nova e o pool efetivo vira ~1 — então as ~9 queries do
 * dashboard, mesmo em Promise.all, rodavam em série (~1,4s). O driver
 * serverless do Neon manda cada query como um fetch HTTP independente:
 * elas voltam a rodar em paralelo (medido: ~200ms) e sem handshake por
 * request.
 *
 * poolQueryViaFetch=true é ESSENCIAL: sem ele o pool WebSocket morre entre
 * os congelamentos do serverless ("Connection terminated unexpectedly") e
 * derruba o login. Com ele, cada query é um fetch stateless; as transações
 * (array e interativa) seguem pelo pool, criado sob demanda — ambas
 * testadas contra o Neon de produção antes deste commit.
 *
 * Só entra quando o banco é Neon (produção). No Postgres local do docker
 * (testes) segue o cliente padrão, que o driver HTTP do Neon não atende.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL || '';
  const isNeon = url.includes('neon.tech');

  if (isNeon) {
    const { Pool, neonConfig } = require('@neondatabase/serverless');
    const { PrismaNeon } = require('@prisma/adapter-neon');
    const ws = require('ws');
    neonConfig.webSocketConstructor = ws;
    neonConfig.poolQueryViaFetch = true;
    const adapter = new PrismaNeon(new Pool({ connectionString: url }));
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
