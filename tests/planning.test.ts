import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appliquerStatut, cleWeekend, estCacheePour, groupesParMois, montant, resumeAdmin, resumePassageFait, vuePhotographe } from '../src/lib/planning.ts';
import type { Course, Dispo } from '../src/lib/types.ts';

const tarif = { id: 't1', courseId: 'c1', nom: '', ordre: 0, tarifPhotographe: 150, bonusChefEquipe: 50, nombreJours: 1 };
const course = (x: Partial<Course> = {}): Course => ({
  id: 'c1', nom: 'Semi', description: '', localisation: '', ville: 'Paris',
  dateDebut: '2030-06-01T07:00:00.000Z', dateFin: '2030-06-01T12:00:00.000Z',
  statutTraitement: 'inProgress', doneAt: '', coureursAttendus: 0, numberAttended: 0,
  briefPdfUrl: '', briefId: '', briefUrl: '', visible: true, archived: false, annulee: false,
  hotel: '', transport: '', supplementaire: '', hotelValid: false, transportValid: false,
  hotelPrice: null, transportPrice: null, foodPrice: null, comOrga: null, twoPrices: false,
  tarifs: [tarif], ...x,
});
const dispo = (x: Partial<Dispo>): Dispo => ({ id: 'd', courseId: 'c1', photographeId: 'p1', tarifId: 't1', statut: 'pending', declaration: 'pending', decision: null, published: false, noteAdmin: '', ...x });

test('le référent touche le bonus, le refusé rien', () => {
  assert.equal(montant('validated', tarif), 150);
  assert.equal(montant('teamLeader', tarif), 200);
  assert.equal(montant('rejected', tarif), 0);
});

test('choisir une déclaration efface la décision, une décision garde la déclaration', () => {
  assert.deepEqual(appliquerStatut({ declaration: 'available', decision: 'validated' }, 'unavailable'), { declaration: 'unavailable', decision: null });
  assert.deepEqual(appliquerStatut({ declaration: 'available', decision: null }, 'teamLeader'), { declaration: 'available', decision: 'teamLeader' });
});

test('course en cours : le photographe voit sa déclaration et peut la changer', () => {
  const m = new Map([['c1|p1|t1', dispo({ statut: 'available', declaration: 'available' })]]);
  const v = vuePhotographe(course(), m, 'p1', new Date('2030-01-01'));
  assert.equal(v.creneaux[0].statut, 'available');
  assert.equal(v.creneaux[0].modifiable, true);
  assert.equal(v.travaille, false);
});

test('course Fait sans décision publiée : dispo → refusé, attente → non pris, et la course se cache', () => {
  const m = new Map([['c1|p1|t1', dispo({ statut: 'available', declaration: 'available' })]]);
  const v = vuePhotographe(course({ statutTraitement: 'done' }), m, 'p1');
  assert.equal(v.creneaux[0].statut, 'rejected');
  assert.equal(v.creneaux[0].modifiable, false);
  assert.equal(estCacheePour(v), true);
  const v2 = vuePhotographe(course({ statutTraitement: 'done' }), new Map(), 'p1');
  assert.equal(v2.creneaux[0].statut, 'nonPris');
});

test('décision publiée : validé, montant, pas modifiable', () => {
  const m = new Map([['c1|p1|t1', dispo({ statut: 'validated', declaration: 'available', decision: 'validated', published: true })]]);
  const v = vuePhotographe(course({ statutTraitement: 'done' }), m, 'p1');
  assert.equal(v.travaille, true);
  assert.equal(v.montant, 150);
  assert.equal(v.creneaux[0].modifiable, false);
});

test('course annulée : personne ne travaille, montant nul', () => {
  const m = new Map([['c1|p1|t1', dispo({ statut: 'validated', decision: 'validated', published: true })]]);
  const v = vuePhotographe(course({ annulee: true, statutTraitement: 'done' }), m, 'p1');
  assert.equal(v.travaille, false);
  assert.equal(v.montant, 0);
});

test('week-end jeudi → lundi, en heure de Paris', () => {
  // vendredi 31/05/2030, samedi 01/06, dimanche 02/06, lundi 03/06 : même week-end (jeudi 30/05)
  assert.equal(cleWeekend('2030-05-31T10:00:00Z'), '2030-05-30');
  assert.equal(cleWeekend('2030-06-01T10:00:00Z'), '2030-05-30');
  assert.equal(cleWeekend('2030-06-03T10:00:00Z'), '2030-05-30');
  // dimanche 23 h 30 à Paris = 21 h 30 UTC : encore dimanche
  assert.equal(cleWeekend('2030-06-02T21:30:00Z'), '2030-05-30');
  // mardi : week-end suivant
  assert.equal(cleWeekend('2030-06-04T10:00:00Z'), '2030-06-06');
});

test('mois : archivées du mois courant gardées, les autres non', () => {
  const g = groupesParMois(
    [course({ id: 'a', archived: true, dateDebut: '2030-06-01T07:00:00Z' }), course({ id: 'b', archived: true, dateDebut: '2030-04-01T07:00:00Z' }), course({ id: 'c' })],
    'actives',
    new Date('2030-06-10'),
  );
  assert.deepEqual(g.flatMap((x) => x.courses.map((c) => c.id)).sort(), ['a', 'c']);
});

test('résumé admin comme la grille du site : admin non rémunéré gratuit', () => {
  const m = new Map([
    ['c1|p1|t1', dispo({ photographeId: 'p1', decision: 'teamLeader', statut: 'teamLeader' })],
    ['c1|a1|t1', dispo({ photographeId: 'a1', decision: 'validated', statut: 'validated' })],
    ['c1|p2|t1', dispo({ photographeId: 'p2', declaration: 'available', statut: 'available' })],
  ]);
  const cols = [
    { id: 'a1', role: 'admin', nonRemunere: true },
    { id: 'p1', role: 'photographer', nonRemunere: false },
    { id: 'p2', role: 'photographer', nonRemunere: false },
    { id: 'p3', role: 'photographer', nonRemunere: false },
  ];
  assert.deepEqual(resumeAdmin(course(), m, cols), { retenus: 2, disponibles: 1, cout: 200 });
  assert.deepEqual(resumePassageFait(course(), m, cols), { retenus: 2, versRefuse: 1, versNonPris: 1 });
});
