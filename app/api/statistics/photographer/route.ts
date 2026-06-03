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

    // Si c'est un photographe, calculer ses statistiques en temps réel
    if (user.role === 'photographer') {
      // Récupérer toutes les disponibilités du photographe
      const disponibilites = await sheetsService.getDisponibilitesByPhotographerId(user.id);

      const now = new Date();
      const currentYear = now.getFullYear();

      // Créer un objet pour stocker les stats par mois
      const monthlyStats: Record<string, any> = {};

      for (const dispo of disponibilites) {
        if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
          // Récupérer la course associée
          const course = await sheetsService.getCourseById(dispo.courseId);
          if (!course) continue;

          const courseDate = new Date(course.dateDebut);
          const courseYear = courseDate.getFullYear();
          const courseMonth = courseDate.getMonth() + 1; // 1-12

          // Ne garder que l'année en cours pour les statistiques
          if (courseYear !== currentYear) continue;

          const monthKey = `${courseYear}-${courseMonth}`;

          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
              photographeId: user.id,
              mois: courseMonth,
              annee: courseYear,
              nombreCourses: 0,
              nombrePrestations: 0,
              montantTotal: 0,
              heuresTravail: 0,
            };
          }

          monthlyStats[monthKey].nombreCourses++;
          monthlyStats[monthKey].nombrePrestations++;

          // Récupérer le tarif
          const tarif = dispo.tarifId
            ? await sheetsService.getTarifById(dispo.tarifId)
            : (await sheetsService.getTarifsByCourseId(dispo.courseId))[0];

          if (tarif) {
            const tarifBase = Number(tarif.tarifPhotographe) || 0;
            const bonus = dispo.statut === 'teamLeader' ? (Number(tarif.bonusChefEquipe) || 0) : 0;
            monthlyStats[monthKey].montantTotal += tarifBase + bonus;

            // Estimation des heures (par défaut 8h par course, ou selon le nombre de jours)
            const nbJours = Number(tarif.nombreJours) || 1;
            monthlyStats[monthKey].heuresTravail += nbJours * 8;
          }
        }
      }

      // Convertir en tableau et trier par mois
      const statistics = Object.values(monthlyStats).sort((a: any, b: any) => {
        if (a.annee !== b.annee) return a.annee - b.annee;
        return a.mois - b.mois;
      });

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
