import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appareilOuRefus, estReponse } from '@/lib/mobile/garde';

// POST /api/mobile/logout — l'app se déconnecte : son jeton ne vaut plus rien.
export async function POST(req: NextRequest) {
  const a = await appareilOuRefus(req);
  if (estReponse(a)) return NextResponse.json({ success: true });
  await db.mobileDevice.update({ where: { id: a.deviceId }, data: { revokedAt: new Date(), revokedBy: 'self' } });
  return NextResponse.json({ success: true });
}
