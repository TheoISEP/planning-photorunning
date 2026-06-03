import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/photographers/[id] - Détail d'un photographe
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
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const sheetsService = new GoogleSheetsService();

    // Vérifier que le photographe ne peut voir que son propre profil (sauf admin)
    if (user.role === 'photographer' && user.id !== id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const photographer = await sheetsService.getPhotographerById(id);
    if (!photographer) {
      return NextResponse.json({ error: 'Photographe non trouvé' }, { status: 404 });
    }

    // Ne pas renvoyer le mot de passe
    const { password, ...photographerWithoutPassword } = photographer;

    // Parser les JSON arrays
    if (photographerWithoutPassword.cameras) {
      try {
        photographerWithoutPassword.cameras = JSON.parse(photographerWithoutPassword.cameras);
      } catch {}
    }
    if (photographerWithoutPassword.objectifs) {
      try {
        photographerWithoutPassword.objectifs = JSON.parse(photographerWithoutPassword.objectifs);
      } catch {}
    }
    if (photographerWithoutPassword.cartesMemoire) {
      try {
        photographerWithoutPassword.cartesMemoire = JSON.parse(photographerWithoutPassword.cartesMemoire);
      } catch {}
    }
    if (photographerWithoutPassword.flashs) {
      try {
        photographerWithoutPassword.flashs = JSON.parse(photographerWithoutPassword.flashs);
      } catch {}
    }

    return NextResponse.json({ photographer: photographerWithoutPassword });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur lors de la récupération du photographe' }, { status: 500 });
  }
}

// PATCH /api/photographers/[id] - Modifier un photographe
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
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;

    // Vérifier que le photographe ne peut modifier que son propre profil (sauf admin)
    if (user.role === 'photographer' && user.id !== id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const data = await request.json();

    // Si un mot de passe est fourni, le hasher
    if (data.password) {
      data.password = await authService.hashPassword(data.password);
    }

    // Empêcher la modification de certains champs sensibles par le photographe
    if (user.role === 'photographer') {
      delete data.email;
      // Le photographe peut changer son propre mot de passe
      delete data.actif;
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
    const updatedPhotographer = await sheetsService.updatePhotographer(id, data);

    // Ne pas renvoyer le mot de passe
    const { password, ...photographerWithoutPassword } = updatedPhotographer as any;

    return NextResponse.json({ photographer: photographerWithoutPassword, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur lors de la modification du photographe' }, { status: 500 });
  }
}
