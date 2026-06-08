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

    // Si c'est un photographe, calculer les statistiques en temps réel
    if (user.role === 'photographer') {
      // Récupérer toutes les disponibilités du photographe
      const disponibilites = await sheetsService.getDisponibilitesByPhotographerId(user.id);

      // Filtrer les disponibilités validées ou référent pour le mois en cours
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11

      let nombreCourses = 0;
      let nombrePrestations = 0;
      let montantTotal = 0;
      let heuresTravail = 0;

      for (const dispo of disponibilites) {
        if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
          // Récupérer la course associée
          const course = await sheetsService.getCourseById(dispo.courseId);
          if (!course) continue;

          const courseDate = new Date(course.dateDebut);
          const courseYear = courseDate.getFullYear();
          const courseMonth = courseDate.getMonth();

          // Vérifier si c'est le mois en cours
          if (courseYear === currentYear && courseMonth === currentMonth) {
            nombreCourses++;
            nombrePrestations++;

            // Récupérer le tarif
            const tarif = dispo.tarifId
              ? await sheetsService.getTarifById(dispo.tarifId)
              : (await sheetsService.getTarifsByCourseId(dispo.courseId))[0];

            if (tarif) {
              const tarifBase = Number(tarif.tarifPhotographe) || 0;
              const bonus = dispo.statut === 'teamLeader' ? (Number(tarif.bonusChefEquipe) || 0) : 0;
              montantTotal += tarifBase + bonus;

              // Estimation des heures (par défaut 8h par course, ou selon le nombre de jours)
              const nbJours = Number(tarif.nombreJours) || 1;
              heuresTravail += nbJours * 8;
            }
          }
        }
      }

      const currentMonthStats = {
        photographeId: user.id,
        mois: currentMonth + 1,
        annee: currentYear,
        nombreCourses,
        nombrePrestations,
        montantTotal,
        heuresTravail,
        tauxReussite: 100
      };

      return NextResponse.json({
        photographerStats: currentMonthStats,
        allStats: [currentMonthStats]
      });
    }

    // Si c'est un admin, vérifier s'il veut ses stats personnelles ou les stats globales
    if (user.role === 'admin') {
      const { searchParams } = new URL(request.url);
      const personal = searchParams.get('personal') === 'true';

      // Si l'admin veut ses statistiques personnelles (pour "Mon calendrier")
      if (personal) {
        // Calculer les stats de l'admin comme pour un photographe
        const disponibilites = await sheetsService.getDisponibilitesByPhotographerId(user.id);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11

        let nombreCourses = 0;
        let nombrePrestations = 0;
        let montantTotal = 0;
        let heuresTravail = 0;

        for (const dispo of disponibilites) {
          if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
            const course = await sheetsService.getCourseById(dispo.courseId);
            if (!course) continue;

            const courseDate = new Date(course.dateDebut);
            const courseYear = courseDate.getFullYear();
            const courseMonth = courseDate.getMonth();

            if (courseYear === currentYear && courseMonth === currentMonth) {
              nombreCourses++;
              nombrePrestations++;

              const tarif = dispo.tarifId
                ? await sheetsService.getTarifById(dispo.tarifId)
                : (await sheetsService.getTarifsByCourseId(dispo.courseId))[0];

              if (tarif) {
                const tarifBase = Number(tarif.tarifPhotographe) || 0;
                const bonus = dispo.statut === 'teamLeader' ? (Number(tarif.bonusChefEquipe) || 0) : 0;
                montantTotal += tarifBase + bonus;

                const nbJours = Number(tarif.nombreJours) || 1;
                heuresTravail += nbJours * 8;
              }
            }
          }
        }

        const currentMonthStats = {
          photographeId: user.id,
          mois: currentMonth + 1,
          annee: currentYear,
          nombreCourses,
          nombrePrestations,
          montantTotal,
          heuresTravail,
          tauxReussite: 100
        };

        return NextResponse.json({
          photographerStats: currentMonthStats,
          allStats: [currentMonthStats]
        });
      }

      // Sinon, retourner les statistiques globales
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
