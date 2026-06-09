import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';
import { cache, CacheKeys, withCache } from '@/lib/cache';

// GET /api/disponibilites - Récupérer les disponibilités d'un photographe
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
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const photographerId = searchParams.get('photographerId');

    // Si c'est un photographe
    if (user.role === 'photographer') {
      // Si courseId est fourni, récupérer TOUTES les disponibilités de cette course (avec cache)
      if (courseId) {
        const allDisponibilites = await withCache(
          CacheKeys.allDisponibilites(),
          () => sheetsService.getAllDisponibilites(),
          30000 // 30 secondes
        );
        const disponibilites = allDisponibilites.filter((d: any) => d.courseId === courseId);
        return NextResponse.json({ disponibilites });
      }

      // Déterminer quel photographe on veut charger
      let targetPhotographerId = user.id;

      // Si un photographerId est fourni et qu'il est différent de l'utilisateur connecté
      if (photographerId && photographerId !== user.id) {
        // Vérifier si le photographe connecté est référent de celui-ci
        const currentPhotographer = await sheetsService.getPhotographerById(user.id);
        const isReferent = currentPhotographer && (
          currentPhotographer.chargeOne === photographerId ||
          currentPhotographer.chargeTwo === photographerId ||
          currentPhotographer.chargeThree === photographerId ||
          currentPhotographer.chargeFour === photographerId ||
          currentPhotographer.chargeFive === photographerId
        );

        if (!isReferent) {
          return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
        }

        targetPhotographerId = photographerId;
      }

      // Récupérer les disponibilités du photographe cible (avec cache)
      const disponibilites = await withCache(
        CacheKeys.disponibilitesByPhotographer(targetPhotographerId),
        () => sheetsService.getDisponibilitesByPhotographerId(targetPhotographerId),
        30000 // 30 secondes
      );

      // Récupérer TOUTES les courses et tarifs en UNE SEULE FOIS (avec cache)
      const [allCourses, allTarifs] = await Promise.all([
        withCache(CacheKeys.allCourses(), () => sheetsService.getAllCourses(), 60000), // 1 minute
        withCache(CacheKeys.allTarifs(), () => sheetsService.getAllTarifs(), 60000), // 1 minute
      ]);

      // Créer des maps pour un accès rapide
      const coursesMap = new Map(allCourses.map((c: any) => [c.id, c]));
      const tarifsMap = new Map(allTarifs.map((t: any) => [t.id, t]));

      // Enrichir les disponibilités avec les infos des courses
      const enrichedDispos = disponibilites.map(dispo => {
        const course = coursesMap.get(dispo.courseId);
        const tarif = dispo.tarifId ? tarifsMap.get(dispo.tarifId) : null;
        return {
          ...dispo,
          course: course ? {
            ...course,
            tarifPhotographe: tarif?.tarifPhotographe || 0,
            bonusChefEquipe: tarif?.bonusChefEquipe || 0,
            tarifDescription: tarif?.description || '',
            tarifNombreJours: tarif?.nombreJours || '',
          } : null,
        };
      });

      return NextResponse.json({ disponibilites: enrichedDispos });
    }

    // Si c'est un admin, récupérer toutes les disponibilités (ou filtrer par courseId/photographerId)
    if (user.role === 'admin') {
      let disponibilites = await sheetsService.getAllDisponibilites();

      // Filtrer par courseId si fourni
      if (courseId) {
        disponibilites = disponibilites.filter((d: any) => d.courseId === courseId);
      }

      // Filtrer par photographerId si fourni
      if (photographerId) {
        disponibilites = disponibilites.filter((d: any) => d.photographeId === photographerId);
      }

      return NextResponse.json({ disponibilites });
    }

    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
  } catch (error: any) {
    console.error('Get disponibilites error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des disponibilités' }, { status: 500 });
  }
}

