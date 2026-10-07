import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './db';
import { LAB_DEFAULTS, type LabSettings } from '@/config/lab';
import type { PublicSettings } from '@/lib/catalogue';

const KEYS = Object.keys(LAB_DEFAULTS) as (keyof LabSettings)[];

export async function loadSettings(): Promise<LabSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: KEYS as string[] } } });
  const out: Record<string, unknown> = { ...LAB_DEFAULTS };
  for (const r of rows) {
    const k = r.key as keyof LabSettings;
    // Ignore a stored value of the wrong type rather than break the site.
    if (typeof r.value === typeof LAB_DEFAULTS[k]) out[k] = r.value;
  }
  return out as unknown as LabSettings;
}

/** Lab details and fees: code defaults overridden by Admin → Settings. */
export const getSettings = unstable_cache(loadSettings, ['settings-v1'], { tags: ['settings'], revalidate: 300 });

export const toPublic = (s: LabSettings): PublicSettings => ({
  phone: s.phone,
  whatsapp: s.whatsapp,
  hours: s.hours,
  freeCollectionAbove: s.freeCollectionAbove,
  collectionFee: s.collectionFee,
  hardCopyFee: s.hardCopyFee,
});
