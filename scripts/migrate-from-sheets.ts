/**
 * Migration Google Sheet → Neon (Postgres)
 *
 *   npx tsx scripts/migrate-from-sheets.ts            # importe (idempotent : relançable)
 *   npx tsx scripts/migrate-from-sheets.ts --dry-run  # lit et contrôle, n'écrit rien
 *   npx tsx scripts/migrate-from-sheets.ts --verify   # compare le Sheet et la base
 *
 * Variables lues dans .env.local / .env :
 *   DATABASE_URL                     base cible
 *   GOOGLE_SPREADSHEET_ID            id du Sheet (défaut : le planning historique)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL     (optionnel) lecture via l'API Sheets
 *   GOOGLE_PRIVATE_KEY               (optionnel) sinon export CSV public du Sheet
 *
 * Tout est conservé : identifiants (photographe-001, course-…, tarif-…),
 * hashs bcrypt des mots de passe, courses archivées, disponibilités,
 * tarifs, coûts mensuels. Les statuts sont traduits dans le nouveau modèle :
 *   pending / available / unavailable            → déclaration
 *   validated / teamLeader / rejected / nonPris   → décision
 * Une course « Fait » est publiée (les lignes non tranchées deviennent
 * refusé / non pris, ce qui corrige les « en attente » fantômes).
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

loadEnv({ path: '.env.local', override: false });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '18GjRJBkvG7rKj-LpdfP0E1aviKt3gCwE0hxjknpUTAA';
const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');
const DEBUG = process.argv.includes('--debug');

const SHEETS = {
  PHOTOGRAPHES: 'Photographes',
  ADMIN: 'Admin',
  COURSES: 'Courses',
  TARIFS: 'Tarifs',
  DISPONIBILITES: 'Disponibilités',
  STATS_ADMIN: 'Statistiquesadmin',
} as const;

type Row = Record<string, string>;

// ---------------------------------------------------------------------------
// Lecture du Sheet
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function toObjects(values: string[][]): Row[] {
  if (values.length === 0) return [];
  const headers = values[0].map((h) => h.trim());
  return values.slice(1).map((r) => {
    const o: Row = {};
    headers.forEach((h, i) => {
      if (!h) return;
      const v = (r[i] ?? '').trim();
      // En cas d'en-tête dupliqué (ex. « actif » deux fois dans Admin), la
      // dernière valeur non vide gagne.
      if (o[h] === undefined || v !== '') o[h] = v;
    });
    return o;
  });
}

async function readSheetPublic(name: string): Promise<string[][]> {
  // headers=1 : une seule ligne d'en-tête (sinon gviz « devine » et peut
  // fusionner des centaines de lignes dans l'en-tête quand tout est du texte)
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Lecture de l'onglet « ${name} » impossible (${res.status}). Le Sheet doit être lisible par lien, ou renseigner GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY.`);
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error(`L'onglet « ${name} » n'est pas accessible publiquement (page HTML reçue).`);
  return parseCsv(text);
}

async function readSheetApi(name: string): Promise<string[][]> {
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${name}!A:AZ` });
  return (res.data.values ?? []).map((r) => r.map((v) => String(v ?? '')));
}

async function readSheet(name: string): Promise<Row[]> {
  // SHEETS_FIXTURE_DIR=<dossier> : lit <dossier>/<onglet>.csv (tests hors ligne)
  if (process.env.SHEETS_FIXTURE_DIR) {
    const { readFile } = await import('node:fs/promises');
    const text = await readFile(`${process.env.SHEETS_FIXTURE_DIR}/${name}.csv`, 'utf8');
    return toObjects(parseCsv(text));
  }
  const useApi = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
  const values = useApi ? await readSheetApi(name) : await readSheetPublic(name);
  const suspicious = (values[0] ?? []).filter((h) => h.includes(' ') || h.length > 40);
  if (suspicious.length > 0) {
    throw new Error(`Onglet « ${name} » : en-têtes suspects (${suspicious[0].slice(0, 60)}…). L'export a fusionné plusieurs lignes ; relancer, ou renseigner GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY pour passer par l'API Sheets.`);
  }
  if (DEBUG) {
    console.log(`[debug] onglet ${name} : en-têtes = ${JSON.stringify(values[0] ?? [])}`);
    console.log(`[debug] onglet ${name} : 1re ligne = ${JSON.stringify(values[1] ?? [])}`);
  }
  return toObjects(values);
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

const bool = (v: string | undefined, fallback = false) => {
  const s = (v ?? '').trim().toLowerCase();
  if (['true', 'oui', '1', 'yes'].includes(s)) return true;
  if (['false', 'non', '0', 'no'].includes(s)) return false;
  return fallback;
};
const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const int = (v: string | undefined): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
const date = (v: string | undefined, fallback?: Date): Date | null => {
  if (!v || !v.trim()) return fallback ?? null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback ?? null : d;
};
const list = (v: string | undefined): string[] => {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.map(String).filter((s) => s.trim() !== '') : [];
  } catch {
    return v.trim() ? [v.trim()] : [];
  }
};
const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

const DECLARATIONS = new Set(['pending', 'available', 'unavailable']);
const DECISIONS = new Set(['validated', 'teamLeader', 'rejected', 'nonPris']);
const DECISION_RANK: Record<string, number> = { teamLeader: 4, validated: 3, rejected: 2, nonPris: 1 };

function userFromRow(r: Row, role: 'admin' | 'photographer'): Prisma.UserCreateInput & { password: string } {
  const prenom = r.prenom ?? '';
  const nom = r.nom ?? '';
  const created = date(r.dateInscription) ?? date(r.dateCreation) ?? new Date();
  return {
    id: r.id,
    email: (r.email ?? '').trim().toLowerCase(),
    name: `${prenom} ${nom}`.trim() || r.email,
    emailVerified: true,
    role,
    createdAt: created,
    nom,
    prenom,
    telephone: orNull(r.telephone),
    adresse: orNull(r.adresse),
    ville: orNull(r.ville),
    codePostal: orNull(r.codePostal),
    dateNaissance: orNull(r.dateNaissance),
    dateInscription: created,
    actif: bool(r.actif, true),
    cameras: list(r.cameras),
    objectifs: list(r.objectifs),
    cartesMemoire: list(r.cartesMemoire),
    flashs: list(r.flashs),
    flyingBlue: orNull(r.flyingBlue),
    flyingBlueExpiry: orNull(r.flyingBlueExpiry),
    sncf: orNull(r.sncf),
    sncfExpiry: orNull(r.sncfExpiry),
    region: orNull(r.region),
    personUrgency: orNull(r.personUrgency),
    numberUrgency: orNull(r.numberUrgency),
    inCharge: bool(r.inCharge),
    chargeOne: orNull(r.chargeOne),
    chargeTwo: orNull(r.chargeTwo),
    chargeThree: orNull(r.chargeThree),
    chargeFour: orNull(r.chargeFour),
    chargeFive: orNull(r.chargeFive),
    accord: bool(r.accord),
    nonRemunere: bool(r.rem ?? r.nonRemunere),
    password: r.password ?? '',
  };
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Sheet ${SPREADSHEET_ID} → ${DRY_RUN ? '(lecture seule)' : VERIFY ? '(vérification)' : 'base ' + (process.env.DATABASE_URL ?? '').replace(/:[^:@/]+@/, ':***@')}`);

  const [photographes, admins, courses, tarifs, dispos, statsAdmin] = await Promise.all([
    readSheet(SHEETS.PHOTOGRAPHES),
    readSheet(SHEETS.ADMIN),
    readSheet(SHEETS.COURSES),
    readSheet(SHEETS.TARIFS),
    readSheet(SHEETS.DISPONIBILITES),
    readSheet(SHEETS.STATS_ADMIN),
  ]);
  console.log(`Lu : ${admins.length} admins, ${photographes.length} photographes, ${courses.length} courses, ${tarifs.length} tarifs, ${dispos.length} disponibilités, ${statsAdmin.length} lignes de coûts`);

  const warnings: string[] = [];

  // --- Utilisateurs ---------------------------------------------------------
  const users = new Map<string, ReturnType<typeof userFromRow>>();
  const emails = new Set<string>();
  for (const [rows, role] of [[admins, 'admin'], [photographes, 'photographer']] as const) {
    for (const r of rows) {
      if (!r.id || !r.email) { warnings.push(`Utilisateur ignoré (id/email vide) : ${JSON.stringify(r).slice(0, 80)}`); continue; }
      const u = userFromRow(r, role);
      if (users.has(u.id)) { warnings.push(`Id utilisateur en double ignoré : ${u.id}`); continue; }
      if (emails.has(u.email)) { warnings.push(`Email en double ignoré : ${u.email} (${u.id})`); continue; }
      if (!u.password.startsWith('$2')) warnings.push(`Mot de passe non bcrypt pour ${u.id} (${u.email}) : la connexion échouera, à réinitialiser depuis l'admin`);
      users.set(u.id, u);
      emails.add(u.email);
    }
  }

  // --- Courses --------------------------------------------------------------
  const courseRows = new Map<string, Prisma.CourseCreateInput>();
  for (const r of courses) {
    if (!r.id || !r.nom) { warnings.push(`Course ignorée (id/nom vide) : ${JSON.stringify(r).slice(0, 80)}`); continue; }
    const dateDebut = date(r.dateDebut);
    const dateFin = date(r.dateFin) ?? dateDebut;
    if (!dateDebut || !dateFin) { warnings.push(`Course ${r.id} sans date valide, ignorée`); continue; }
    courseRows.set(r.id, {
      id: r.id,
      nom: r.nom,
      description: r.description ?? '',
      localisation: r.localisation ?? '',
      ville: r.ville ?? r.localisation ?? '',
      dateDebut,
      dateFin,
      statutTraitement: r.statutTraitement === 'done' ? 'done' : 'inProgress',
      doneAt: r.statutTraitement === 'done' ? (date(r.dateModification) ?? dateFin) : null,
      coureursAttendus: int(r.coureursAttendus),
      numberAttended: int(r.numberAttended),
      briefPdfUrl: orNull(r.briefPdfUrl),
      dateCreation: date(r.dateCreation) ?? new Date(),
      creePar: orNull(r.creePar),
      visible: bool(r.visible, true),
      archived: bool(r.archived),
      archivedAt: bool(r.archived) ? (date(r.archivedAt) ?? dateFin) : null,
      archivedBy: orNull(r.archivedBy),
      hotel: r.hotel ?? '',
      transport: r.transport ?? '',
      supplementaire: r.supplementaire ?? '',
      hotelValid: bool(r.hotelValid),
      transportValid: bool(r.transportValid),
      hotelPrice: num(r.hotelPrice),
      transportPrice: num(r.transportPrice),
      foodPrice: num(r.foodPrice),
      comOrga: num(r.comOrga),
    });
  }

  // --- Tarifs (créneaux) ----------------------------------------------------
  const tarifsByCourse = new Map<string, Prisma.TarifCreateManyInput[]>();
  for (const r of tarifs) {
    if (!r.id || !r.courseId) continue;
    if (!courseRows.has(r.courseId)) { warnings.push(`Tarif ${r.id} orphelin (course ${r.courseId} inconnue), ignoré`); continue; }
    const arr = tarifsByCourse.get(r.courseId) ?? [];
    arr.push({
      id: r.id,
      courseId: r.courseId,
      nom: '',
      ordre: arr.length,
      tarifPhotographe: num(r.tarifPhotographe) ?? 0,
      bonusChefEquipe: num(r.bonusChefEquipe) ?? 0,
      nombreJours: int(r.nombreJours) ?? 1,
      dateCreation: date(r.dateCreation) ?? new Date(),
      dateModification: date(r.dateModification) ?? new Date(),
    });
    tarifsByCourse.set(r.courseId, arr);
  }
  // Libellés : firstTarifName / secondTarifName / description
  for (const r of tarifs) {
    const arr = tarifsByCourse.get(r.courseId);
    const t = arr?.find((x) => x.id === r.id);
    if (!t || !arr) continue;
    const multi = arr.length > 1;
    const idx = t.ordre ?? 0;
    const label = multi
      ? (idx === 0 ? r.firstTarifName : r.secondTarifName) || r.description || `Jour ${idx + 1}`
      : r.description || r.firstTarifName || '';
    t.nom = label.trim();
  }
  let defaultTarifs = 0;
  for (const c of courseRows.values()) {
    if (!tarifsByCourse.has(c.id)) {
      tarifsByCourse.set(c.id, [{ id: `tarif-${c.id}`, courseId: c.id, nom: '', ordre: 0, tarifPhotographe: 0, bonusChefEquipe: 0, nombreJours: 1 }]);
      defaultTarifs++;
    }
  }
  if (defaultTarifs) warnings.push(`${defaultTarifs} course(s) sans tarif dans le Sheet : créneau à 0 € créé (à compléter dans l'admin)`);

  // --- Disponibilités -------------------------------------------------------
  type DispoRow = Prisma.DisponibiliteCreateManyInput & { _explicitTarif: boolean; _rank: number; _modified: number };
  const dispoRows = new Map<string, DispoRow>();
  let skippedDispos = 0;
  let duplicates = 0;
  const skipReasons: Record<string, number> = {};
  const skip = (reason: string, r: Row) => {
    skippedDispos++;
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
    if (DEBUG && skipReasons[reason] <= 2) console.log(`[debug] dispo ignorée (${reason}) : ${JSON.stringify(r)}`);
  };
  for (const r of dispos) {
    if (!r.id || !r.courseId || !r.photographeId) { skip('id / courseId / photographeId vide', r); continue; }
    const course = courseRows.get(r.courseId);
    const courseTarifs = tarifsByCourse.get(r.courseId) ?? [];
    if (!course || courseTarifs.length === 0) { skip('course inconnue', r); continue; }
    if (!users.has(r.photographeId)) { skip('photographe inconnu', r); continue; }

    const explicit = !!r.tarifId && courseTarifs.some((t) => t.id === r.tarifId);
    const tarifId = explicit ? r.tarifId : courseTarifs[0].id;
    const statut = (r.statut ?? 'pending').trim();
    type Decl = 'pending' | 'available' | 'unavailable';
    type Dec = 'validated' | 'teamLeader' | 'rejected' | 'nonPris';
    let declaration: Decl = 'pending';
    let decision: Dec | null = null;
    if (DECLARATIONS.has(statut)) declaration = statut as Decl;
    else if (DECISIONS.has(statut)) {
      decision = statut as Dec;
      declaration = statut === 'nonPris' ? 'pending' : 'available';
    } else warnings.push(`Statut inconnu « ${statut} » sur ${r.id}, traité comme en attente`);

    const done = course.statutTraitement === 'done';
    if (done && !decision) decision = declaration === 'available' ? 'rejected' : 'nonPris';

    const key = `${r.courseId}|${r.photographeId}|${tarifId}`;
    const modified = (date(r.dateModification) ?? date(r.dateDeclaration) ?? new Date(0)).getTime();
    const candidate: DispoRow = {
      id: `dispo-${r.courseId}-${r.photographeId}-${tarifId}`,
      courseId: r.courseId,
      photographeId: r.photographeId,
      tarifId,
      declaration,
      decision,
      published: done,
      publishedAt: done ? course.doneAt ?? null : null,
      noteAdmin: r.noteAdmin ?? '',
      dateDeclaration: date(r.dateDeclaration) ?? new Date(modified || Date.now()),
      dateModification: new Date(modified || Date.now()),
      _explicitTarif: explicit,
      _rank: decision ? DECISION_RANK[decision] : 0,
      _modified: modified,
    };
    const existing = dispoRows.get(key);
    if (!existing) { dispoRows.set(key, candidate); continue; }
    duplicates++;
    // Priorité : tarif explicite > décision la plus forte > modification la plus récente
    const better =
      (candidate._explicitTarif && !existing._explicitTarif) ||
      (candidate._explicitTarif === existing._explicitTarif && candidate._rank > existing._rank) ||
      (candidate._explicitTarif === existing._explicitTarif && candidate._rank === existing._rank && candidate._modified > existing._modified);
    if (better) dispoRows.set(key, candidate);
  }

  // --- Coûts mensuels -------------------------------------------------------
  const costs = new Map<string, number>();
  for (const r of statsAdmin) {
    if (!r.month) continue;
    costs.set(r.month.trim(), num(r.softCost) ?? 0);
  }

  console.log(`Préparé : ${users.size} comptes, ${courseRows.size} courses (${[...courseRows.values()].filter((c) => c.archived).length} archivées, ${[...courseRows.values()].filter((c) => c.statutTraitement === 'done').length} faites), ${[...tarifsByCourse.values()].flat().length} créneaux, ${dispoRows.size} disponibilités (${duplicates} doublons fusionnés, ${skippedDispos} ignorées), ${costs.size} mois de coûts`);
  for (const [reason, n] of Object.entries(skipReasons)) console.log(`  ⚠ ${n} disponibilité(s) ignorée(s) : ${reason}`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);

  if (DRY_RUN) { console.log('Lecture seule : rien n’a été écrit.'); return; }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    if (VERIFY) {
      const [u, c, t, d, m, a] = await Promise.all([
        prisma.user.count(), prisma.course.count(), prisma.tarif.count(), prisma.disponibilite.count(), prisma.monthlyCost.count(),
        prisma.account.count({ where: { providerId: 'credential', password: { startsWith: '$2' } } }),
      ]);
      const expected = { comptes: users.size, courses: courseRows.size, creneaux: [...tarifsByCourse.values()].flat().length, disponibilites: dispoRows.size, mois: costs.size };
      const got = { comptes: u, courses: c, creneaux: t, disponibilites: d, mois: m };
      let ok = true;
      for (const k of Object.keys(expected) as (keyof typeof expected)[]) {
        const same = expected[k] <= got[k];
        if (!same) ok = false;
        console.log(`  ${same ? '✓' : '✗'} ${k} : Sheet ${expected[k]} / base ${got[k]}`);
      }
      console.log(`  ${a === u ? '✓' : '✗'} mots de passe bcrypt : ${a}/${u} comptes`);
      const missing = (await prisma.user.findMany({ select: { id: true } })).filter((x) => !users.has(x.id));
      if (missing.length) console.log(`  ℹ ${missing.length} compte(s) créés depuis la migration (pas dans le Sheet)`);
      console.log(ok && a === u ? 'Vérification OK.' : 'Des écarts existent, voir ci-dessus.');
      return;
    }

    // Écriture (upserts : relançable sans doublon)
    let n = 0;
    for (const u of users.values()) {
      const { password, ...data } = u;
      await prisma.user.upsert({ where: { id: u.id }, create: data, update: data });
      await prisma.account.upsert({
        where: { id: `acc-${u.id}` },
        create: { id: `acc-${u.id}`, accountId: u.id, providerId: 'credential', userId: u.id, password: password || null },
        update: { password: password || null },
      });
      n++;
    }
    console.log(`✓ ${n} comptes`);

    n = 0;
    for (const c of courseRows.values()) {
      await prisma.course.upsert({ where: { id: c.id }, create: c, update: c });
      n++;
    }
    console.log(`✓ ${n} courses`);

    n = 0;
    for (const arr of tarifsByCourse.values()) {
      for (const t of arr) {
        await prisma.tarif.upsert({ where: { id: t.id }, create: t, update: t });
        n++;
      }
    }
    console.log(`✓ ${n} créneaux tarifés`);

    n = 0;
    for (const d of dispoRows.values()) {
      const { _explicitTarif, _rank, _modified, ...data } = d;
      void _explicitTarif; void _rank; void _modified;
      await prisma.disponibilite.upsert({
        where: { courseId_photographeId_tarifId: { courseId: data.courseId, photographeId: data.photographeId, tarifId: data.tarifId } },
        create: data,
        update: data,
      });
      n++;
    }
    console.log(`✓ ${n} disponibilités`);

    n = 0;
    for (const [month, softCost] of costs) {
      await prisma.monthlyCost.upsert({ where: { month }, create: { month, softCost }, update: { softCost } });
      n++;
    }
    console.log(`✓ ${n} mois de coûts`);

    // Lignes manquantes (en attente) pour les courses à venir, non archivées,
    // encore « En cours » (une course « Fait » ne rouvre pas les réponses)
    const activeUsers = await prisma.user.findMany({ where: { actif: true }, select: { id: true } });
    const upcoming = await prisma.course.findMany({ where: { archived: false, statutTraitement: 'inProgress', dateFin: { gte: new Date() } }, select: { id: true, tarifs: { select: { id: true } } } });
    const have = new Set((await prisma.disponibilite.findMany({ select: { courseId: true, photographeId: true, tarifId: true } })).map((x) => `${x.courseId}|${x.photographeId}|${x.tarifId}`));
    const rows: Prisma.DisponibiliteCreateManyInput[] = [];
    for (const c of upcoming) for (const t of c.tarifs) for (const u of activeUsers) {
      if (have.has(`${c.id}|${u.id}|${t.id}`)) continue;
      rows.push({ id: `dispo-${c.id}-${u.id}-${t.id}`, courseId: c.id, photographeId: u.id, tarifId: t.id });
    }
    if (rows.length) await prisma.disponibilite.createMany({ data: rows, skipDuplicates: true });
    console.log(`✓ ${rows.length} lignes « en attente » ajoutées sur les courses à venir`);
    console.log('Migration terminée. Lancer « npm run verify:sheets » pour contrôler.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('✗ Migration échouée :', e);
  process.exit(1);
});
