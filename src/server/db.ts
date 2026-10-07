import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from './env';

const g = globalThis as unknown as { __ammaPrisma?: PrismaClient };

function create(): PrismaClient {
  const e = env();
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: e.DATABASE_URL, max: e.DATABASE_POOL_MAX }) });
}

function client(): PrismaClient {
  return (g.__ammaPrisma ??= create());
}

/**
 * Prisma client, created on first use (so `next build` doesn't need a database) and shared
 * across hot reloads in development.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get: (_t, prop) => Reflect.get(client(), prop),
});
