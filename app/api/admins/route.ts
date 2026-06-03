import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/admins - Liste tous les admins
export async function GET(request: NextRequest) {
  try {
    const sheetsService = new GoogleSheetsService();
    const admins = await sheetsService.getAllAdmins();

    // Ne pas renvoyer les mots de passe et mapper 'rem' vers 'nonRemunere'
    const adminsWithoutPasswords = admins.map((a: any) => {
      const { password, ...rest } = a;

      // Mapper 'rem' vers 'nonRemunere' pour le frontend
      if (rest.rem !== undefined) {
        rest.nonRemunere = rest.rem;
      }

      return rest;
    });

    return NextResponse.json({ admins: adminsWithoutPasswords });
  } catch (error: any) {
    console.error('Get admins error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des admins' }, { status: 500 });
  }
}

// POST /api/admins - Créer un nouvel admin (admin seulement)
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
    if (!data.email || !data.password || !data.nom || !data.prenom) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    const sheetsService = new GoogleSheetsService();

    // Vérifier que l'email n'existe pas déjà
    const existingAdmin = await sheetsService.findAdminByEmail(data.email);
    if (existingAdmin) {
      return NextResponse.json({ error: 'Un admin avec cet email existe déjà' }, { status: 409 });
    }

    // Générer un ID unique
    const adminId = `admin-${Date.now()}`;

    // Hasher le mot de passe
    const hashedPassword = await authService.hashPassword(data.password);

    // Créer l'admin
    const adminData = {
      id: adminId,
      email: data.email,
      password: hashedPassword,
      nom: data.nom,
      prenom: data.prenom,
      telephone: data.telephone || '',
      adresse: data.adresse || '',
      ville: data.ville || '',
      codePostal: data.codePostal || '',
      dateNaissance: data.dateNaissance || '',
      role: 'admin',
      dateCreation: new Date().toISOString(),
      dateInscription: new Date().toISOString(),
      actif: 'TRUE',
      rem: data.nonRemunere || 'FALSE',
      cameras: data.cameras ? JSON.stringify(data.cameras) : '[]',
      objectifs: data.objectifs ? JSON.stringify(data.objectifs) : '[]',
      cartesMemoire: data.cartesMemoire ? JSON.stringify(data.cartesMemoire) : '[]',
      flashs: data.flashs ? JSON.stringify(data.flashs) : '[]',
      flyingBlue: data.flyingBlue || '',
      flyingBlueExpiry: data.flyingBlueExpiry || '',
      sncf: data.sncf || '',
      sncfExpiry: data.sncfExpiry || '',
    };

    await sheetsService.createAdmin(adminData);

    // Renvoyer sans le mot de passe
    const { password, ...adminWithoutPassword } = adminData;

    return NextResponse.json({
      admin: adminWithoutPassword,
      credentials: {
        email: data.email,
        password: data.password // Password en clair pour le communiquer à l'admin
      },
      success: true
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de l\'admin' }, { status: 500 });
  }
}
