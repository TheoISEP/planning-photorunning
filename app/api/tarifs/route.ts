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
      const tarifs = await sheetsService.getTarifsByCourseId(courseId);
      return NextResponse.json({ tarifs: tarifs || [] });
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
      firstTarifName: data.firstTarifName || '',
      secondTarifName: data.secondTarifName || '',
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

// PATCH /api/tarifs - Mettre à jour un tarif par ID
export async function PATCH(request: NextRequest) {
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

    if (!data.id) {
      return NextResponse.json({ error: 'ID du tarif requis' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    const updateData: any = {
      dateModification: new Date().toISOString(),
    };

    if (data.tarifPhotographe !== undefined) updateData.tarifPhotographe = data.tarifPhotographe.toString();
    if (data.bonusChefEquipe !== undefined) updateData.bonusChefEquipe = data.bonusChefEquipe.toString();
    if (data.firstTarifName !== undefined) updateData.firstTarifName = data.firstTarifName;
    if (data.secondTarifName !== undefined) updateData.secondTarifName = data.secondTarifName;

    const updatedTarif = await sheetsService.updateTarif(data.id, updateData);

    return NextResponse.json({ tarif: updatedTarif, success: true });
  } catch (error: any) {
    console.error('Update tarif error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du tarif' }, { status: 500 });
  }
}

// DELETE /api/tarifs - Supprimer un tarif par ID
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID du tarif requis' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();
    await sheetsService.deleteTarif(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete tarif error:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression du tarif' }, { status: 500 });
  }
}
