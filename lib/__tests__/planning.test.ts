import { describe, expect, it } from 'vitest';
import {
  JOURS_AVANT_ARCHIVAGE,
  adminStatut, amountFor, applyStatut, defaultDecision, estAuxArchives, peutRevenirAuCalendrier,
  photographerStatut, publishDispo, weekendKey, weekendLabel,
} from '../planning';

describe('statut vu par chacun', () => {
  it('l’admin voit la décision dès qu’elle existe', () => {
    expect(adminStatut({ declaration: 'available', decision: 'validated', published: false })).toBe('validated');
    expect(adminStatut({ declaration: 'pending', decision: null, published: false })).toBe('pending');
  });
  it('le photographe ne voit la décision qu’une fois publiée', () => {
    expect(photographerStatut({ declaration: 'available', decision: 'validated', published: false })).toBe('available');
    expect(photographerStatut({ declaration: 'available', decision: 'validated', published: true })).toBe('validated');
    expect(photographerStatut({ declaration: 'available', decision: 'rejected', published: false })).toBe('available');
    expect(photographerStatut({ declaration: 'pending', decision: null, published: true })).toBe('pending');
  });
});

describe('applyStatut', () => {
  const base = { declaration: 'available' as const, decision: 'validated' as const, published: false };
  it('une déclaration efface la décision', () => {
    expect(applyStatut(base, 'unavailable')).toEqual({ declaration: 'unavailable', decision: null });
  });
  it('une décision garde la déclaration', () => {
    expect(applyStatut({ ...base, decision: null }, 'teamLeader')).toEqual({ declaration: 'available', decision: 'teamLeader' });
  });
});

describe('passage en Fait', () => {
  it('dispo non retenu → refusé, attente / pas dispo → non pris', () => {
    expect(defaultDecision('available')).toBe('rejected');
    expect(defaultDecision('pending')).toBe('nonPris');
    expect(defaultDecision('unavailable')).toBe('nonPris');
  });
  it('publie et garde les décisions déjà prises', () => {
    expect(publishDispo({ declaration: 'available', decision: 'validated', published: false }))
      .toEqual({ declaration: 'available', decision: 'validated', published: true });
    expect(publishDispo({ declaration: 'pending', decision: null, published: false }))
      .toEqual({ declaration: 'pending', decision: 'nonPris', published: true });
    expect(publishDispo({ declaration: 'available', decision: null, published: false }))
      .toEqual({ declaration: 'available', decision: 'rejected', published: true });
  });
});

describe('montants', () => {
  const tarif = { tarifPhotographe: 300, bonusChefEquipe: 100 };
  it('validé = tarif, référent = tarif + bonus, autres = 0', () => {
    expect(amountFor('validated', tarif)).toBe(300);
    expect(amountFor('teamLeader', tarif)).toBe(400);
    expect(amountFor('rejected', tarif)).toBe(0);
    expect(amountFor(null, tarif)).toBe(0);
  });
  it('admin non rémunéré : tarif de base seulement (valeur photographe)', () => {
    expect(amountFor('teamLeader', tarif, { nonRemunere: true })).toBe(300);
  });
});

describe('week-ends (jeudi → lundi)', () => {
  it('samedi et dimanche du même week-end partagent la clé', () => {
    const sam = weekendKey('2026-10-03T07:00:00.000Z');
    const dim = weekendKey('2026-10-04T08:00:00.000Z');
    const lun = weekendKey('2026-10-05T08:00:00.000Z');
    const jeu = weekendKey('2026-10-01T18:00:00.000Z');
    expect(sam).toBe('2026-10-01');
    expect(dim).toBe(sam);
    expect(lun).toBe(sam);
    expect(jeu).toBe(sam);
  });
  it('mardi et mercredi appartiennent au week-end suivant', () => {
    expect(weekendKey('2026-10-06T08:00:00.000Z')).toBe('2026-10-08');
    expect(weekendKey('2026-10-07T08:00:00.000Z')).toBe('2026-10-08');
  });
  it('un dimanche soir à Paris (UTC 22 h la veille en été) reste sur le bon jour', () => {
    // 2026-10-03T23:30Z = dimanche 4 oct 01:30 à Paris
    expect(weekendKey('2026-10-03T23:30:00.000Z')).toBe('2026-10-01');
  });
  it('libellé lisible', () => {
    expect(weekendLabel('2026-10-01')).toBe('3 et 4 octobre');
    expect(weekendLabel('2026-10-29')).toBe('31 octobre et 1 novembre');
  });
});

describe('calendrier ou archives', () => {
  const jour = (iso: string) => new Date(iso);

  it('garde la course le jour de la course et les quatre jours suivants', () => {
    const c = { dateFin: '2026-11-01T14:00:00.000Z' };
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']) {
      expect(estAuxArchives(c, jour(`${d}T10:00:00`))).toBe(false);
    }
  });

  it('la range aux archives à J+5', () => {
    const c = { dateFin: '2026-11-01T14:00:00.000Z' };
    expect(estAuxArchives(c, jour('2026-11-06T00:30:00'))).toBe(true);
    expect(estAuxArchives(c, jour('2026-12-20T10:00:00'))).toBe(true);
  });

  it('compte des jours entiers, pas des heures', () => {
    // Deux courses du même dimanche, l'une finie à 14 h, l'autre à 23 h :
    // elles doivent partir le même jour.
    const tot = { dateFin: '2026-11-01T13:00:00' };
    const tard = { dateFin: '2026-11-01T23:30:00' };
    const vendredi = jour('2026-11-05T23:00:00');
    expect(estAuxArchives(tot, vendredi)).toBe(estAuxArchives(tard, vendredi));
  });

  it('une course à venir n’est jamais aux archives', () => {
    expect(estAuxArchives({ dateFin: '2027-03-01T10:00:00' }, jour('2026-11-06T10:00:00'))).toBe(false);
  });

  it('un archivage à la main part tout de suite', () => {
    const c = { dateFin: '2027-03-01T10:00:00', archived: true };
    expect(estAuxArchives(c, jour('2026-11-06T10:00:00'))).toBe(true);
  });

  it('on peut remettre au calendrier une course archivée trop tôt, pas une vieille', () => {
    expect(
      peutRevenirAuCalendrier({ dateFin: '2026-11-01T10:00:00', archived: true }, jour('2026-11-03T10:00:00')),
    ).toBe(true);
    expect(
      peutRevenirAuCalendrier({ dateFin: '2026-11-01T10:00:00', archived: true }, jour('2026-11-20T10:00:00')),
    ).toBe(false);
    // Une course qui n'est pas archivée n'a rien à « remettre ».
    expect(peutRevenirAuCalendrier({ dateFin: '2026-11-01T10:00:00' }, jour('2026-11-03T10:00:00'))).toBe(false);
  });

  it('une date illisible ne fait pas disparaître la course', () => {
    expect(estAuxArchives({ dateFin: 'n’importe quoi' }, jour('2026-11-06T10:00:00'))).toBe(false);
  });

  it('le délai est de cinq jours', () => {
    expect(JOURS_AVANT_ARCHIVAGE).toBe(5);
  });
});