// POST /api/disponibilites - Créer une nouvelle disponibilité
export async function POST(request: NextRequest) {
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

    const { photographeId, courseId, statut, dateDeclaration, tarifId, noteAdmin } = await request.json();

    if (!photographeId || !courseId || !statut) {
      return NextResponse.json({ error: 'photographeId, courseId et statut requis' }, { status: 400 });
    }

    // Valider le statut
    const validStatuses = ['pending', 'available', 'unavailable', 'validated', 'teamLeader', 'rejected'];
    if (!validStatuses.includes(statut)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    // Vérifier les permissions : le photographe ne peut créer que pour lui-même ou ses photographes à charge
    if (user.role === 'photographer' && user.id !== photographeId) {
      // Charger les données du photographe connecté pour vérifier s'il est référent
      const currentPhotographer = await sheetsService.getPhotographerById(user.id);

      const isReferent = currentPhotographer && (
        currentPhotographer.chargeOne === photographeId ||
        currentPhotographer.chargeTwo === photographeId ||
        currentPhotographer.chargeThree === photographeId ||
        currentPhotographer.chargeFour === photographeId ||
        currentPhotographer.chargeFive === photographeId
      );

      if (!isReferent) {
        return NextResponse.json({
          error: 'Vous ne pouvez créer des disponibilités que pour vous-même ou vos photographes à charge'
        }, { status: 403 });
      }
    }

    // Générer un ID unique
    const id = `dispo-${courseId}-${photographeId}`;

    // Vérifier si la disponibilité existe déjà
    try {
      const existing = await sheetsService.getDisponibiliteById(id);
      if (existing) {
        return NextResponse.json({ error: 'Disponibilité déjà existante' }, { status: 409 });
      }
    } catch (error) {
      // Disponibilité n'existe pas, on peut continuer
    }

    // Créer la disponibilité
    const newDisponibilite = {
      id,
      courseId,
      photographeId,
      statut,
      dateDeclaration: dateDeclaration || new Date().toISOString(),
      dateModification: new Date().toISOString(),
      noteAdmin: noteAdmin || '',
      tarifId: tarifId || '',
    };

    await sheetsService.createDisponibilite(newDisponibilite);

    // Invalider le cache
    cache.delete(CacheKeys.allDisponibilites());
    cache.delete(CacheKeys.disponibilitesByPhotographer(photographeId));
    cache.delete(CacheKeys.disponibilitesByCourse(courseId));

    console.log(`✅ Disponibilité créée: ${id} (${statut})`);

    return NextResponse.json({ disponibilite: newDisponibilite, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Create disponibilite error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de la disponibilité' }, { status: 500 });
  }
}

// PATCH /api/disponibilites - Modifier le statut d'une disponibilité (ou la créer si elle n'existe pas)
export async function PATCH(request: NextRequest) {
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

    const { id, statut, noteAdmin, courseId, photographeId, tarifId } = await request.json();

    if (!id || !statut) {
      return NextResponse.json({ error: 'ID et statut requis' }, { status: 400 });
    }

    // Valider le statut
    const validStatuses = ['pending', 'available', 'unavailable', 'validated', 'teamLeader', 'rejected'];
    if (!validStatuses.includes(statut)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    // Si c'est un photographe, vérifier les permissions et contraintes
    if (user.role === 'photographer') {
      // Extraire le courseId et photographeId de l'ID de disponibilité
      // Formats possibles:
      // - dispo-{courseId}-{photographeId}
      // - dispo-{courseId}-{photographeId}-{tarifId}
      const parts = id.split('-');
      let courseIdFromDispoId = null;
      let photographeIdFromDispoId = null;

      if (parts.length >= 3) {
        // Si on a au moins 3 parties (dispo, courseId, photographeId)
        courseIdFromDispoId = parts[1];
        photographeIdFromDispoId = parts[2];
        // Si il y a 4 parties, le 4ème est le tarifId (on l'ignore pour les permissions)
      }

      // Vérifier les permissions : soit c'est sa propre dispo, soit il est référent du photographe
      if (user.id !== photographeIdFromDispoId && user.id !== photographeId) {
        // Charger les données du photographe connecté pour vérifier s'il est référent
        const currentPhotographer = await sheetsService.getPhotographerById(user.id);

        const isReferent = currentPhotographer && (
          currentPhotographer.chargeOne === photographeIdFromDispoId ||
          currentPhotographer.chargeOne === photographeId ||
          currentPhotographer.chargeTwo === photographeIdFromDispoId ||
          currentPhotographer.chargeTwo === photographeId ||
          currentPhotographer.chargeThree === photographeIdFromDispoId ||
          currentPhotographer.chargeThree === photographeId ||
          currentPhotographer.chargeFour === photographeIdFromDispoId ||
          currentPhotographer.chargeFour === photographeId ||
          currentPhotographer.chargeFive === photographeIdFromDispoId ||
          currentPhotographer.chargeFive === photographeId
        );

        if (!isReferent) {
          return NextResponse.json({
            error: 'Vous ne pouvez modifier que vos propres disponibilités ou celles de vos photographes à charge'
          }, { status: 403 });
        }
      }

      // Vérifier que la course n'est pas archivée
      if (courseIdFromDispoId) {
        const course = await sheetsService.getCourseById(courseIdFromDispoId);
        if (course && course.archived === 'oui') {
          return NextResponse.json({
            error: 'Vous ne pouvez pas modifier une disponibilité pour une course archivée'
          }, { status: 403 });
        }

        // Vérifier que la course est encore en cours (statutTraitement !== 'done')
        if (course && course.statutTraitement === 'done') {
          return NextResponse.json({
            error: 'Vous ne pouvez pas modifier une disponibilité pour une course finalisée'
          }, { status: 403 });
        }
      }

      // Vérifier que le statut actuel permet la modification (uniquement pending, available, unavailable)
      // Les photographes ne peuvent pas modifier les statuts validated, teamLeader, rejected
      try {
        const existingDispo = await sheetsService.getDisponibiliteById(id);
        if (existingDispo && !['pending', 'available', 'unavailable'].includes(existingDispo.statut)) {
          return NextResponse.json({
            error: 'Vous ne pouvez pas modifier une disponibilité validée, refusée ou avec un rôle de chef d\'équipe assigné'
          }, { status: 403 });
        }
      } catch (error) {
        // Si la disponibilité n'existe pas encore, on peut continuer
      }

      // Les photographes ne peuvent changer le statut qu'entre pending, available, unavailable
      if (!['pending', 'available', 'unavailable'].includes(statut)) {
        return NextResponse.json({
          error: 'Vous ne pouvez utiliser que les statuts: en attente, disponible ou indisponible'
        }, { status: 403 });
      }
    }

    // Mettre à jour la disponibilité
    const updateData: any = {
      statut,
      dateModification: new Date().toISOString(),
    };

    // Permettre à tout le monde de passer le tarifId (important pour les courses avec deux tarifs)
    if (tarifId !== undefined) {
      updateData.tarifId = tarifId;
    }

    // Seul l'admin peut ajouter une note
    if (user.role === 'admin') {
      if (noteAdmin !== undefined) {
        updateData.noteAdmin = noteAdmin;
      }
    }

    try {
      // Essayer de mettre à jour
      console.log(`📝 Tentative de mise à jour de la disponibilité: ${id}`, updateData);
      const updatedDisponibilite = await sheetsService.updateDisponibilite(id, updateData);
      console.log(`✅ Disponibilité mise à jour avec succès:`, updatedDisponibilite);

      // Invalider le cache après modification
      cache.delete(CacheKeys.allDisponibilites());
      cache.delete(CacheKeys.disponibilite(id));
      if (photographeId) {
        cache.delete(CacheKeys.disponibilitesByPhotographer(photographeId));
      }
      if (courseId) {
        cache.delete(CacheKeys.disponibilitesByCourse(courseId));
      }

      return NextResponse.json({ disponibilite: updatedDisponibilite, success: true });
    } catch (updateError: any) {
      // Si la disponibilité n'existe pas, la créer
      if (updateError.message?.includes('non trouvée') || updateError.message?.includes('not found')) {
        console.log('Disponibilité non trouvée, création automatique...');

        // Vérifier qu'on a bien courseId et photographeId
        if (!courseId || !photographeId) {
          return NextResponse.json({
            error: 'courseId et photographeId requis pour créer une disponibilité'
          }, { status: 400 });
        }

        // Créer un ID cohérent avec le tarifId si présent
        let finalId = id;
        if (tarifId && !id.endsWith(`-${tarifId}`)) {
          // Si l'ID ne contient pas déjà le tarifId à la fin, on le reconstruit
          finalId = `dispo-${courseId}-${photographeId}-${tarifId}`;
        } else if (!tarifId && id.split('-').length === 4) {
          // Si pas de tarifId mais l'ID en a un, on le reconstruit sans
          finalId = `dispo-${courseId}-${photographeId}`;
        }

        // Créer la disponibilité
        const newDisponibilite = {
          id: finalId,
          courseId,
          photographeId,
          statut,
          dateDeclaration: new Date().toISOString(),
          dateModification: new Date().toISOString(),
          noteAdmin: noteAdmin || '',
          tarifId: tarifId || '',
        };

        console.log(`➕ Création de nouvelle disponibilité:`, newDisponibilite);
        await sheetsService.createDisponibilite(newDisponibilite);
        console.log(`✅ Disponibilité créée avec succès`);

        // Invalider le cache après création
        cache.delete(CacheKeys.allDisponibilites());
        cache.delete(CacheKeys.disponibilitesByPhotographer(photographeId));
        cache.delete(CacheKeys.disponibilitesByCourse(courseId));

        return NextResponse.json({ disponibilite: newDisponibilite, success: true, created: true });
      }

      // Si c'est une autre erreur, la relancer
      throw updateError;
    }
  } catch (error: any) {
    console.error('Update disponibilite error:', error);
    return NextResponse.json({ error: 'Erreur lors de la modification de la disponibilité' }, { status: 500 });
  }
}

// PUT /api/disponibilites - Mise à jour en masse des disponibilités (bulk update)
export async function PUT(request: NextRequest) {
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

    // Seul l'admin peut faire des mises à jour en masse
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { disponibilites, statut, courseId } = await request.json();

    if (!disponibilites || !Array.isArray(disponibilites) || disponibilites.length === 0) {
      return NextResponse.json({ error: 'Tableau de disponibilités requis' }, { status: 400 });
    }

    if (!statut) {
      return NextResponse.json({ error: 'Statut requis' }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ error: 'courseId requis' }, { status: 400 });
    }

    // Valider le statut
    const validStatuses = ['pending', 'available', 'unavailable', 'validated', 'teamLeader', 'rejected'];
    if (!validStatuses.includes(statut)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    console.log(`🔄 Mise à jour en masse de ${disponibilites.length} disponibilités avec le statut "${statut}"`);

    // Récupérer les IDs existants
    const ids = disponibilites.map(d => d.id);
    const updateData = {
      statut,
      dateModification: new Date().toISOString(),
    };

    // Tenter la mise à jour en masse
    const updatedDisponibilites = await sheetsService.bulkUpdateDisponibilites(ids, updateData);

    // Si certaines disponibilités n'existent pas, les créer
    const missingCount = disponibilites.length - updatedDisponibilites.length;
    if (missingCount > 0) {
      console.log(`⚠️ ${missingCount} disponibilités n'existent pas, création en cours...`);

      const updatedIds = updatedDisponibilites.map(d => d.id);
      const missingDisponibilites = disponibilites.filter(d => !updatedIds.includes(d.id));

      // Créer les disponibilités manquantes
      const createdDisponibilites = [];
      for (const dispo of missingDisponibilites) {
        const newDisponibilite = {
          id: dispo.id,
          courseId,
          photographeId: dispo.photographeId,
          statut,
          dateDeclaration: new Date().toISOString(),
          dateModification: new Date().toISOString(),
          noteAdmin: '',
          tarifId: '',
        };

        try {
          await sheetsService.createDisponibilite(newDisponibilite);
          createdDisponibilites.push(newDisponibilite);
          console.log(`✅ Disponibilité créée: ${dispo.id} pour photographe ${dispo.photographeId}`);
        } catch (error) {
          console.error(`❌ Erreur création disponibilité ${dispo.id}:`, error);
        }
      }

      console.log(`✅ ${updatedDisponibilites.length} mises à jour + ${createdDisponibilites.length} créées`);

      return NextResponse.json({
        success: true,
        count: updatedDisponibilites.length + createdDisponibilites.length,
        updated: updatedDisponibilites.length,
        created: createdDisponibilites.length,
        disponibilites: [...updatedDisponibilites, ...createdDisponibilites],
      });
    }

    console.log(`✅ ${updatedDisponibilites.length} disponibilités mises à jour avec succès`);

    return NextResponse.json({
      success: true,
      count: updatedDisponibilites.length,
      updated: updatedDisponibilites.length,
      created: 0,
      disponibilites: updatedDisponibilites,
    });
  } catch (error: any) {
    console.error('Bulk update disponibilites error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour en masse' }, { status: 500 });
  }
}
