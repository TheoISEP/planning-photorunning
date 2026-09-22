import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

// POST /api/courses/[id]/archive — archiver
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { id } = await params;
    await db.course.update({ where: { id }, data: { archived: true, archivedAt: new Date(), archivedBy: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("Erreur lors de l'archivage de la course", error);
  }
}

// DELETE /api/courses/[id]/archive — désarchiver
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { id } = await params;
    await db.course.update({ where: { id }, data: { archived: false, archivedAt: null, archivedBy: null } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Erreur lors du désarchivage de la course', error);
  }
}
