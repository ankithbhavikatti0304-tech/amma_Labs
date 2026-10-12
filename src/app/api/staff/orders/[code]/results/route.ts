import { api } from '@/server/http';
import { saveResults } from '@/server/results';
import { orderCode, resultsSchema } from '@/server/schemas';

export const PUT = api<typeof resultsSchema, undefined, { code: string }>({ auth: ['TECHNICIAN'], body: resultsSchema }, async ({ user, body, params }) => saveResults(user, orderCode.parse(params.code), body.entries));
