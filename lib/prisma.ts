import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// Força IPv4 para evitar lentidão na Neon/AWS
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignora se não suportado
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;