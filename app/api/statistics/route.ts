import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/statistics - Récupérer les statistiques du mois en cours
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

    // Si c'est un photographe, récupérer uniquement ses statistiques personnelles
    if (user.role === 'photographer') {
      const myStats = await sheetsService.getPhotographerStatistics(user.id);

      // Récupérer les stats du mois en cours (dernière entrée pour ce photographe)
      const currentMonthStats = myStats.length > 0 ? myStats[myStats.length - 1] : null;

      return NextResponse.json({
        photographerStats: currentMonthStats,
        allStats: myStats
      });
    }

    // Si c'est un admin, récupérer les statistiques globales
    if (user.role === 'admin') {
      const currentAdminStats = await sheetsService.getCurrentAdminStatistics();
      const allPhotographersStats = await sheetsService.getAllPhotographerStatistics();

      return NextResponse.json({
        adminStats: currentAdminStats,
        photographersStats: allPhotographersStats
      });
    }

    return NextResponse.json({ error: 'Rôle non reconnu' }, { status: 403 });
  } catch (error: any) {
    console.error('Get statistics error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des statistiques' }, { status: 500 });
  }
}
