import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// POST /api/courses/[id]/archive - Archiver une course
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const sheetsService = new GoogleSheetsService();

    // Mettre à jour la course pour l'archiver
    await sheetsService.updateCourse(id, {
      archived: 'oui',
      archivedAt: new Date().toISOString(),
      archivedBy: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Archive course error:', error);
    return NextResponse.json({ error: "Erreur lors de l'archivage de la course" }, { status: 500 });
  }
}

// DELETE /api/courses/[id]/archive - Désarchiver une course
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const sheetsService = new GoogleSheetsService();

    // Mettre à jour la course pour la désarchiver
    await sheetsService.updateCourse(id, {
      archived: 'non',
      archivedAt: '',
      archivedBy: '',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unarchive course error:', error);
    return NextResponse.json({ error: 'Erreur lors du désarchivage de la course' }, { status: 500 });
  }
}
