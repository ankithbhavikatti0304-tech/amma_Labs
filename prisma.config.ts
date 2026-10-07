import { defineConfig } from 'prisma/config';

// Prisma 7 does not read .env itself. Load it for local work (Node 20.12+); in production the host sets the variables.
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env file: use the real environment */
}

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url },
});
