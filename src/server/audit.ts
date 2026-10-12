import 'server-only';
import { db } from './db';
import type { Prisma } from '@/generated/prisma/client';

type Tx = Pick<Prisma.TransactionClient, 'auditLog'>;

/**
 * Who did what to which record. `meta` is for ids and counts only: never result values, OTPs,
 * phone numbers or free text from patients.
 */
export async function audit(
  tx: Tx | null,
  e: { actorId?: string | null; action: string; entity: string; entityId: string; meta?: Prisma.InputJsonValue },
): Promise<void> {
  await (tx ?? db).auditLog.create({ data: { actorId: e.actorId ?? null, action: e.action, entity: e.entity, entityId: e.entityId, meta: e.meta ?? undefined } });
}
