import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/photographers/[id]/stats - Récupérer les statistiques détaillées d'un photographe/admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const sheetsService = new GoogleSheetsService();

    // Récupérer l'utilisateur (photographe ou admin)
    let targetUser: any = null;
    let isAdmin = false;
    let isNonPaidAdmin = false;

    // Chercher d'abord dans les photographes
    const photographers = await sheetsService.getAllPhotographers();
    targetUser = photographers.find((p: any) => p.id === id);

    // Si pas trouvé, chercher dans les admins
    if (!targetUser) {
      const admins = await sheetsService.getAllAdmins();
      targetUser = admins.find((a: any) => a.id === id);
      if (targetUser) {
        isAdmin = true;
        isNonPaidAdmin = targetUser.nonRemunere === true || targetUser.nonRemunere === 'TRUE';
      }
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    // Récupérer toutes les disponibilités de cet utilisateur
    const disponibilites = await sheetsService.getDisponibilitesByPhotographerId(id);

    // Récupérer toutes les courses et tarifs
    const courses = await sheetsService.getAllCourses();
    const tarifs = await sheetsService.getAllTarifs();

    const now = new Date();
    const currentYear = now.getFullYear();

    // Créer un objet pour stocker les stats par mois
    const monthlyStats: Record<string, any> = {};

    // Parcourir toutes les disponibilités validées
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
          coursesDetails: [] as Array<{
            nom: string;
            ville: string;
            date: string;
            montant: number;
            statut: string;
          }>,
        };
      }

      monthlyStats[monthKey].nombreCourses++;
      monthlyStats[monthKey].nombrePrestations++;

      // Calculer le montant pour cette prestation
      const tarif = dispo.tarifId
        ? tarifs.find((t: any) => t.id === dispo.tarifId)
        : tarifs.find((t: any) => t.courseId === course.id);

      if (tarif) {
        let amount = 0;

        // Pour les admins non rémunérés : uniquement le tarif de base (pas de bonus chef)
        if (isNonPaidAdmin) {
          amount = Number(tarif.tarifPhotographe) || 0;
        } else {
          // Pour les photographes et admins rémunérés : tarif + bonus chef si applicable
          const tarifBase = Number(tarif.tarifPhotographe) || 0;
          const bonus = dispo.statut === 'teamLeader' ? (Number(tarif.bonusChefEquipe) || 0) : 0;
          amount = tarifBase + bonus;
        }

        monthlyStats[monthKey].montantTotal += amount;
        monthlyStats[monthKey].coursesDetails.push({
          nom: course.nom,
          ville: course.ville,
          date: course.dateDebut,
          montant: amount,
          statut: dispo.statut,
        });
      }
    }

    // Convertir en tableau et trier par date
    const statistics = Object.values(monthlyStats)
      .map((stat: any) => ({
        ...stat,
        coursesDetails: stat.coursesDetails.sort(
          (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
      }))
      .sort((a: any, b: any) => {
        if (a.annee !== b.annee) return a.annee - b.annee;
        return a.mois - b.mois;
      });

    return NextResponse.json({
      statistics,
      user: {
        id: targetUser.id,
        nom: targetUser.nom,
        prenom: targetUser.prenom,
        isAdmin,
        isNonPaidAdmin,
      },
    });
  } catch (error: any) {
    console.error('Get photographer stats error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des statistiques' }, { status: 500 });
  }
}
