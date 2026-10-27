import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/api-auth';
import { courseInclude } from '@/lib/data/courses';
import { weekendSummaries } from '@/lib/data/stats';
import { isWorking } from '@/lib/planning';
import { serializeCourseFor, serializeDispo } from '@/lib/serialize';
import { configApp } from './appareils';
import { contactsEquipe, indexBriefs, sansEchec, type BriefIndex } from './sources';

/**
 * LA SYNCHRO DE L'APP MOBILE (27/10/2026) — tout ce que le téléphone garde
 * pour fonctionner sans réseau, en un seul appel :
 *
 *  - le planning, avec EXACTEMENT les règles du site : un photographe voit sa
 *    déclaration tant que la course n'est pas « Fait », la décision ensuite
 *    (serializeDispo) ; l'admin voit tout ;
 *  - l'index des briefs (les briefs complets, plus lourds, se chargent à
 *    part avec /api/mobile/briefs, seulement ceux qui ont changé) ;
 *  - les contacts PhotoRunning partagés aux photographes (annuaire de l'admin) ;
 *  - le réglage des versions de l'app.
 *
 * Les coûts d'une course (hôtel, transport, repas, commission organisateur)
 * ne partent jamais sur le téléphone d'un photographe.
 */

const JOURS_ARCHIVES = 60;

type UserLite = {
  id: string;
  role: 'admin' | 'photographer';
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  region: string;
  actif: boolean;
  inCharge: boolean;
  nonRemunere: boolean;
};

const selectUser = {
  id: true,
  role: true,
  prenom: true,
  nom: true,
  name: true,
  email: true,
  telephone: true,
  region: true,
  actif: true,
  inCharge: true,
  nonRemunere: true,
  chargeOne: true,
  chargeTwo: true,
  chargeThree: true,
  chargeFour: true,
  chargeFive: true,
} as const;

type UserRow = {
  id: string;
  role: 'admin' | 'photographer';
  prenom: string;
  nom: string;
  name: string;
  email: string;
  telephone: string | null;
  region: string | null;
  actif: boolean;
  inCharge: boolean;
  nonRemunere: boolean;
  chargeOne: string | null;
  chargeTwo: string | null;
  chargeThree: string | null;
  chargeFour: string | null;
  chargeFive: string | null;
};

function lite(u: UserRow): UserLite {
  const [prenomDeduit = '', ...reste] = (u.name ?? '').trim().split(/\s+/);
  return {
    id: u.id,
    role: u.role,
    prenom: u.prenom.trim() || prenomDeduit,
    nom: u.nom.trim() || reste.join(' '),
    email: u.email,
    telephone: u.telephone ?? '',
    region: u.region ?? '',
    actif: u.actif,
    inCharge: u.inCharge,
    nonRemunere: u.nonRemunere,
  };
}

const charges = (u: UserRow) => [u.chargeOne, u.chargeTwo, u.chargeThree, u.chargeFour, u.chargeFive].filter((x): x is string => !!x);

async function lesCourses() {
  const depuis = new Date(Date.now() - JOURS_ARCHIVES * 86_400_000);
  return db.course.findMany({
    where: { OR: [{ archived: false }, { archived: true, dateFin: { gte: depuis } }] },
    include: courseInclude,
    orderBy: { dateDebut: 'asc' },
  });
}

/**
 * Les briefs qu'une personne peut lire, et à quelles courses ils se
 * rattachent : un admin, tous ; un photographe, ceux des courses où lui ou
 * un de ses photographes à charge (actifs) est retenu, décision publiée.
 * Jamais de rapprochement par le nom : un photographe peut changer le sien
 * dans son profil (relecture du 27/10/2026). Un autre brief se partage par
 * son lien.
 */
