import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

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

    // Si c'est un photographe
    if (user.role === 'photographer') {
      // Si courseId est fourni, récupérer TOUTES les disponibilités de cette course
      // (pour pouvoir afficher l'équipe assignée)
      if (courseId) {
        const allDisponibilites = await sheetsService.getAllDisponibilites();
        const disponibilites = allDisponibilites.filter((d: any) => d.courseId === courseId);
        return NextResponse.json({ disponibilites });
      }

      // Sinon, récupérer seulement les disponibilités du photographe
      const disponibilites = await sheetsService.getDisponibilitesByPhotographerId(user.id);

      // Récupérer les infos des courses et tarifs pour chaque disponibilité
      const coursesMap = new Map();
      const tarifsMap = new Map();

      for (const dispo of disponibilites) {
        if (!coursesMap.has(dispo.courseId)) {
          const course = await sheetsService.getCourseById(dispo.courseId);
          if (course) coursesMap.set(dispo.courseId, course);
        }

        // Si un tarifId est assigné, récupérer ce tarif spécifique
        if (dispo.tarifId && !tarifsMap.has(dispo.tarifId)) {
          const tarif = await sheetsService.getTarifById(dispo.tarifId);
          if (tarif) tarifsMap.set(dispo.tarifId, tarif);
        }
      }

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

    // Si c'est un admin, récupérer toutes les disponibilités (ou filtrer par courseId)
    if (user.role === 'admin') {
      let disponibilites = await sheetsService.getAllDisponibilites();

      // Filtrer par courseId si fourni
      if (courseId) {
        disponibilites = disponibilites.filter((d: any) => d.courseId === courseId);
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

    // Vérifier que le photographe ne crée une disponibilité que pour lui-même
    if (user.role === 'photographer' && user.id !== photographeId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const sheetsService = new GoogleSheetsService();

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

    // Si c'est un photographe, vérifier que la course n'est pas archivée
    if (user.role === 'photographer') {
      // Extraire le courseId de l'ID de disponibilité (format: dispo-{courseId}-{photographeId})
      const courseIdFromDispoId = id.split('-')[1];
      if (courseIdFromDispoId) {
        const course = await sheetsService.getCourseById(courseIdFromDispoId);
        if (course && course.archived === 'oui') {
          return NextResponse.json({
            error: 'Vous ne pouvez pas modifier une disponibilité pour une course archivée'
          }, { status: 403 });
        }
      }
    }

    // Mettre à jour la disponibilité
    const updateData: any = {
      statut,
      dateModification: new Date().toISOString(),
    };

    // Seul l'admin peut ajouter une note ou assigner un tarif
    if (user.role === 'admin') {
      if (noteAdmin !== undefined) {
        updateData.noteAdmin = noteAdmin;
      }
      if (tarifId !== undefined) {
        updateData.tarifId = tarifId;
      }
    }

    try {
      // Essayer de mettre à jour
      const updatedDisponibilite = await sheetsService.updateDisponibilite(id, updateData);
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

        // Créer la disponibilité
        const newDisponibilite = {
          id,
          courseId,
          photographeId,
          statut,
          dateDeclaration: new Date().toISOString(),
          dateModification: new Date().toISOString(),
          noteAdmin: noteAdmin || '',
          tarifId: tarifId || '',
        };

        await sheetsService.createDisponibilite(newDisponibilite);
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
