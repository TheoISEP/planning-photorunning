import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/photographers - Liste tous les photographes
export async function GET(request: NextRequest) {
  try {
    const sheetsService = new GoogleSheetsService();
    const photographers = await sheetsService.getAllPhotographers();

    // Ne pas renvoyer les mots de passe
    const photographersWithoutPasswords = photographers.map((p: any) => {
      const { password, ...rest } = p;
      return rest;
    });

    return NextResponse.json({ photographers: photographersWithoutPasswords });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des photographes' }, { status: 500 });
  }
}

// POST /api/photographers - Créer un nouveau photographe (admin seulement)
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
    if (!data.email || !data.password || !data.nom || !data.prenom || !data.telephone) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    // Vérifier que l'email n'existe pas déjà
    const existingPhotographer = await sheetsService.findPhotographerByEmail(data.email);
    if (existingPhotographer) {
      return NextResponse.json({ error: 'Un photographe avec cet email existe déjà' }, { status: 409 });
    }

    // Générer un ID unique
    const photographerId = `photographe-${Date.now()}`;

    // Hasher le mot de passe
    const hashedPassword = await authService.hashPassword(data.password);

    // Créer le photographe
    const photographerData = {
      id: photographerId,
      email: data.email,
      password: hashedPassword,
      nom: data.nom,
      prenom: data.prenom,
      telephone: data.telephone,
      adresse: data.adresse || '',
      ville: data.ville || '',
      codePostal: data.codePostal || '',
      dateNaissance: data.dateNaissance || '',
      dateInscription: new Date().toISOString(),
      actif: 'TRUE',
      cameras: data.cameras ? JSON.stringify(data.cameras) : '[]',
      objectifs: data.objectifs ? JSON.stringify(data.objectifs) : '[]',
      cartesMemoire: data.cartesMemoire ? JSON.stringify(data.cartesMemoire) : '[]',
      flashs: data.flashs ? JSON.stringify(data.flashs) : '[]',
      flyingBlue: data.flyingBlue || '',
      flyingBlueExpiry: data.flyingBlueExpiry || '',
      sncf: data.sncf || '',
      sncfExpiry: data.sncfExpiry || '',
    };

    await sheetsService.createPhotographer(photographerData);

    // Créer les disponibilités PENDING pour toutes les courses futures
    const courses = await sheetsService.getAllCourses();
    const futureCourses = courses.filter((c: any) => new Date(c.dateDebut) > new Date());

    for (const course of futureCourses) {
      const dispoData = {
        id: `dispo-${course.id}-${photographerId}-${Date.now()}`,
        photographeId: photographerId,
        courseId: course.id,
        statut: 'pending',
        dateDeclaration: new Date().toISOString(),
        dateModification: new Date().toISOString(),
        noteAdmin: '',
      };

      await sheetsService.createDisponibilite(dispoData);
    }

    // Renvoyer sans le mot de passe
    const { password, ...photographerWithoutPassword } = photographerData;

    return NextResponse.json({
      photographer: photographerWithoutPassword,
      credentials: {
        email: data.email,
        password: data.password // Password en clair pour le communiquer à l'admin
      },
      success: true
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur lors de la création du photographe' }, { status: 500 });
  }
}
