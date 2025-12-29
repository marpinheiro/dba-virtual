import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// Tenta forçar IPv4. O bloco try/catch serve para não quebrar
// caso o Node.js seja uma versão muito antiga.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Se der erro (ex: função não existe), apenas ignora e segue a vida.
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // logs opcionais para ver o que o prisma está fazendo no terminal
    log: ['query', 'error', 'warn'], 
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;