/**
 * Create or promote a staff account. This is how the very first admin is made, since staff
 * cannot sign themselves up. After that, admins add people under Admin → Staff.
 *
 *   npm run staff:add -- --phone 9876543210 --name "Dr Priya Rao" --role ADMIN
 *   npm run staff:add -- --email priya@example.com --phone 9876543210 --name "Dr Priya Rao" --role ADMIN
 *
 * Use --email when the site signs in by email (LOGIN_METHOD=email); --phone is then just their contact number.
 * Roles: ADMIN, PATHOLOGIST, TECHNICIAN, PHLEBOTOMIST. They sign in with the normal code flow.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const args = Object.fromEntries(process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []));
const phone = String(args.phone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
const email = String(args.email ?? '').trim().toLowerCase();
const name = String(args.name ?? '').trim();
const role = String(args.role ?? 'ADMIN').toUpperCase();

if (!/^[6-9]\d{9}$/.test(phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) || name.length < 2 || !['ADMIN', 'PATHOLOGIST', 'TECHNICIAN', 'PHLEBOTOMIST'].includes(role)) {
  console.error('Usage: npm run staff:add -- [--email name@example.com] --phone 9876543210 --name "Full Name" --role ADMIN|PATHOLOGIST|TECHNICIAN|PHLEBOTOMIST');
  process.exit(1);
}
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 1 }) });

async function run() {
  // Find them by email when one is given, otherwise by mobile number (the phone-login identity).
  const existing = email ? await db.user.findUnique({ where: { email } }) : await db.user.findFirst({ where: { phone, email: null }, orderBy: { createdAt: 'asc' } });
  const u = existing
    ? await db.user.update({ where: { id: existing.id }, data: { role: role as 'ADMIN', active: true } })
    : await db.user.create({ data: { phone, ...(email ? { email } : {}), name, role: role as 'ADMIN' } });
  console.log(`${u.role} ready: ${u.name} (${email || `${phone.slice(0, 2)}••••${phone.slice(-4)}`}). They can sign in with a one-time code.`);
}

run().finally(() => db.$disconnect());
