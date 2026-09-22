'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Calendar, FileText, Hotel, Lock, MapPin, Train, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { amountFor, defaultDecision, weekendKey, type Statut } from '@/lib/planning';
import { StatutSelect } from '@/components/planning/StatutSelect';
import { DECLARATION_OPTIONS, STATUT_META, formatEuros, isWorkingStatut } from '@/components/planning/statuts';
import { fetchJson, type CourseJson, type DispoJson, type UserJson, type WeekendSummaryJson } from '@/components/planning/types';

export default function PhotographerCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState<{ id: string } | null>(null);
  const [course, setCourse] = React.useState<CourseJson | null>(null);
  const [mine, setMine] = React.useState<DispoJson[]>([]);
  const [team, setTeam] = React.useState<DispoJson[]>([]);
  const [people, setPeople] = React.useState<Map<string, UserJson>>(new Map());
  const [weekend, setWeekend] = React.useState<WeekendSummaryJson | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const { user } = await fetchJson<{ user: { id: string } }>('/api/auth/me');
      setMe(user);
      const [c, m, t, p, a, w] = await Promise.all([
        fetchJson<{ course: CourseJson }>(`/api/courses/${courseId}`),
        fetchJson<{ disponibilites: DispoJson[] }>(`/api/disponibilites?photographerId=${user.id}&courseId=${courseId}`),
        fetchJson<{ disponibilites: DispoJson[] }>(`/api/disponibilites?courseId=${courseId}`),
        fetchJson<{ photographers: UserJson[] }>('/api/photographers'),
        fetchJson<{ admins: UserJson[] }>('/api/admins'),
        fetchJson<{ weekends: Record<string, WeekendSummaryJson> }>('/api/weekends'),
      ]);
      setCourse(c.course);
      setMine(m.disponibilites);
      setTeam(t.disponibilites);
      setPeople(new Map([...a.admins, ...p.photographers].map((u) => [u.id, u])));
      setWeekend(w.weekends[weekendKey(c.course.dateDebut)] ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Course introuvable');
      router.push('/photographer/planning');
    } finally {
      setLoading(false);
    }
  }, [courseId, router]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changeStatut = async (tarifId: string, statut: Statut) => {
    if (!me || !course) return;
    setBusy(tarifId);
    try {
      const res = await fetchJson<{ disponibilite: DispoJson }>('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, photographeId: me.id, tarifId, statut }),
      });
      setMine((prev) => [...prev.filter((d) => d.tarifId !== tarifId), res.disponibilite]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de mettre à jour');
    } finally {
      setBusy(null);
    }
  };

  if (loading || !course || !me) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const multi = course.tarifs.length > 1;
  const done = course.statutTraitement === 'done';
  const slots = course.tarifs.map((tarif) => {
    const d = mine.find((x) => x.tarifId === tarif.id) ?? null;
    const decided = !!d?.published && !!d?.decision;
    const statut: Statut = done && !decided ? defaultDecision(d?.declaration ?? 'pending') : d?.statut ?? 'pending';
    const editable = !course.archived && !done && !decided;
    return { tarif, d, statut, editable, amount: amountFor(statut, tarif) };
  });
  const working = slots.filter((s) => isWorkingStatut(s.statut));
  const total = slots.reduce((s, x) => s + x.amount, 0);
  const teamByTarif = course.tarifs.map((tarif) => ({
    tarif,
    members: team.filter((d) => d.tarifId === tarif.id).sort((a, b) => (a.decision === 'teamLeader' ? -1 : 1) - (b.decision === 'teamLeader' ? -1 : 1)),
  }));
  const initials = (id: string) => {
    const u = people.get(id);
    return u ? `${u.prenom[0] ?? ''}${u.nom[0] ?? ''}`.toUpperCase() : '?';
  };
  const name = (id: string) => {
    const u = people.get(id);
    return u ? `${u.prenom} ${u.nom}` : id;
  };

  return (
    <div className="h-full space-y-6 overflow-y-auto pb-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" asChild className="mt-0.5">
          <Link href="/photographer/planning"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{course.nom}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <MapPin className="mr-1 inline h-3.5 w-3.5" />{course.localisation || course.ville}
            <span className="mx-2">·</span>
            <Calendar className="mr-1 inline h-3.5 w-3.5" />
            <span className="capitalize">{format(new Date(course.dateDebut), 'EEEE d MMMM yyyy, HH:mm', { locale: fr })}</span>
            {format(new Date(course.dateFin), 'dd/MM') !== format(new Date(course.dateDebut), 'dd/MM') && <span className="capitalize"> → {format(new Date(course.dateFin), 'EEEE d MMMM, HH:mm', { locale: fr })}</span>}
          </p>
        </div>
      </div>

      {working.length > 0 && weekend && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <Users className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>Week-end du {weekend.label} : <b>{weekend.photographers}</b> photographe{weekend.photographers > 1 ? 's' : ''} travaill{weekend.photographers > 1 ? 'ent' : 'e'} sur <b>{weekend.events}</b> événement{weekend.events > 1 ? 's' : ''}.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ma disponibilité</CardTitle>
              <CardDescription>
                {done
                  ? 'La course est finalisée : votre statut est définitif.'
                  : 'Indiquez si vous êtes disponible. L’admin tranche ensuite ; vous serez informé quand la course sera finalisée.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {slots.map((s) => {
                const meta = STATUT_META[s.statut];
                return (
                  <div key={s.tarif.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{multi ? s.tarif.nom : 'Prestation'}</div>
                      <div className="text-xs text-muted-foreground">{s.tarif.tarifPhotographe} € · référent +{s.tarif.bonusChefEquipe} €</div>
                    </div>
                    <div className="w-full sm:w-56">
                      {s.editable ? (
                        <StatutSelect value={s.statut} options={DECLARATION_OPTIONS} onChange={(v) => changeStatut(s.tarif.id, v)} loading={busy === s.tarif.id} size="md" />
                      ) : (
                        <div className={cn('flex h-9 items-center justify-between rounded-md border px-3 text-sm font-medium', meta.chip)}>
                          <span className="flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />{meta.label}</span>
                          {isWorkingStatut(s.statut) ? <span className="text-xs">{formatEuros(s.amount)}</span> : <Lock className="h-3 w-3 opacity-50" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {working.length > 0 && (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                  {working.some((s) => s.statut === 'teamLeader') ? '👑 Vous êtes référent' : '✓ Vous êtes validé'}
                  {multi ? ` sur ${working.map((s) => s.tarif.nom).join(' et ')}` : ''} · <b>{formatEuros(total)}</b>
                </div>
              )}
            </CardContent>
          </Card>

          {done && (
            <Card>
              <CardHeader>
                <CardTitle>Équipe</CardTitle>
                <CardDescription>{team.length} photographe{team.length > 1 ? 's' : ''} sur cette course</CardDescription>
              </CardHeader>
              <CardContent className={cn('grid gap-4', multi && 'md:grid-cols-2')}>
                {teamByTarif.map(({ tarif, members }) => (
                  <div key={tarif.id}>
                    {multi && <div className="mb-2 text-sm font-semibold text-sky-800 dark:text-sky-300">{tarif.nom}</div>}
                    {members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Personne pour l’instant.</p>
                    ) : (
                      <ul className="space-y-2">
                        {members.map((d) => (
                          <li key={d.id} className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={cn('text-xs', d.decision === 'teamLeader' ? 'bg-violet-100 text-violet-800' : 'bg-gray-100 text-gray-700')}>{initials(d.photographeId)}</AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <div className={cn('font-medium', d.photographeId === me.id && 'underline')}>{name(d.photographeId)}{d.photographeId === me.id ? ' (moi)' : ''}</div>
                              <div className="text-xs text-muted-foreground">{d.decision === 'teamLeader' ? '★ Référent' : 'Validé'}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {course.description && <p className="whitespace-pre-wrap text-muted-foreground">{course.description}</p>}
              {course.coureursAttendus > 0 && <div><Users className="mr-1 inline h-4 w-4" /> {course.coureursAttendus.toLocaleString('fr-FR')} coureurs attendus</div>}
              {working.length > 0 && course.briefPdfUrl && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <a href={course.briefPdfUrl} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" /> Brief de la course (PDF)</a>
                </Button>
              )}
            </CardContent>
          </Card>

          {working.length > 0 && (course.hotel || course.transport || course.supplementaire) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Logistique</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {course.hotel && <div><div className="mb-0.5 flex items-center gap-1 font-medium"><Hotel className="h-4 w-4" /> Hôtel</div><p className="whitespace-pre-wrap text-muted-foreground">{course.hotel}</p></div>}
                {course.transport && <div><div className="mb-0.5 flex items-center gap-1 font-medium"><Train className="h-4 w-4" /> Transport</div><p className="whitespace-pre-wrap text-muted-foreground">{course.transport}</p></div>}
                {course.supplementaire && <div><div className="mb-0.5 font-medium">Informations</div><p className="whitespace-pre-wrap text-muted-foreground">{course.supplementaire}</p></div>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
