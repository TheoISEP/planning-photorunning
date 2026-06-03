import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/admins/[id] - Détail d'un admin
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

    const admin = await sheetsService.getAdminById(id);
    if (!admin) {
      return NextResponse.json({ error: 'Admin non trouvé' }, { status: 404 });
    }

    // Ne pas renvoyer le mot de passe
    const { password, ...adminWithoutPassword } = admin;

    // Parser les JSON arrays
    if (adminWithoutPassword.cameras) {
      try {
        adminWithoutPassword.cameras = JSON.parse(adminWithoutPassword.cameras);
      } catch {}
    }
    if (adminWithoutPassword.objectifs) {
      try {
        adminWithoutPassword.objectifs = JSON.parse(adminWithoutPassword.objectifs);
      } catch {}
    }
    if (adminWithoutPassword.cartesMemoire) {
      try {
        adminWithoutPassword.cartesMemoire = JSON.parse(adminWithoutPassword.cartesMemoire);
      } catch {}
    }
    if (adminWithoutPassword.flashs) {
      try {
        adminWithoutPassword.flashs = JSON.parse(adminWithoutPassword.flashs);
      } catch {}
    }

    return NextResponse.json({ admin: adminWithoutPassword });
  } catch (error: any) {
    console.error('Get admin error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération de l\'admin' }, { status: 500 });
  }
}

// PATCH /api/admins/[id] - Modifier un admin
export async function PATCH(
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
    const data = await request.json();

    // Si un mot de passe est fourni, le hasher
    if (data.password) {
      data.password = await authService.hashPassword(data.password);
    }

    // Convertir les arrays en JSON strings si nécessaire
    if (data.cameras && Array.isArray(data.cameras)) {
      data.cameras = JSON.stringify(data.cameras);
    }
    if (data.objectifs && Array.isArray(data.objectifs)) {
      data.objectifs = JSON.stringify(data.objectifs);
    }
    if (data.cartesMemoire && Array.isArray(data.cartesMemoire)) {
      data.cartesMemoire = JSON.stringify(data.cartesMemoire);
    }
    if (data.flashs && Array.isArray(data.flashs)) {
      data.flashs = JSON.stringify(data.flashs);
    }

    const sheetsService = new GoogleSheetsService();
    const updatedAdmin = await sheetsService.updateAdmin(id, data);

    // Ne pas renvoyer le mot de passe
    const { password, ...adminWithoutPassword } = updatedAdmin;

    return NextResponse.json({ admin: adminWithoutPassword, success: true });
  } catch (error: any) {
    console.error('Update admin error:', error);
    return NextResponse.json({ error: 'Erreur lors de la modification de l\'admin' }, { status: 500 });
  }
}
