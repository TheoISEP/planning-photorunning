import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/admin-stats - Récupérer les statistiques admin
export async function GET(request: NextRequest) {
  try {
    const sheetsService = new GoogleSheetsService();
    const stats = await sheetsService.getAdminStatistics();

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Get admin stats error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des statistiques' }, { status: 500 });
  }
}

// POST /api/admin-stats - Créer ou mettre à jour une statistique mensuelle
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
    const { month, softCost } = data;

    if (!month) {
      return NextResponse.json({ error: 'Le mois est requis' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    // Vérifier si une entrée existe déjà pour ce mois
    const [year, monthNum] = month.split('-');
    const existing = await sheetsService.getAdminStatisticsByMonth(monthNum, year);

    if (existing) {
      // Mettre à jour
      await sheetsService.updateAdminStatistics(month, { softCost: softCost || '0' });
    } else {
      // Créer
      await sheetsService.createAdminStatistics({
        month,
        softCost: softCost || '0',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update admin stats error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des statistiques' }, { status: 500 });
  }
}
