import { NextRequest, NextResponse } from 'next/server';
import { appareilOuRefus, estReponse } from '@/lib/mobile/garde';
import { briefsVisibles } from '@/lib/mobile/synchro';
import { briefsComplets } from '@/lib/mobile/sources';

export const maxDuration = 30;

/**
 * POST /api/mobile/briefs { ids } — briefs complets (sections, fichiers à
 * télécharger). Un photographe n'obtient que ceux qu'il a le droit de lire :
 * la liste est recalculée ici, jamais crue sur parole. 20 par appel.
 */
export async function POST(req: NextRequest) {
  const a = await appareilOuRefus(req);
  if (estReponse(a)) return a;
  try {
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const demandes = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
    if (demandes.length === 0) return NextResponse.json({ briefs: [] });
    const visibles = await briefsVisibles(a.user);
    if (!visibles) return NextResponse.json({ error: 'Briefs momentanément indisponibles' }, { status: 503 });
    const permis = new Set(visibles.index.map((b) => b.id));
    const ids = demandes.filter((id) => permis.has(id));
    const briefs = ids.length ? await briefsComplets(ids) : [];
    return NextResponse.json({ briefs: (briefs as { id: string }[]).map((b) => ({ ...b, courseIds: visibles.courseIdsParBrief[b.id] ?? [] })) });
  } catch (error) {
    console.error('[mobile] briefs', error);
    return NextResponse.json({ error: 'Briefs momentanément indisponibles' }, { status: 503 });
  }
}
