import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { storage } from './storage';
import { audit } from './audit';
import { ApiError } from './http-errors';
import { cleanFileName, MAX_UPLOAD_BYTES, sniff } from './files';
import type { SessionUser } from './auth/session';

export async function savePrescription(user: SessionUser, file: File): Promise<{ id: string }> {
  if (file.size === 0) throw new ApiError(400, 'empty_file', 'That file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'file_too_large', 'That file is over 5 MB. Please choose a smaller one.');
  const data = Buffer.from(await file.arrayBuffer());
  const kind = sniff(data);
  if (!kind) throw new ApiError(415, 'file_type', 'Please upload a JPG, PNG or WebP photo, or a PDF.');

  const key = `prescriptions/${user.id}/${randomUUID()}.${kind.ext}`;
  await storage().put(key, data, kind.mime);
  try {
    const row = await db.prescription.create({ data: { userId: user.id, storageKey: key, mimeType: kind.mime, sizeBytes: data.length, originalName: cleanFileName(file.name) }, select: { id: true } });
    await audit(null, { actorId: user.id, action: 'prescription.upload', entity: 'Prescription', entityId: row.id });
    return row;
  } catch (e) {
    await storage().delete(key).catch(() => undefined); // no orphaned file if the row failed
    throw e;
  }
}

/** Staff open a prescription; owners can open their own. Every open is audited. */
export async function readPrescription(user: SessionUser, id: string) {
  const p = await db.prescription.findUnique({ where: { id } });
  const allowed = p && (p.userId === user.id || user.role !== 'PATIENT');
  if (!p || !allowed) throw new ApiError(404, 'not_found', 'Not found.');
  const stored = await storage().get(p.storageKey);
  if (!stored) throw new ApiError(404, 'not_found', 'Not found.');
  await audit(null, { actorId: user.id, action: 'prescription.view', entity: 'Prescription', entityId: p.id });
  return { ...stored, contentType: p.mimeType, name: p.originalName };
}
