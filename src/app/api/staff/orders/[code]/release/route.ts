import { api } from '@/server/http';
import { releaseReport } from '@/server/results';
import { orderCode } from '@/server/schemas';

export const POST = api<undefined, undefined, { code: string }>({ auth: ['PATHOLOGIST'] }, async ({ user, params }) => releaseReport(user, orderCode.parse(params.code)));
