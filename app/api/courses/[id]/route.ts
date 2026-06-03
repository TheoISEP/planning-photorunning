import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/lib/google-sheets';
import { AuthService } from '@/lib/auth-google-sheets';
import { cookies } from 'next/headers';

// GET /api/courses/[id] - Récupérer une course
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sheetsService = new GoogleSheetsService();
    const course = await sheetsService.getCourseById(id);

    if (!course) {
      return NextResponse.json({ error: 'Course introuvable' }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (error: any) {
    console.error('Get course error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération de la course' }, { status: 500 });
  }
}

// PATCH /api/courses/[id] - Mettre à jour une course
export async function PATCH(
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
    const data = await request.json();

    const sheetsService = new GoogleSheetsService();
    const updatedCourse = await sheetsService.updateCourse(id, data);

    return NextResponse.json({ course: updatedCourse, success: true });
  } catch (error: any) {
    console.error('Update course error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de la course' }, { status: 500 });
  }
}
