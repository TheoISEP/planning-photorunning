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

    // Vérifier les permissions
    // Admin peut voir tout le monde
    // Photographe ne peut voir que lui-même ou ses photographes à charge
    if (user.role === 'photographer' && user.id !== id) {
      // Vérifier si le photographe connecté est référent de celui-ci
      const currentPhotographer = await sheetsService.getPhotographerById(user.id);
      const isReferent = currentPhotographer && (
        currentPhotographer.chargeOne === id ||
        currentPhotographer.chargeTwo === id ||
        currentPhotographer.chargeThree === id ||
        currentPhotographer.chargeFour === id ||
        currentPhotographer.chargeFive === id
      );

      if (!isReferent) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
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

    const data = await request.json();
    const sheetsService = new GoogleSheetsService();

    // Vérifier les permissions et définir les restrictions
    let isReferentEdit = false;
    if (user.role === 'photographer' && user.id !== id) {
      // Vérifier si le photographe connecté est référent de celui-ci
      const currentPhotographer = await sheetsService.getPhotographerById(user.id);
      const isReferent = currentPhotographer && (
        currentPhotographer.chargeOne === id ||
        currentPhotographer.chargeTwo === id ||
        currentPhotographer.chargeThree === id ||
        currentPhotographer.chargeFour === id ||
        currentPhotographer.chargeFive === id
      );

      if (!isReferent) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }

      isReferentEdit = true;
    }

    // Si un mot de passe est fourni, le hasher
    if (data.password) {
      data.password = await authService.hashPassword(data.password);
    }

    // Empêcher la modification de certains champs sensibles
    if (user.role === 'photographer') {
      if (isReferentEdit) {
        // Un référent ne peut pas modifier ces champs
        delete data.password;
        delete data.email;
        delete data.actif;
        delete data.inCharge;
        delete data.chargeOne;
        delete data.chargeTwo;
        delete data.chargeThree;
        delete data.chargeFour;
        delete data.chargeFive;
      } else {
        // Un photographe modifiant son propre profil
        delete data.email;
        delete data.actif;
        // Le photographe peut changer son propre mot de passe
      }
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

    const updatedPhotographer = await sheetsService.updatePhotographer(id, data);

    // Ne pas renvoyer le mot de passe
    const { password, ...photographerWithoutPassword } = updatedPhotographer as any;

    return NextResponse.json({ photographer: photographerWithoutPassword, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erreur lors de la modification du photographe' }, { status: 500 });
  }
}
