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

import { audit } from './audit';
import { ApiError } from './http-errors';

/** Remove a saved family member from the checkout shortcuts. Past orders keep their own copy of the details. */
export async function removePatient(userId: string, id: string): Promise<void> {
  const r = await db.patient.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date() } });
  if (r.count === 0) throw new ApiError(404, 'not_found', 'Not found.');
}

export async function removeAddress(userId: string, id: string): Promise<void> {
  const r = await db.address.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date() } });
  if (r.count === 0) throw new ApiError(404, 'not_found', 'Not found.');
}

/** Everything we hold about this person, in one file they can keep (DPDP: right to access). */
export async function exportMyData(userId: string) {
  const [user, patients, addresses, orders, prescriptions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, phone: true, consentAt: true, consentVersion: true, createdAt: true } }),
    db.patient.findMany({ where: { userId, deletedAt: null }, select: { name: true, age: true, gender: true } }),
    db.address.findMany({ where: { userId, deletedAt: null }, select: { line: true, pincode: true, city: true } }),
    db.order.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' },
      select: {
        code: true, status: true, createdAt: true, slotDate: true, slotLabel: true, total: true, payMode: true, paymentStatus: true, patientName: true, patientAge: true, patientGender: true, addressLine: true, pincode: true,
        items: { select: { name: true, price: true } },
        results: { select: { valueNum: true, valueText: true, flag: true, unit: true, refLow: true, refHigh: true, refText: true, decimals: true, parameter: { select: { name: true } } } },
        report: { select: { releasedAt: true, pathologistName: true } },
      },
    }),
    db.prescription.findMany({ where: { userId }, select: { originalName: true, sizeBytes: true, status: true, createdAt: true } }),
  ]);
  await audit(null, { actorId: userId, action: 'account.export', entity: 'User', entityId: userId });
  return {
    exportedAt: new Date().toISOString(),
    account: user,
    savedPatients: patients,
    savedAddresses: addresses,
    prescriptions,
    orders: orders.map(({ results, report, ...o }) => ({
      ...o,
      // Results are part of the person's own record, but only once a pathologist has released them.
      results: report ? results.map((r) => ({ parameter: r.parameter.name, value: r.valueNum?.toFixed(r.decimals) ?? r.valueText, unit: r.unit, referenceLow: r.refLow?.toString() ?? null, referenceHigh: r.refHigh?.toString() ?? null, referenceText: r.refText, flag: r.flag })) : [],
      report: report ? { releasedAt: report.releasedAt, verifiedBy: report.pathologistName } : null,
    })),
  };
}

/** The person asks us to erase their account. Lab records may have to be kept by law, so a person decides; it lands in the admin inbox. */
export async function requestDeletion(user: { id: string; name: string; phone: string }): Promise<void> {
  const open = await db.callbackRequest.findFirst({ where: { userId: user.id, note: { startsWith: 'ACCOUNT DELETION' }, status: { not: 'CLOSED' } }, select: { id: true } });
  if (open) return;
  await db.callbackRequest.create({ data: { phone: user.phone, name: user.name, userId: user.id, note: 'ACCOUNT DELETION REQUEST: patient asked to erase their account and data. Check what must be retained by law before deleting.' } });
  await audit(null, { actorId: user.id, action: 'account.deletion_requested', entity: 'User', entityId: user.id });
}
