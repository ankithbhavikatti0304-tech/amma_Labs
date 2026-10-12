import { api } from '@/server/http';
import { exportMyData } from '@/server/account';

export const GET = api({ auth: 'user', limit: { name: 'export', max: 5, windowSec: 3600 } }, async ({ user }) => {
  const data = await exportMyData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="amma-labs-my-data.json"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
});
