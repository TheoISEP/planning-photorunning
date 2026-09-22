import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/lib/google-drive';
import { db } from '@/lib/db';
import { forbidden, getSessionUser, unauthorized } from '@/lib/api-auth';

// POST /api/briefs/upload - Upload un brief PDF vers Google Drive
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification et le rôle
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const courseId = formData.get('courseId') as string;

    if (!file || !courseId) {
      return NextResponse.json({ error: 'Fichier et courseId requis' }, { status: 400 });
    }

    // Vérifier que c'est un PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Le fichier doit être un PDF' }, { status: 400 });
    }

    // Vérifier la taille (max 10 MB)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Le fichier ne doit pas dépasser 10 MB' }, { status: 400 });
    }

    // 1. Upload vers Google Drive
    const driveService = new GoogleDriveService();
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `brief-${courseId}-${Date.now()}.pdf`;

    const { fileId, webViewLink } = await driveService.uploadBrief(fileName, buffer, file.type);

    // 2. Mettre à jour la course
    await db.course.update({ where: { id: courseId }, data: { briefPdfUrl: webViewLink } });

    return NextResponse.json({ success: true, url: webViewLink, fileId });
  } catch (error) {
    console.error('Upload brief error:', error);
    return NextResponse.json({
      error: "Erreur lors de l'upload du brief",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
