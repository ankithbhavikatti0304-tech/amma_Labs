import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env on its own. Node's --env-file is used by the npm scripts;
// here we just read whatever is already in process.env.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url },
});
