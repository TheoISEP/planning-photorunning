import { NextRequest, NextResponse } from 'next/server';
import { appareilOuRefus, estReponse } from '@/lib/mobile/garde';
import { briefDuLien, briefsComplets } from '@/lib/mobile/sources';

/**
 * POST /api/mobile/lien { token } — un lien de partage de brief ouvert sur un
 * téléphone où l'app est installée. Le lien est public par nature : qui l'a
 * reçu peut lire le brief, dans l'app comme sur le web.
 */
export async function POST(req: NextRequest) {
  const a = await appareilOuRefus(req);
  if (estReponse(a)) return a;
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return NextResponse.json({ error: 'Lien invalide' }, { status: 400 });
    const briefId = await briefDuLien(token);
    if (!briefId) return NextResponse.json({ error: 'Ce lien n’est plus valide.' }, { status: 404 });
    const [brief] = await briefsComplets([briefId]);
    return brief ? NextResponse.json({ brief: { ...(brief as object), courseIds: [], parLien: true } }) : NextResponse.json({ error: 'Brief introuvable' }, { status: 404 });
  } catch (error) {
    console.error('[mobile] lien', error);
    return NextResponse.json({ error: 'Briefs momentanément indisponibles' }, { status: 503 });
  }
}
