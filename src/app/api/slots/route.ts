import { api } from '@/server/http';
import { listSlotDays } from '@/server/slots';

export const GET = api({}, async () => ({ days: await listSlotDays() }));
