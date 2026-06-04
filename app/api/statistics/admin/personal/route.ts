import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/statistics/admin/personal - Récupérer les statistiques personnelles de l'admin
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
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const sheetsService = new GoogleSheetsService();

    // Récupérer toutes les disponibilités de l'admin
    const disponibilites = await sheetsService.getDisponibilitesByPhotographerId(user.id);

    // Récupérer toutes les courses et tarifs
    const courses = await sheetsService.getAllCourses();
    const tarifs = await sheetsService.getAllTarifs();

    const now = new Date();
    const currentYear = now.getFullYear();

    // Créer un objet pour stocker les stats par mois
    const monthlyStats: Record<string, any> = {};

    // Parcourir toutes les disponibilités validées de l'admin
    for (const dispo of disponibilites) {
      if (dispo.statut !== 'validated' && dispo.statut !== 'teamLeader') continue;

      // Trouver la course associée
      const course = courses.find((c: any) => c.id === dispo.courseId);
      if (!course) continue;

      const courseDate = new Date(course.dateDebut);
      const courseYear = courseDate.getFullYear();
      const courseMonth = courseDate.getMonth() + 1; // 1-12

      // Ne garder que l'année en cours
      if (courseYear !== currentYear) continue;

      const monthKey = `${courseYear}-${courseMonth}`;

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          mois: courseMonth,
          annee: courseYear,
          nombreCourses: 0,
          nombrePrestations: 0,
          montantTotal: 0,
        };
      }

      monthlyStats[monthKey].nombreCourses++;
      monthlyStats[monthKey].nombrePrestations++;

      // Calculer le montant pour cette prestation
      const tarif = dispo.tarifId
        ? tarifs.find((t: any) => t.id === dispo.tarifId)
        : tarifs.find((t: any) => t.courseId === course.id);

      if (tarif) {
        const tarifBase = Number(tarif.tarifPhotographe) || 0;
        const bonus = dispo.statut === 'teamLeader' ? (Number(tarif.bonusChefEquipe) || 0) : 0;
        monthlyStats[monthKey].montantTotal += tarifBase + bonus;
      }
    }

    // Convertir en tableau et trier par date
    const statistics = Object.values(monthlyStats).sort((a: any, b: any) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      return a.mois - b.mois;
    });

    return NextResponse.json({ statistics });
  } catch (error: any) {
    console.error('Get admin personal statistics error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des statistiques' }, { status: 500 });
  }
}