export async function briefsVisibles(
  user: SessionUser,
): Promise<{ index: BriefIndex[]; courseIdsParBrief: Record<string, string[]> } | null> {
  const courses = await lesCourses();
  const parBrief: Record<string, string[]> = {};
  const ajouter = (briefId: string | null, courseId: string) => {
    if (!briefId) return;
    (parBrief[briefId] ??= []).push(courseId);
  };

  if (user.role === 'admin') {
    for (const c of courses) ajouter(c.briefId, c.id);
    const index = await sansEchec('briefs', () => indexBriefs({ ids: Object.keys(parBrief), tous: true }));
    return index ? { index, courseIdsParBrief: parBrief } : null;
  }

  const moi = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: selectUser });
  const aCharge = moi.inCharge && charges(moi).length
    ? (await db.user.findMany({ where: { id: { in: charges(moi) }, actif: true }, select: { id: true } })).map((u) => u.id)
    : [];
  const personnes = [moi.id, ...aCharge];
  const retenues = await db.disponibilite.findMany({
    where: {
      photographeId: { in: personnes },
      published: true,
      decision: { in: ['validated', 'teamLeader'] },
      courseId: { in: courses.map((c) => c.id) },
    },
    select: { courseId: true },
  });
  const courseIds = new Set(retenues.map((r) => r.courseId));
  for (const c of courses) if (courseIds.has(c.id) && !c.annulee) ajouter(c.briefId, c.id);
  const index = await sansEchec('briefs', () => indexBriefs({ ids: Object.keys(parBrief) }));
  return index ? { index, courseIdsParBrief: parBrief } : null;
}

export async function construireSynchro(user: SessionUser, deviceId: string) {
  const [courses, weekends, config, moi] = await Promise.all([
    lesCourses(),
    weekendSummaries(),
    configApp(),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: selectUser }),
  ]);
  const courseIds = courses.map((c) => c.id);
  const admin = user.role === 'admin';

  // Personnes visibles : tout le monde pour un admin, soi et ses photographes à charge sinon.
  let personnes: UserLite[];
  let geres: string[] = [];
  if (admin) {
    const tous = await db.user.findMany({ select: selectUser, orderBy: [{ role: 'asc' }, { prenom: 'asc' }] });
    personnes = tous.map(lite);
  } else {
    geres = moi.inCharge ? charges(moi) : [];
    const autres = geres.length
      ? await db.user.findMany({ where: { id: { in: geres }, actif: true }, select: selectUser })
      : [];
    geres = autres.map((a) => a.id);
    personnes = [moi, ...autres].map(lite);
  }

  const dispos = await db.disponibilite.findMany({
    where: admin ? { courseId: { in: courseIds } } : { courseId: { in: courseIds }, photographeId: { in: [moi.id, ...geres] } },
  });

  // L'équipe d'une course où l'on travaille (publiée) : prénoms, référent, et le
  // numéro du référent seulement. L'admin la recalcule depuis les dispos.
  let equipes: Record<string, { prenom: string; nom: string; referent: boolean; telephone: string }[]> = {};
  if (!admin) {
    const mesCourses = new Set(
      dispos.filter((d) => d.published && isWorking(d.decision)).map((d) => d.courseId),
    );
    if (mesCourses.size) {
      const lignes = await db.disponibilite.findMany({
        where: { courseId: { in: [...mesCourses] }, published: true, decision: { in: ['validated', 'teamLeader'] } },
        select: { courseId: true, decision: true, photographe: { select: selectUser } },
      });
      const parCourse = new Map<string, Map<string, { prenom: string; nom: string; referent: boolean; telephone: string }>>();
      for (const l of lignes) {
        const p = lite(l.photographe);
        const m = parCourse.get(l.courseId) ?? new Map();
        const avant = m.get(p.id);
        const referent = (avant?.referent ?? false) || l.decision === 'teamLeader';
        m.set(p.id, { prenom: p.prenom, nom: p.nom, referent, telephone: referent ? p.telephone : '' });
        parCourse.set(l.courseId, m);
      }
      equipes = Object.fromEntries([...parCourse].map(([k, m]) => [k, [...m.values()].sort((a, b) => Number(b.referent) - Number(a.referent) || a.prenom.localeCompare(b.prenom))]));
    }
  }

  const [briefs, contacts] = await Promise.all([briefsVisibles(user), sansEchec('annuaire', contactsEquipe)]);

  await db.mobileDevice.update({ where: { id: deviceId }, data: { lastSyncAt: new Date(), lastSeenAt: new Date() } }).catch(() => undefined);

  return {
    serverTime: new Date().toISOString(),
    me: { ...lite(moi), geres },
    personnes,
    courses: courses.map((c) => serializeCourseFor(c, admin ? 'admin' : 'photographer')),
    dispos: dispos.map((d) => serializeDispo(d, admin ? 'admin' : 'photographer')),
    weekends,
    equipes,
    briefs: briefs
      ? briefs.index.map((b) => ({ ...b, courseIds: briefs.courseIdsParBrief[b.id] ?? [] }))
      : null,
    contacts,
    config: {
      latestVersion: config.latestVersion,
      minVersion: config.minVersion,
      message: config.message,
      iosUrl: config.iosUrl,
      androidUrl: config.androidUrl,
    },
  };
}
