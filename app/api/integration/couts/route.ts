import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';

/**
 * APPELS DE L'ADMIN PHOTORUNNING → PLANNING (clé partagée
 * ADMIN_INTEGRATION_KEY, la même que PLANNING_INTEGRATION_KEY côté admin).
 *
 * ⚠ LE COÛT D'UNE COURSE VIT ICI, ET NULLE PART AILLEURS (Théo, 25/10/2026).
 * L'admin connaît les dépenses qu'on saisit à la main sur un événement ; le
 * planning, lui, sait QUI a été retenu, à quel tarif, pour combien de jours,
 * et ce que l'hôtel, le transport et les repas ont coûté. Sans ce pont, la
 * page des coûts de l'admin ne pouvait jamais dire ce qu'un photographe a
 * coûté sur une course.
 *
 * ⚠ ON NE REND QUE LES LIGNES PUBLIÉES ET RETENUES. Une disponibilité
 * déclarée, ou une décision pas encore publiée, n'est pas un engagement :
 * la compter ferait apparaître des coûts pour des photographes qui ne sont
 * jamais venus.
 */

function autorise(req: NextRequest): boolean {
  const attendu = process.env.ADMIN_INTEGRATION_KEY ?? '';
  const recu = req.headers.get('x-integration-key') ?? '';
  if (!attendu || attendu.length < 16 || recu.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

export async function GET(req: NextRequest) {
  if (!autorise(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const url = new URL(req.url);
  const jours = Math.min(Math.max(Number(url.searchParams.get('jours') ?? 400) || 400, 1), 2000);
  const depuis = new Date(Date.now() - jours * 86_400_000);

  const courses = await db.course.findMany({
    where: { dateDebut: { gte: depuis }, annulee: false },
    orderBy: { dateDebut: 'desc' },
    take: 400,
    select: {
      id: true,
      nom: true,
      ville: true,
      dateDebut: true,
      dateFin: true,
      hotelPrice: true,
      transportPrice: true,
      foodPrice: true,
      comOrga: true,
      coureursAttendus: true,
      disponibilites: {
        where: { published: true, decision: { in: ['validated', 'teamLeader'] } },
        select: {
          decision: true,
          photographe: { select: { id: true, prenom: true, nom: true, name: true, email: true } },
          tarif: {
            select: {
              nom: true,
              tarifPhotographe: true,
              bonusChefEquipe: true,
              nombreJours: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    jours,
    courses: courses.map((c) => {
      const lignes = c.disponibilites.map((d) => {
        const p = d.photographe;
        const [prenomDeduit = '', ...reste] = (p.name ?? '').trim().split(/\s+/);
        const prenom = p.prenom.trim() || prenomDeduit;
        const nom = p.nom.trim() || reste.join(' ');
        const chef = d.decision === 'teamLeader';
        /*
         * Le bonus de chef d'équipe ne se verse qu'au chef : l'ajouter à
         * tout le monde multiplierait le coût de la course par le nombre de
         * photographes présents.
         */
        const cachetParJour = d.tarif.tarifPhotographe + (chef ? d.tarif.bonusChefEquipe : 0);
        return {
          photographeId: p.id,
          nom: `${prenom} ${nom}`.trim() || p.email,
          email: p.email,
          chef,
          creneau: d.tarif.nom,
          jours: d.tarif.nombreJours,
          cachetEuros: cachetParJour * d.tarif.nombreJours,
        };
      });
      const cachetsEuros = lignes.reduce((t, l) => t + l.cachetEuros, 0);
      const fraisEuros =
        (c.hotelPrice ?? 0) + (c.transportPrice ?? 0) + (c.foodPrice ?? 0);
      return {
        id: c.id,
        nom: c.nom,
        ville: c.ville,
        dateDebut: c.dateDebut.toISOString(),
        dateFin: c.dateFin.toISOString(),
        coureursAttendus: c.coureursAttendus,
        hotelEuros: c.hotelPrice ?? 0,
        transportEuros: c.transportPrice ?? 0,
        repasEuros: c.foodPrice ?? 0,
        commissionOrgaEuros: c.comOrga ?? 0,
        cachetsEuros,
        fraisEuros,
        /** Tout ce que la course a coûté, hors commission à l'organisateur. */
        totalEuros: cachetsEuros + fraisEuros,
        photographes: lignes,
      };
    }),
  });
}
