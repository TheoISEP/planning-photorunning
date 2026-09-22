import { describe, expect, it } from 'vitest';
import {
  adminStatut, amountFor, applyStatut, defaultDecision, photographerStatut, publishDispo, weekendKey, weekendLabel,
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
