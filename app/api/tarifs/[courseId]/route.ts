import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// PATCH /api/tarifs/[courseId] - Mettre à jour un tarif
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
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

    const { courseId } = await params;
    const data = await request.json();

    const sheetsService = new GoogleSheetsService();
    
    // Récupérer le tarif existant
    const existingTarif = await sheetsService.getTarifByCourseId(courseId);
    
    if (!existingTarif) {
      return NextResponse.json({ error: 'Tarif introuvable' }, { status: 404 });
    }

    // Mettre à jour le tarif
    const updatedTarif = await sheetsService.updateTarif(existingTarif.id, {
      tarifPhotographe: data.tarifPhotographe.toString(),
      bonusChefEquipe: data.bonusChefEquipe.toString(),
      firstTarifName: data.firstTarifName || '',
      secondTarifName: data.secondTarifName || '',
      dateModification: new Date().toISOString(),
    });

    return NextResponse.json({ tarif: updatedTarif, success: true });
  } catch (error: any) {
    console.error('Update tarif error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du tarif' }, { status: 500 });
  }
}
