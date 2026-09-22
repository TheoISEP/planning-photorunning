import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { forbidden, getSessionUser, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { updateUser } from '@/lib/data/users';
import { serializeUser } from '@/lib/serialize';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { id } = await params;
    const admin = await db.user.findUnique({ where: { id } });
    if (!admin) return notFound('Admin non trouvé');
    return NextResponse.json({ admin: serializeUser(admin) });
  } catch (error) {
    return serverError("Erreur lors de la récupération de l'admin", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const { id } = await params;
    const data = (await request.json()) as Record<string, unknown>;
    const updated = await updateUser(id, data, { allowPassword: true, allowEmail: true });
    return NextResponse.json({ admin: serializeUser(updated), success: true });
  } catch (error) {
    return serverError("Erreur lors de la modification de l'admin", error);
  }
}
