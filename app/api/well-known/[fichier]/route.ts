import { NextResponse } from 'next/server';

/**
 * LIENS DU PLANNING QUI OUVRENT L'APP MOBILE (Théo, 27/10/2026).
 *
 * iPhone et Android ne sautent d'un lien web à l'app que si le site le
 * déclare dans /.well-known/ (servi ici par une réécriture de next.config).
 * Côté planning, les liens /photographer/… (fiche d'une course reçue par
 * email ou SMS) ouvrent l'app sur le téléphone d'un photographe qui l'a.
 *
 * Variables Vercel (sans elles, 404 et les liens restent web) :
 *   MOBILE_IOS_APP_IDS     « ÉQUIPE.com.photorunning.equipe » (identifiant d'équipe Apple + bundle)
 *   MOBILE_ANDROID_PACKAGE « com.photorunning.equipe »
 *   MOBILE_ANDROID_SHA256  empreintes SHA-256 du certificat de signature Play, séparées par des virgules
 */

const CHEMINS = ['/photographer/*'];

const liste = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export async function GET(_req: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const { fichier } = await params;
  const entetes = { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' };

  if (fichier === 'apple-app-site-association') {
    const appIDs = liste(process.env.MOBILE_IOS_APP_IDS);
    if (appIDs.length === 0) return NextResponse.json({ error: 'non configuré' }, { status: 404 });
    return new NextResponse(
      JSON.stringify({ applinks: { details: [{ appIDs, components: CHEMINS.map((c) => ({ '/': c })) }] } }),
      { headers: entetes },
    );
  }

  if (fichier === 'assetlinks.json') {
    const paquet = process.env.MOBILE_ANDROID_PACKAGE?.trim();
    const empreintes = liste(process.env.MOBILE_ANDROID_SHA256);
    if (!paquet || empreintes.length === 0) return NextResponse.json({ error: 'non configuré' }, { status: 404 });
    return new NextResponse(
      JSON.stringify([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: { namespace: 'android_app', package_name: paquet, sha256_cert_fingerprints: empreintes },
        },
      ]),
      { headers: entetes },
    );
  }

  return NextResponse.json({ error: 'introuvable' }, { status: 404 });
}
