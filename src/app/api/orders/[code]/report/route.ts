import { api } from '@/server/http';
import { getReportPdf } from '@/server/results';
import { orderCode } from '@/server/schemas';

export const GET = api<undefined, undefined, { code: string }>({ auth: 'user', limit: { name: 'report-pdf', max: 30, windowSec: 3600 } }, async ({ user, params }) => {
  const code = orderCode.parse(params.code);
  const pdf = await getReportPdf(user, code);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Amma-Labs-report-${code}.pdf"`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});
