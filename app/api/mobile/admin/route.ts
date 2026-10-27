import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, forbidden, getSessionUser, serverError, unauthorized } from '@/lib/api-auth';
import { configApp } from '@/lib/mobile/appareils';
import { comparerVersions, etatDeVersion, versionValide } from '@/lib/mobile/version';

/**
 * Page « App mobile » de l'admin.
 *  GET : le réglage des versions et tous les appareils connectés.
 *  PUT : { latestVersion, minVersion, message, iosUrl, androidUrl }.
 */

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const [config, appareils] = await Promise.all([
      configApp(),
      db.mobileDevice.findMany({
        orderBy: [{ revokedAt: { sort: 'asc', nulls: 'first' } }, { lastSeenAt: 'desc' }],
        take: 500,
        include: { user: { select: { id: true, prenom: true, nom: true, name: true, email: true, role: true } } },
      }),
    ]);
    return NextResponse.json({
      config,
      appareils: appareils.map((d) => ({
        id: d.id,
        user: {
          id: d.user.id,
          nom: `${d.user.prenom || d.user.name} ${d.user.nom}`.trim(),
          email: d.user.email,
          role: d.user.role,
        },
        platform: d.platform,
        deviceName: d.deviceName,
        model: d.model,
        osVersion: d.osVersion,
        appVersion: d.appVersion,
        buildNumber: d.buildNumber,
        updateId: d.updateId,
        createdAt: d.createdAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
        lastSyncAt: d.lastSyncAt ? d.lastSyncAt.toISOString() : null,
        revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
        etat: etatDeVersion(d.appVersion, config),
      })),
    });
  } catch (error) {
    return serverError('Erreur lors du chargement de l’app mobile', error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.role !== 'admin') return forbidden();
    const body = (await req.json()) as Record<string, unknown>;
    const t = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const latestVersion = t(body.latestVersion, 20);
    const minVersion = t(body.minVersion, 20);
    if (!versionValide(latestVersion) || !versionValide(minVersion)) return badRequest('Versions au format 1.2.3');
    if (comparerVersions(minVersion, latestVersion) > 0) return badRequest('La version minimale ne peut pas dépasser la dernière version');
    const url = (v: string) => (v === '' || /^https:\/\//.test(v) ? v : null);
    const iosUrl = url(t(body.iosUrl, 300));
    const androidUrl = url(t(body.androidUrl, 300));
    if (iosUrl === null || androidUrl === null) return badRequest('Les liens des stores commencent par https://');
    const config = await db.mobileAppConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', latestVersion, minVersion, message: t(body.message, 500), iosUrl, androidUrl, updatedBy: user.id },
      update: { latestVersion, minVersion, message: t(body.message, 500), iosUrl, androidUrl, updatedBy: user.id },
    });
    return NextResponse.json({ config, success: true });
  } catch (error) {
    return serverError('Erreur lors de l’enregistrement', error);
  }
}
