import { NextRequest, NextResponse } from 'next/server';
import { appareilOuRefus, estReponse } from '@/lib/mobile/garde';
import { lienDePartage } from '@/lib/mobile/sources';

// POST /api/mobile/partage { briefId } — admin : lien de partage du brief
// (l'actif, ou un nouveau), pour l'envoyer depuis le téléphone.
export async function POST(req: NextRequest) {
  const a = await appareilOuRefus(req);
  if (estReponse(a)) return a;
  if (a.user.role !== 'admin') return NextResponse.json({ error: 'Réservé aux admins' }, { status: 403 });
  try {
    const body = (await req.json().catch(() => ({}))) as { briefId?: unknown };
    if (typeof body.briefId !== 'string' || !body.briefId) return NextResponse.json({ error: 'briefId requis' }, { status: 400 });
    return NextResponse.json(await lienDePartage(body.briefId));
  } catch (error) {
    console.error('[mobile] partage', error);
    return NextResponse.json({ error: 'Briefs momentanément indisponibles' }, { status: 503 });
  }
}
