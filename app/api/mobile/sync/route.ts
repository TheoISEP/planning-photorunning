import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appareilOuRefus, estReponse } from '@/lib/mobile/garde';
import { infosAppareil } from '@/lib/mobile/appareils';
import { construireSynchro } from '@/lib/mobile/synchro';

export const maxDuration = 30;

/**
 * POST /api/mobile/sync — tout ce que l'app garde pour le hors ligne (voir
 * lib/mobile/synchro.ts). Le corps porte les infos à jour de l'appareil
 * (version installée, mise à jour à chaud), visibles dans « App mobile ».
 */
export async function POST(req: NextRequest) {
  const a = await appareilOuRefus(req);
  if (estReponse(a)) return a;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const infos = infosAppareil(body.device);
    const maj = Object.fromEntries(Object.entries(infos).filter(([, v]) => v !== '' && v !== null));
    if (Object.keys(maj).length) await db.mobileDevice.update({ where: { id: a.deviceId }, data: maj });
    return NextResponse.json(await construireSynchro(a.user, a.deviceId), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('[mobile] sync', error);
    return NextResponse.json({ error: 'Erreur pendant la synchronisation' }, { status: 500 });
  }
}
