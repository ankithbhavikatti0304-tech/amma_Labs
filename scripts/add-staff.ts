/**
 * Create or promote a staff account. This is how the very first admin is made, since staff
 * cannot sign themselves up. After that, admins add people under Admin → Staff.
 *
 *   npm run staff:add -- --phone 9876543210 --name "Dr Priya Rao" --role ADMIN
 *
 * Roles: ADMIN, PATHOLOGIST, TECHNICIAN, PHLEBOTOMIST. They sign in with the normal OTP flow.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const args = Object.fromEntries(process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []));
const phone = String(args.phone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
const name = String(args.name ?? '').trim();
const role = String(args.role ?? 'ADMIN').toUpperCase();

if (!/^[6-9]\d{9}$/.test(phone) || name.length < 2 || !['ADMIN', 'PATHOLOGIST', 'TECHNICIAN', 'PHLEBOTOMIST'].includes(role)) {
  console.error('Usage: npm run staff:add -- --phone 9876543210 --name "Full Name" --role ADMIN|PATHOLOGIST|TECHNICIAN|PHLEBOTOMIST');
  process.exit(1);
}
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 1 }) });

db.user
  .upsert({ where: { phone }, create: { phone, name, role: role as 'ADMIN' }, update: { role: role as 'ADMIN', active: true } })
  .then((u) => console.log(`${u.role} ready: ${u.name} (${phone.slice(0, 2)}••••${phone.slice(-4)}). They can sign in with an OTP.`))
  .finally(() => db.$disconnect());
