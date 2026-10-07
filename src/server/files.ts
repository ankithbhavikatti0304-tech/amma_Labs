import 'server-only';

export interface Sniffed {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  ext: 'jpg' | 'png' | 'webp' | 'pdf';
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Decide what a file really is from its first bytes. The browser's Content-Type and the file
 * name are chosen by the sender, so they are never believed.
 */
export function sniff(b: Buffer): Sniffed | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

/** A display-safe version of an uploaded file name: no path, no control characters, bounded length. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  // eslint-disable-next-line no-control-regex
  const s = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim().slice(0, 100);
  return s || 'file';
}
