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
      console.log(`📊 Photographe ${user.id}: ${disponibilites.length} disponibilités totales`);
      const validatedCount = disponibilites.filter((d: any) => d.statut === 'validated' || d.statut === 'teamLeader').length;
      console.log(`✅ ${validatedCount} disponibilités validées/teamLeader`);

      const now = new Date();
      const currentYear = now.getFullYear();

      // Créer un objet pour stocker les stats par mois
      const monthlyStats: Record<string, any> = {};
      // Suivre les courses déjà comptées pour ne pas les compter plusieurs fois
      const coursesCountedPerMonth: Record<string, Set<string>> = {};

      // Regrouper les disponibilités par courseId-tarifId et ne garder que le meilleur statut
      // IMPORTANT: Pour les courses à double tarif, on peut avoir des doublons si:
      // - Une ligne a tarifId=X et statut=validated (nouvelle assignation admin)
      // - Une ligne a tarifId=null et statut=teamLeader (ancienne donnée)
      // Il faut PRIORISER les dispos avec tarifId exact sur celles avec tarifId=null

      // Grouper d'abord par course pour détecter les courses double tarif
      const disposByCourse = new Map<string, any[]>();
      for (const dispo of disponibilites) {
        if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
          if (!disposByCourse.has(dispo.courseId)) {
            disposByCourse.set(dispo.courseId, []);
          }
          disposByCourse.get(dispo.courseId)!.push(dispo);
        }
      }

      const dispoMap = new Map<string, any>();
      for (const [courseId, courseDispos] of disposByCourse.entries()) {
        // Récupérer les tarifs de la course
        const course = await sheetsService.getCourseById(courseId);
        if (!course) continue;

        const courseTarifs = await sheetsService.getTarifsByCourseId(courseId);
        const hasTwoTarifs = course.twoPrices === 'TRUE' && courseTarifs.length > 1;

        // Pour les courses double tarif, filtrer les dispos avec tarifId exact si elles existent
        let filteredDispos = courseDispos;
        if (hasTwoTarifs) {
          const disposWithTarif = courseDispos.filter(d => d.tarifId);
          if (disposWithTarif.length > 0) {
            filteredDispos = disposWithTarif;
          }
        }

        // Grouper par tarifId résolu
        for (const dispo of filteredDispos) {
          let resolvedTarifId = dispo.tarifId;
          if (!resolvedTarifId) {
            resolvedTarifId = courseTarifs[0]?.id || 'default';
          }

          const key = `${courseId}-${resolvedTarifId}`;
          const existing = dispoMap.get(key);

          // Créer une copie du dispo avec le tarifId résolu
          const dispoWithResolvedTarif = { ...dispo, tarifId: resolvedTarifId };

          // Prioriser tarifId exact > null, puis teamLeader > validated
          const shouldReplace = !existing ||
            (dispo.tarifId && !existing.tarifId) ||
            (dispo.tarifId === existing.tarifId && dispo.statut === 'teamLeader' && existing.statut === 'validated');

          if (shouldReplace) {
            dispoMap.set(key, dispoWithResolvedTarif);
          }
        }
      }

      console.log(`🔄 Après déduplication: ${dispoMap.size} disponibilités uniques`);

      // Traiter les disponibilités dédoublonnées
      for (const dispo of dispoMap.values()) {
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
            coursesCountedPerMonth[monthKey] = new Set<string>();
          }

          // Ne compter la course qu'une seule fois, même s'il y a plusieurs tarifs/disponibilités
          if (!coursesCountedPerMonth[monthKey].has(dispo.courseId)) {
            monthlyStats[monthKey].nombreCourses++;
            monthlyStats[monthKey].nombrePrestations++;
            coursesCountedPerMonth[monthKey].add(dispo.courseId);
          }

          // Récupérer le tarif - d'abord essayer avec le tarifId, puis retomber sur le tarif par défaut
          let tarif = null;
          if (dispo.tarifId) {
            console.log(`📋 Recherche tarif avec ID: ${dispo.tarifId} pour course ${dispo.courseId}`);
            tarif = await sheetsService.getTarifById(dispo.tarifId);
            if (!tarif) {
              console.log(`⚠️ Tarif ${dispo.tarifId} non trouvé (ID obsolète), recherche du tarif par défaut...`);
            }
          }
          // Si le tarif n'existe pas (ID obsolète), utiliser le tarif par défaut de la course
          if (!tarif) {
            const tarifs = await sheetsService.getTarifsByCourseId(dispo.courseId);
            console.log(`📋 Tarifs trouvés pour course ${dispo.courseId}:`, tarifs.length, tarifs.map((t: any) => ({ id: t.id, montant: t.tarifPhotographe })));
            tarif = tarifs[0];
          }

          if (tarif) {
            const tarifBase = Number(tarif.tarifPhotographe) || 0;
            const bonus = dispo.statut === 'teamLeader' ? (Number(tarif.bonusChefEquipe) || 0) : 0;
            console.log(`💰 Ajout de ${tarifBase + bonus}€ pour ${course.nom} (base: ${tarifBase}, bonus: ${bonus})`);
            monthlyStats[monthKey].montantTotal = Number(monthlyStats[monthKey].montantTotal) + tarifBase + bonus;

            // Estimation des heures (par défaut 8h par course, ou selon le nombre de jours)
            const nbJours = Number(tarif.nombreJours) || 1;
            monthlyStats[monthKey].heuresTravail += nbJours * 8;
          } else {
            console.error(`❌ Aucun tarif trouvé pour course ${course.nom} (${dispo.courseId})`);
          }
      }

      // Convertir en tableau et trier par mois
      const statistics = Object.values(monthlyStats).sort((a: any, b: any) => {
        if (a.annee !== b.annee) return a.annee - b.annee;
        return a.mois - b.mois;
      });

      console.log(`📈 Statistiques finales: ${statistics.length} mois`, statistics);

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
