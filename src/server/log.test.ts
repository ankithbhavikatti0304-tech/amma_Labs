import { describe, expect, it } from 'vitest';
import { _scrubForTest as scrub } from './log';

describe('log redaction', () => {
  it('redacts sensitive keys at any depth', () => {
    const out = scrub({ orderId: 'o1', otp: '123456', nested: { phone: '9876543210', valueNum: 14.2, ok: true }, list: [{ token: 'x' }] });
    expect(out).toEqual({ orderId: 'o1', otp: '[redacted]', nested: { phone: '[redacted]', valueNum: '[redacted]', ok: true }, list: [{ token: '[redacted]' }] });
  });
  it('keeps errors to name and message (no stack, which can embed values)', () => {
    expect(scrub(new Error('boom'))).toEqual({ name: 'Error', message: 'boom' });
  });
});

describe('log redaction of database errors', () => {
  it('drops everything after the first line, where Prisma echoes submitted data', () => {
    const e = Object.assign(new Error('Invalid `prisma.patient.create()` invocation:\n{ data: { name: "Lakshmi Rao", age: 34 } }'), { code: 'P2002', name: 'PrismaClientKnownRequestError' });
    expect(JSON.stringify(scrub(e))).not.toContain('Lakshmi');
    expect(scrub(e)).toEqual({ name: 'PrismaClientKnownRequestError', code: 'P2002', message: 'Invalid `prisma.patient.create()` invocation:' });
  });
});
