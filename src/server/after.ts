import 'server-only';
import { after } from 'next/server';

/**
 * Run follow-up work (sending messages) after the response is on its way, so a slow gateway
 * never slows a patient down. Where there is no request to hang it on (tests, scripts), run it now.
 */
export async function defer(task: () => Promise<unknown>): Promise<void> {
  if (process.env.NODE_ENV === 'test') return void (await task());
  try {
    after(task);
  } catch {
    await task();
  }
}
