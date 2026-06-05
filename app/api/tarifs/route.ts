import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';
import { CacheKeys, withCache } from '@/lib/cache';

// GET /api/tarifs - Liste tous les tarifs ou filtre par courseId
export async function GET(request: NextRequest) {
  try {
    const sheetsService = new GoogleSheetsService();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (courseId) {
      const tarif = await sheetsService.getTarifByCourseId(courseId);
      return NextResponse.json({ tarifs: tarif ? [tarif] : [] });
    }

    const tarifs = await withCache(
      CacheKeys.allTarifs(),
      () => sheetsService.getAllTarifs(),
      60000 // 1 minute de cache
    );
    return NextResponse.json({ tarifs });
  } catch (error: any) {
    console.error('Get tarifs error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des tarifs' }, { status: 500 });
  }
}

// POST /api/tarifs - Créer un nouveau tarif
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification et le rôle
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const authService = new AuthService();
    const user = authService.verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const data = await request.json();

    // Validation des champs requis
    if (!data.courseId || data.tarifPhotographe === undefined || data.bonusChefEquipe === undefined) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    const tarifData = {
      id: data.id || `tarif-${data.courseId}-${Date.now()}`,
      courseId: data.courseId,
      tarifPhotographe: data.tarifPhotographe.toString(),
      bonusChefEquipe: data.bonusChefEquipe.toString(),
      dateCreation: data.dateCreation || new Date().toISOString(),
      dateModification: new Date().toISOString(),
    };

    await sheetsService.createTarif(tarifData);

    return NextResponse.json({ tarif: tarifData, success: true });
  } catch (error: any) {
    console.error('Create tarif error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création du tarif' }, { status: 500 });
  }
}
