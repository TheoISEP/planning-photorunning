import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { forbidden, getSessionUser, notFound, serverError, unauthorized } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

// DELETE /api/mobile/admin/appareils/[id] — déconnecte un téléphone à
// distance : à sa prochaine connexion au réseau, l'app efface ses données.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { id } = await params;
    const appareil = await db.mobileDevice.findUnique({ where: { id }, select: { id: true, revokedAt: true } });
    if (!appareil) return notFound('Appareil introuvable');
    if (!appareil.revokedAt) await db.mobileDevice.update({ where: { id }, data: { revokedAt: new Date(), revokedBy: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Erreur lors de la déconnexion de l’appareil', error);
  }
}
