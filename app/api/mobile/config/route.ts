import { NextResponse } from 'next/server';
import { configApp } from '@/lib/mobile/appareils';

// GET /api/mobile/config — public : versions et liens des stores. L'app le lit
// au lancement, même déconnectée, pour l'écran « mets à jour ».
export async function GET() {
  try {
    const c = await configApp();
    return NextResponse.json(
      { latestVersion: c.latestVersion, minVersion: c.minVersion, message: c.message, iosUrl: c.iosUrl, androidUrl: c.androidUrl },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('[mobile] config', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
