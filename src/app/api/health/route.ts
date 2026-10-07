import { NextResponse } from 'next/server';
import { db } from '@/server/db';

/** Liveness + database reachability for uptime monitors. Reveals nothing else. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
