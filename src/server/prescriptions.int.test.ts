import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { jar, mockNextHeaders } from '../../test/next-mocks';
import { resetDb } from '../../test/db';
import { db } from './db';
import { createSession } from './auth/session';
import { sessionCookieName } from './auth/cookie';
import * as upload from '../app/api/prescriptions/route';
import * as file from '../app/api/prescriptions/[id]/file/route';
import type { Role } from '@/generated/prisma/enums';

mockNextHeaders();

type H = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const tokens = new Map<string, string>();

async function as(name: string, role: Role = 'PATIENT') {
  const u = await db.user.upsert({ where: { phone: `97${name.length}000000${role.length}` }, create: { phone: `97${name.length}000000${role.length}`, name, role }, update: {} });
  const t = tokens.get(u.id) ?? (await createSession(u.id, role)).token;
  tokens.set(u.id, t);
  jar.clear();
  jar.set(sessionCookieName(), { value: t, opts: {} });
  return u;
}

const send = (data: Buffer | string, name = 'rx.png', type = 'image/png') => {
  const fd = new FormData();
  fd.set('file', new File([data as BlobPart], name, { type }));
  return (upload.POST as H)(new NextRequest('http://localhost:3000/api/prescriptions', { method: 'POST', headers: { origin: 'http://localhost:3000' }, body: fd }), { params: Promise.resolve({}) });
};
const download = (id: string) => (file.GET as H)(new NextRequest(`http://localhost:3000/api/prescriptions/${id}/file`), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetDb();
  tokens.clear();
});

describe('prescription upload', () => {
  it('accepts a real image, stores it privately and records it', async () => {
    const u = await as('Patient');
    const r = await send(PNG);
    expect(r.status).toBe(200);
    const row = await db.prescription.findFirstOrThrow();
    expect(row).toMatchObject({ userId: u.id, mimeType: 'image/png', status: 'NEW' });
    expect(row.storageKey).toMatch(/^prescriptions\/[^/]+\/[A-Za-z0-9-]+\.png$/);
  });

  it('judges the file by its bytes, not its name or declared type', async () => {
    await as('Patient');
    expect((await send('<script>alert(1)</script>', 'rx.png', 'image/png')).status).toBe(415);
    expect((await send('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'rx.png', 'image/png')).status).toBe(415);
    expect((await send('MZ\x90\x00 not really', 'rx.pdf', 'application/pdf')).status).toBe(415);
    expect(await db.prescription.count()).toBe(0);
  });

  it('refuses empty and oversize files', async () => {
    await as('Patient');
    expect((await send(Buffer.alloc(0))).status).toBe(400);
    expect((await send(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]))).status).toBe(413);
  });

  it('needs a login', async () => {
    jar.clear();
    expect((await send(PNG)).status).toBe(401);
  });

  it('limits how many a person can send per hour', async () => {
    await as('Patient');
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await send(PNG)).status);
    expect(codes.filter((c) => c === 200)).toHaveLength(6);
    expect(codes.slice(6)).toEqual([429, 429]);
  });
});

describe('prescription download', () => {
  async function uploaded() {
    const owner = await as('Owner');
    await send(PNG);
    return { owner, id: (await db.prescription.findFirstOrThrow()).id };
  }

  it('the owner and staff can download it, as an attachment locked down against rendering', async () => {
    const { id } = await uploaded();
    await as('Owner');
    for (const who of [['Owner', 'PATIENT'], ['Receptionist', 'ADMIN']] as const) {
      await as(who[0], who[1]);
      const r = await download(id);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-disposition')).toMatch(/^attachment/);
      expect(r.headers.get('content-security-policy')).toContain('sandbox');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(Buffer.from(await r.arrayBuffer()).equals(PNG)).toBe(true);
    }
  });

  it("another patient gets 'not found'", async () => {
    const { id } = await uploaded();
    await as('Stranger');
    expect((await download(id)).status).toBe(404);
  });

  it('every open is audited', async () => {
    const { id } = await uploaded();
    await as('Owner');
    await download(id);
    const log = await db.auditLog.findMany({ where: { action: 'prescription.view' } });
    expect(log).toHaveLength(1);
    expect(log[0]!.entityId).toBe(id);
  });
});
