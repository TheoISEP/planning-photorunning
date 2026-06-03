import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/statistics/photographer - Récupérer les statistiques d'un photographe
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const authService = new AuthService();
    const user = authService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const sheetsService = new GoogleSheetsService();

    // Si c'est un photographe, récupérer seulement ses statistiques
    if (user.role === 'photographer') {
      const statistics = await sheetsService.getPhotographerStatistics(user.id);
      return NextResponse.json({ statistics });
    }

    // Si c'est un admin, récupérer toutes les statistiques
    if (user.role === 'admin') {
      const statistics = await sheetsService.getAllPhotographerStatistics();
      return NextResponse.json({ statistics });
    }

    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  } catch (error: any) {
    console.error('Get photographer statistics error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des statistiques' }, { status: 500 });
  }
}
