import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/statistics/admin - Récupérer les statistiques admin
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

    // Calculer les statistiques en temps réel pour l'admin
    const courses = await sheetsService.getAllCourses();
    const disponibilites = await sheetsService.getAllDisponibilites();
    const tarifs = await sheetsService.getAllTarifs();

    const now = new Date();
    const currentYear = now.getFullYear();

    // Créer un objet pour stocker les stats par mois
    const monthlyStats: Record<string, any> = {};

    // Parcourir toutes les courses
    for (const course of courses) {
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
          coutTotal: 0,
          nombrePhotographes: 0,
          photographesSet: new Set(),
        };
      }

      monthlyStats[monthKey].nombreCourses++;

      // Compter les prestations et les coûts pour cette course
      const courseDisponibilites = disponibilites.filter(
        (d: any) => d.courseId === course.id && (d.statut === 'validated' || d.statut === 'teamLeader')
      );

      monthlyStats[monthKey].nombrePrestations += courseDisponibilites.length;

      // Ajouter les photographes uniques
      courseDisponibilites.forEach((d: any) => {
        monthlyStats[monthKey].photographesSet.add(d.photographeId);
      });

      // Calculer le coût total
      for (const dispo of courseDisponibilites) {
        const tarif = dispo.tarifId
          ? tarifs.find((t: any) => t.id === dispo.tarifId)
          : tarifs.find((t: any) => t.courseId === course.id);

        if (tarif) {
          const tarifBase = Number(tarif.tarifPhotographe) || 0;
          const bonus = dispo.statut === 'teamLeader' ? (Number(tarif.bonusChefEquipe) || 0) : 0;
          monthlyStats[monthKey].coutTotal += tarifBase + bonus;
        }
      }
    }

    // Convertir les Sets en nombres et supprimer les Sets
    const statistics = Object.values(monthlyStats).map((stat: any) => {
      const { photographesSet, ...rest } = stat;
      return {
        ...rest,
        nombrePhotographes: photographesSet.size,
      };
    }).sort((a: any, b: any) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      return a.mois - b.mois;
    });

    return NextResponse.json({ statistics });
  } catch (error: any) {
    console.error('Get admin statistics error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des statistiques' }, { status: 500 });
  }
}
