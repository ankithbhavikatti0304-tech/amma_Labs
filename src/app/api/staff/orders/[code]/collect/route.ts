import { api } from '@/server/http';
import { collectSample } from '@/server/samples';
import { collectSchema, orderCode } from '@/server/schemas';

export const POST = api<typeof collectSchema, undefined, { code: string }>({ auth: ['PHLEBOTOMIST'], body: collectSchema }, async ({ user, body, params }) => collectSample(user, orderCode.parse(params.code), body));
