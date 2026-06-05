import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';
import { cache, CacheKeys, withCache } from '@/lib/cache';

// GET /api/courses - Liste toutes les courses
export async function GET(request: NextRequest) {
  try {
    const sheetsService = new GoogleSheetsService();
    const courses = await withCache(
      CacheKeys.allCourses(),
      () => sheetsService.getAllCourses(),
      60000 // 1 minute de cache
    );

    return NextResponse.json({ courses });
  } catch (error: any) {
    console.error('Get courses error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des courses' }, { status: 500 });
  }
}

// POST /api/courses - Créer une nouvelle course
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

    // Validation des champs requis
    if (!data.nom || !data.localisation || !data.ville || !data.dateDebut || !data.dateFin) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    // Utiliser l'ID fourni ou en générer un nouveau
    const courseId = data.id || `course-${Date.now()}`;

    // Créer la course
    const courseData = {
      id: courseId,
      nom: data.nom,
      description: data.description || '',
      localisation: data.localisation,
      ville: data.ville,
      dateDebut: data.dateDebut,
      dateFin: data.dateFin,
      statutTraitement: data.statutTraitement || 'inProgress',
      coureursAttendus: data.coureursAttendus || '',
      briefPdfUrl: data.briefPdfUrl || '',
      dateCreation: data.dateCreation || new Date().toISOString(),
      creePar: data.creePar || user.id,
      visible: data.visible !== undefined ? data.visible : 'TRUE',
      hotel: data.hotel || '',
      transport: data.transport || '',
      supplementaire: data.supplementaire || '',
    };

    await sheetsService.createCourse(courseData);

    // Créer les disponibilités PENDING pour tous les photographes ET admins actifs EN PARALLÈLE
    const [photographers, admins] = await Promise.all([
      sheetsService.getAllPhotographers(),
      sheetsService.getAllAdmins(),
    ]);

    const activePhotographers = photographers.filter((p: any) => p.actif === 'TRUE');
    const activeAdmins = admins.filter((a: any) => a.actif === 'TRUE');
    const allActiveUsers = [...activeAdmins, ...activePhotographers];

    // Utiliser Promise.all pour créer toutes les disponibilités en parallèle (beaucoup plus rapide)
    const dispoPromises = allActiveUsers.map((user: any) => {
      const dispoData = {
        id: `dispo-${courseId}-${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        photographeId: user.id,
        courseId: courseId,
        statut: 'pending',
        dateDeclaration: new Date().toISOString(),
        dateModification: new Date().toISOString(),
        noteAdmin: '',
      };

      return sheetsService.createDisponibilite(dispoData);
    });

    await Promise.all(dispoPromises);

    return NextResponse.json({ course: courseData, success: true });
  } catch (error: any) {
    console.error('Create course error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de la course' }, { status: 500 });
  }
}

// PATCH /api/courses - Mettre à jour une course
export async function PATCH(request: NextRequest) {
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

    // Validation de l'ID
    if (!data.id) {
      return NextResponse.json({ error: 'ID de la course requis' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    // Mettre à jour la course
    await sheetsService.updateCourse(data.id, data);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update course error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de la course' }, { status: 500 });
  }
}
