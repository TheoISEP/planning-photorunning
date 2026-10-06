import { db } from '@/lib/db';

/**
 * LIAISON PLANNING → BRIEFS (Théo, 06/10/2026).
 *
 * L'app des briefs (briefs-photorunning) expose `/api/integration/planning`,
 * protégée par une clé partagée. Deux usages :
 *
 *  1. À la création d'une course ici, on crée son brief là-bas depuis le
 *     template « hôtel et transport », nom et date remplis. Le brief reste à
 *     finaliser à la main ; on garde son adresse sur la course.
 *  2. Quand une course passe en « Fait » (décisions publiées), ou qu'une
 *     décision change sur une course déjà « Fait », les photographes validés
 *     (ou référents) sont poussés dans le tableau des photographes du brief.
 *
 * Variables : BRIEFS_APP_URL (ex. https://briefs-photorunning.vercel.app) et
 * BRIEFS_INTEGRATION_KEY (même valeur que PLANNING_INTEGRATION_KEY côté
 * briefs). Sans elles, tout est silencieusement ignoré : le planning ne doit
 * jamais tomber parce que les briefs sont injoignables.
 */

const DELAI_MS = 12_000;

function config(): { url: string; cle: string } | null {
  const url = (process.env.BRIEFS_APP_URL ?? '').replace(/\/$/, '');
  const cle = process.env.BRIEFS_INTEGRATION_KEY ?? '';
  if (!url || !cle) return null;
  return { url, cle };
}

export function briefsIntegrationActive(): boolean {
  return config() !== null;
}

async function appel<T>(body: Record<string, unknown>): Promise<T | null> {
  const cfg = config();
  if (!cfg) return null;
  const res = await fetch(`${cfg.url}/api/integration/planning`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-integration-key': cfg.cle },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DELAI_MS),
    cache: 'no-store',
  });
  if (!res.ok) {
    const texte = await res.text().catch(() => '');
    throw new Error(`briefs HTTP ${res.status} ${texte.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Crée (ou retrouve) le brief d'une course et mémorise son adresse. */
export async function creerBriefPourCourse(courseId: string): Promise<{ briefId: string; briefUrl: string } | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, nom: true, dateDebut: true, briefId: true, briefUrl: true },
  });
  if (!course) return null;
  const r = await appel<{ briefId: string; url: string; created: boolean }>({
    action: 'course',
    nom: course.nom,
    dateDebut: course.dateDebut.toISOString(),
    briefId: course.briefId,
  });
  if (!r) return null;
  await db.course.update({ where: { id: courseId }, data: { briefId: r.briefId, briefUrl: r.url } });
  console.info(`[briefs] course ${courseId} : brief ${r.briefId} ${r.created ? 'créé' : 'retrouvé'}`);
  return { briefId: r.briefId, briefUrl: r.url };
}

/**
 * Pousse les photographes validés / référents (lignes publiées) dans le
 * tableau du brief. Sans brief encore créé, on le crée d'abord.
 */
export async function synchroniserPhotographesDuBrief(courseId: string): Promise<number> {
  if (!config()) return 0;
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, briefId: true, statutTraitement: true },
  });
  if (!course) return 0;
  let briefId = course.briefId;
  if (!briefId) briefId = (await creerBriefPourCourse(courseId))?.briefId ?? null;
  if (!briefId) return 0;

  const lignes = await db.disponibilite.findMany({
    where: { courseId, published: true, decision: { in: ['validated', 'teamLeader'] } },
    select: { decision: true, photographe: { select: { id: true, prenom: true, nom: true, name: true, telephone: true } } },
  });
  const parId = new Map<string, { prenom: string; nom: string; telephone: string | null; referent: boolean }>();
  for (const l of lignes) {
    const p = l.photographe;
    const [prenomDeduit = '', ...reste] = (p.name ?? '').trim().split(/\s+/);
    const prenom = p.prenom.trim() || prenomDeduit;
    const nom = p.nom.trim() || reste.join(' ');
    const existant = parId.get(p.id);
    parId.set(p.id, {
      prenom,
      nom,
      telephone: p.telephone ?? null,
      referent: (existant?.referent ?? false) || l.decision === 'teamLeader',
    });
  }
  const photographers = [...parId.values()];
  const r = await appel<{ briefId: string; rows: number }>({ action: 'photographers', briefId, photographers });
  console.info(`[briefs] course ${courseId} : ${photographers.length} photographe(s) envoyé(s) au brief ${briefId}`);
  return r?.rows ?? 0;
}

/** Même chose, sans jamais faire échouer l'appelant. */
export async function synchroniserSansEchec(courseId: string): Promise<void> {
  try {
    await synchroniserPhotographesDuBrief(courseId);
  } catch (err) {
    console.error(`[briefs] synchronisation des photographes en échec (course ${courseId})`, err);
  }
}
