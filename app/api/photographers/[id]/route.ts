import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { canActFor, forbidden, getSessionUser, notFound, serverError, unauthorized } from '@/lib/api-auth';
import { updateUser } from '@/lib/data/users';
import { serializeUser } from '@/lib/serialize';

type Params = { params: Promise<{ id: string }> };

// GET /api/photographers/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await params;
    if (!(await canActFor(user, id))) return forbidden();
    const photographer = await db.user.findUnique({ where: { id } });
    if (!photographer) return notFound('Photographe non trouvé');
    return NextResponse.json({ photographer: serializeUser(photographer) });
  } catch (error) {
    return serverError('Erreur lors de la récupération du photographe', error);
  }
}

// PATCH /api/photographers/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const { id } = await params;
    if (!(await canActFor(user, id))) return forbidden();
    const data = (await request.json()) as Record<string, unknown>;

    const isSelf = user.id === id;
    const isAdmin = user.role === 'admin';
    if (!isAdmin) {
      // Un photographe ne touche ni à l'email, ni à l'activation, ni aux rattachements
      delete data.email;
      delete data.actif;
      delete data.inCharge;
      delete data.nonRemunere;
      delete data.rem;
      for (const k of ['chargeOne', 'chargeTwo', 'chargeThree', 'chargeFour', 'chargeFive']) delete data[k];
      if (!isSelf) delete data.password; // un référent ne change pas le mot de passe d'un autre
    }

    const updated = await updateUser(id, data, { allowPassword: isAdmin || isSelf, allowEmail: isAdmin });
    return NextResponse.json({ photographer: serializeUser(updated), success: true });
  } catch (error) {
    return serverError('Erreur lors de la modification du photographe', error);
  }
}
