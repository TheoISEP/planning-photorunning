import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';

/**
 * APPELS DE L'APP DES BRIEFS → PLANNING (clé partagée BRIEFS_INTEGRATION_KEY,
 * la même que PLANNING_INTEGRATION_KEY côté briefs). Sert au bouton
 * « Importer du planning » des briefs (Théo, 06/10/2026 : les courses jusqu'à
 * fin décembre ont été créées ici avant la liaison).
 *
 *  - GET  → les courses non archivées, avec leurs photographes validés /
 *           référents (lignes publiées) et le brief déjà lié s'il existe.
 *  - POST { courseId, briefId, briefUrl } → mémorise le brief d'une course.
 */

function autorise(req: NextRequest): boolean {
  const attendu = process.env.BRIEFS_INTEGRATION_KEY ?? '';
  const recu = req.headers.get('x-integration-key') ?? '';
  if (!attendu || attendu.length < 16 || recu.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

export async function GET(req: NextRequest) {
  if (!autorise(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const courses = await db.course.findMany({
    where: { archived: false },
    orderBy: { dateDebut: 'asc' },
    select: {
      id: true,
      nom: true,
      ville: true,
      dateDebut: true,
      dateFin: true,
      statutTraitement: true,
      annulee: true,
      archived: true,
      briefId: true,
      briefUrl: true,
      disponibilites: {
        where: { published: true, decision: { in: ['validated', 'teamLeader'] } },
        select: {
          decision: true,
          photographe: { select: { id: true, prenom: true, nom: true, name: true, telephone: true } },
        },
      },
    },
  });
  return NextResponse.json({
    courses: courses.map((c) => {
      const parId = new Map<string, { prenom: string; nom: string; telephone: string | null; referent: boolean }>();
      for (const d of c.disponibilites) {
        const p = d.photographe;
        const [prenomDeduit = '', ...reste] = (p.name ?? '').trim().split(/\s+/);
        const existant = parId.get(p.id);
        parId.set(p.id, {
          prenom: p.prenom.trim() || prenomDeduit,
          nom: p.nom.trim() || reste.join(' '),
          telephone: p.telephone ?? null,
          referent: (existant?.referent ?? false) || d.decision === 'teamLeader',
        });
      }
      return {
        id: c.id,
        nom: c.nom,
        ville: c.ville,
        dateDebut: c.dateDebut.toISOString(),
        dateFin: c.dateFin.toISOString(),
        statutTraitement: c.statutTraitement,
        annulee: c.annulee,
        archived: c.archived,
        briefId: c.briefId,
        briefUrl: c.briefUrl,
        photographes: [...parId.values()],
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  if (!autorise(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const courseId = typeof body.courseId === 'string' ? body.courseId : '';
  const briefId = typeof body.briefId === 'string' ? body.briefId : '';
  const briefUrl = typeof body.briefUrl === 'string' ? body.briefUrl : '';
  if (!courseId || !briefId) return NextResponse.json({ error: 'courseId et briefId requis' }, { status: 400 });
  const r = await db.course.updateMany({ where: { id: courseId }, data: { briefId, briefUrl: briefUrl || null } });
  if (r.count === 0) return NextResponse.json({ error: 'course introuvable' }, { status: 404 });
  console.info(`[briefs] course ${courseId} liée au brief ${briefId} (import depuis les briefs)`);
  return NextResponse.json({ success: true });
}
