import 'server-only';
import { db } from './db';
import { env } from './env';
import { log } from './log';
import { defer } from './after';
import type { Prisma } from '@/generated/prisma/client';
import type { NotificationChannel } from '@/generated/prisma/enums';

/**
 * Booking messages by SMS and/or WhatsApp. The message is first written to the Notification
 * table (the outbox), then sent; a failure leaves it there for the scheduled retry. A failed
 * message never fails the booking. Variables are order code, slot and a link: no result values.
 *
 * Both channels need pre-approved templates (DLT for SMS, Meta for WhatsApp). Text to register:
 *   booking_confirmed → "Amma Labs: your booking {{code}} is confirmed for {{slot}}. Track it: {{url}}"
 *   sample_collected  → "Amma Labs: the sample for {{code}} is collected. We will message you when your report is ready."
 *   report_ready      → "Amma Labs: your report for {{code}} is ready. View it: {{url}}"
 */
export type Template = 'booking_confirmed' | 'sample_collected' | 'report_ready';

/** Order of variables each template takes, which is the order the provider's placeholders must follow. */
const VARS: Record<Template, string[]> = { booking_confirmed: ['code', 'slot', 'url'], sample_collected: ['code'], report_ready: ['code', 'url'] };

function channels(): NotificationChannel[] {
  const e = env();
  return [...(e.SMS_PROVIDER === 'msg91' || e.SMS_PROVIDER === 'dev' ? (['SMS'] as const) : []), ...(e.WHATSAPP_PROVIDER === 'cloud' ? (['WHATSAPP'] as const) : [])];
}

async function sendSms(phone: string, template: Template, vars: string[]) {
  const e = env();
  if (e.SMS_PROVIDER === 'dev') return; // nothing leaves the machine
  const id = { booking_confirmed: e.MSG91_TEMPLATE_BOOKING_CONFIRMED, sample_collected: e.MSG91_TEMPLATE_SAMPLE_COLLECTED, report_ready: e.MSG91_TEMPLATE_REPORT_READY }[template];
  if (!id) throw new Error(`no SMS template id configured for ${template}`);
  const res = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: e.MSG91_AUTH_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ template_id: id, recipients: [{ mobiles: `91${phone}`, ...Object.fromEntries(vars.map((v, i) => [`VAR${i + 1}`, v])) }] }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`sms gateway ${res.status}`);
}

async function sendWhatsApp(phone: string, template: Template, vars: string[]) {
  const e = env();
  const res = await fetch(`https://graph.facebook.com/v21.0/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${e.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: `91${phone}`,
      type: 'template',
      template: { name: `al_${template}`, language: { code: 'en' }, components: vars.length ? [{ type: 'body', parameters: vars.map((text) => ({ type: 'text', text })) }] : [] },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`whatsapp ${res.status}`);
}

async function deliver(n: { id: string; phone: string; channel: NotificationChannel; template: string; variables: Prisma.JsonValue; attempts: number }): Promise<void> {
  const t = n.template as Template;
  const v = (n.variables ?? {}) as Record<string, string>;
  const vars = (VARS[t] ?? []).map((k) => String(v[k] ?? ''));
  try {
    await (n.channel === 'SMS' ? sendSms : sendWhatsApp)(n.phone, t, vars);
    await db.notification.update({ where: { id: n.id }, data: { status: 'SENT', sentAt: new Date(), attempts: n.attempts + 1, lastError: null } });
  } catch (err) {
    await db.notification.update({ where: { id: n.id }, data: { status: 'FAILED', attempts: n.attempts + 1, lastError: (err instanceof Error ? err.message : 'error').slice(0, 200) } });
    log.warn('notification failed', { channel: n.channel, template: n.template });
  }
}

/** Queue a message on every enabled channel and try to send it. Never throws. */
export async function queueNotification(input: { phone: string; template: Template; variables: Record<string, string> }): Promise<void> {
  try {
    const rows = await Promise.all(channels().map((channel) => db.notification.create({ data: { phone: input.phone, channel, template: input.template, variables: input.variables } })));
    await defer(async () => { for (const r of rows) await deliver(r); });
  } catch (err) {
    log.error('could not queue notification', { err });
  }
}

/** Messages that failed or never went out: try again, a few times, for a day. Called by the cron job. */
export async function retryNotifications(): Promise<number> {
  const rows = await db.notification.findMany({ where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: 5 }, createdAt: { gt: new Date(Date.now() - 86_400_000) } }, orderBy: { createdAt: 'asc' }, take: 100 });
  for (const r of rows) await deliver(r);
  return rows.length;
}

/** Look up an order's phone and code, then queue the message. */
export async function notifyOrder(orderId: string, template: Template): Promise<void> {
  const o = await db.order.findUnique({ where: { id: orderId }, include: { user: { select: { phone: true } } } });
  if (!o) return;
  const url = `${env().APP_URL}/orders/${o.code}${template === 'report_ready' ? '/report' : ''}`;
  await queueNotification({ phone: o.user.phone, template, variables: { code: o.code, slot: `${o.slotLabel}, ${o.slotDate.toISOString().slice(0, 10)}`, url } });
}
