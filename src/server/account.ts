import 'server-only';
import { db } from './db';

export interface SavedDetails {
  patients: { id: string; name: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER'; isSelf: boolean }[];
  addresses: { id: string; line: string; pincode: string }[];
}

/** The signed-in person's own saved family members and addresses, for prefilling checkout. */
export async function getSavedDetails(userId: string): Promise<SavedDetails> {
  const [patients, addresses] = await Promise.all([
    db.patient.findMany({ where: { userId, deletedAt: null }, orderBy: [{ isSelf: 'desc' }, { createdAt: 'desc' }], take: 8, select: { id: true, name: true, age: true, gender: true, isSelf: true } }),
    db.address.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, line: true, pincode: true } }),
  ]);
  return { patients, addresses };
}
