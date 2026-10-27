/**
 * Les deux autres apps que l'app mobile consulte, toujours à travers le
 * planning (le téléphone n'a jamais leurs clés) :
 *
 *  - l'app des briefs  : BRIEFS_APP_URL + BRIEFS_INTEGRATION_KEY (existantes)
 *  - l'admin           : ADMIN_APP_URL (défaut https://www.adminphotorunning.fr)
 *                        + ADMIN_INTEGRATION_KEY (existante, même valeur que
 *                        PLANNING_INTEGRATION_KEY côté admin)
 *
 * Une source injoignable ne casse jamais la synchro : la partie concernée
 * revient à null et le téléphone garde ce qu'il avait.
 */

const DELAI_MS = 15_000;

function cfgBriefs() {
  const url = (process.env.BRIEFS_APP_URL ?? '').replace(/\/$/, '');
  const cle = process.env.BRIEFS_INTEGRATION_KEY ?? '';
  return url && cle ? { url, cle } : null;
}

function cfgAdmin() {
  const url = (process.env.ADMIN_APP_URL ?? 'https://www.adminphotorunning.fr').replace(/\/$/, '');
  const cle = process.env.ADMIN_INTEGRATION_KEY ?? '';
  return url && cle ? { url, cle } : null;
}

export class SourceErreur extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function appelBriefs<T>(body: Record<string, unknown>): Promise<T> {
  const cfg = cfgBriefs();
  if (!cfg) throw new SourceErreur('Liaison briefs non configurée', 503);
  const res = await fetch(`${cfg.url}/api/integration/mobile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-integration-key': cfg.cle },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DELAI_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new SourceErreur(`briefs HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

export type BriefIndex = {
  id: string;
  title: string;
  year: number;
  eventDate: string | null;
  updatedAt: string;
  folderName: string | null;
  status: string;
  shareToken: string | null;
  shareUrl: string | null;
};

export async function indexBriefs(input: {
  ids: string[];
  personne?: { prenom: string; nom: string } | null;
  tous?: boolean;
}): Promise<BriefIndex[]> {
  const r = await appelBriefs<{ briefs: BriefIndex[] }>({ action: 'index', ...input });
  return r.briefs;
}

export async function briefsComplets(ids: string[]): Promise<unknown[]> {
  const r = await appelBriefs<{ briefs: unknown[] }>({ action: 'briefs', ids });
  return r.briefs;
}

export async function briefDuLien(token: string): Promise<string | null> {
  try {
    const r = await appelBriefs<{ briefId: string }>({ action: 'lien', token });
    return r.briefId;
  } catch (err) {
    if (err instanceof SourceErreur && err.status === 404) return null;
    throw err;
  }
}

export async function lienDePartage(briefId: string): Promise<{ token: string; url: string | null }> {
  return appelBriefs<{ token: string; url: string | null }>({ action: 'partager', briefId });
}

export type ContactEquipe = {
  id: string;
  prenom: string;
  nom: string;
  poste: string;
  organisation: string;
  aSavoir: string;
  telephones: { numero: string; libelle: string; whatsapp: boolean }[];
  emails: { adresse: string; libelle: string }[];
};

/** Les contacts de l'annuaire cochés « visibles des photographes ». */
export async function contactsEquipe(): Promise<ContactEquipe[]> {
  const cfg = cfgAdmin();
  if (!cfg) throw new SourceErreur('Liaison admin non configurée', 503);
  const res = await fetch(`${cfg.url}/api/integration/annuaire/equipe`, {
    headers: { 'x-integration-key': cfg.cle },
    signal: AbortSignal.timeout(DELAI_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new SourceErreur(`admin HTTP ${res.status}`, res.status);
  const r = (await res.json()) as { contacts: ContactEquipe[] };
  return r.contacts;
}

/** Résultat d'une source qui peut manquer sans tout faire échouer. */
export async function sansEchec<T>(nom: string, f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch (err) {
    console.error(`[mobile] source ${nom} indisponible`, err);
    return null;
  }
}
