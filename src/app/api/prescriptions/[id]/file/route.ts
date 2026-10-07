import { api } from '@/server/http';
import { readPrescription } from '@/server/prescriptions';

export const GET = api<undefined, undefined, { id: string }>({ auth: 'user' }, async ({ user, params }) => {
  const f = await readPrescription(user, params.id);
  return new Response(new Uint8Array(f.data), {
    headers: {
      'Content-Type': f.contentType,
      // Downloaded, not rendered in our origin; and locked down in case a browser renders it anyway.
      'Content-Disposition': `attachment; filename="prescription.${f.contentType === 'application/pdf' ? 'pdf' : f.contentType.split('/')[1]}"`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});
