'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Edit, Euro, EyeOff, FileText, Hotel, MapPin, Ban, Star, Train, Trash2, Undo2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { amountFor, type Statut } from '@/lib/planning';
import { StatutSelect } from '@/components/planning/StatutSelect';
import { ALL_OPTIONS, STATUT_META, formatEuros, isWorkingStatut } from '@/components/planning/statuts';
import { dispoKey, fetchJson, type CourseJson, type DispoJson, type TarifJson, type UserJson } from '@/components/planning/types';

export default function AdminCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [course, setCourse] = React.useState<CourseJson | null>(null);
  const [users, setUsers] = React.useState<UserJson[]>([]);
  const [dispos, setDispos] = React.useState<DispoJson[]>([]);
  const [statusTarget, setStatusTarget] = React.useState<'done' | 'inProgress' | null>(null);
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const confirmCancel = async () => {
    if (!course) return;
    const annulee = !course.annulee;
    setCancelOpen(false);
    try {
      const r = await fetchJson<{ course: CourseJson }>(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annulee }),
      });
      setCourse(r.course);
      toast.success(annulee ? 'Course marquée comme annulée' : 'Course rétablie');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    }
  };
  const [deleting, setDeleting] = React.useState(false);

  const confirmDelete = async () => {
    if (!course) return;
    setDeleting(true);
    try {
      await fetchJson(`/api/courses/${course.id}`, { method: 'DELETE' });
      toast.success('Course supprimée');
      router.push('/admin/planning');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  const load = React.useCallback(async () => {
    try {
      const [c, p, a, d] = await Promise.all([
        fetchJson<{ course: CourseJson }>(`/api/courses/${courseId}`),
        fetchJson<{ photographers: UserJson[] }>('/api/photographers'),
        fetchJson<{ admins: UserJson[] }>('/api/admins'),
        fetchJson<{ disponibilites: DispoJson[] }>(`/api/disponibilites?courseId=${courseId}`),
      ]);
      setCourse(c.course);
      setUsers([...a.admins, ...p.photographers]);
      setDispos(d.disponibilites);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Course introuvable');
      router.push('/admin/planning');
    } finally {
      setLoading(false);
    }
  }, [courseId, router]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const dispoMap = React.useMemo(() => {
    const m = new Map<string, DispoJson>();
    for (const d of dispos) m.set(dispoKey(d.courseId, d.photographeId, d.tarifId), d);
    return m;
  }, [dispos]);

  const activeUsers = React.useMemo(() => users.filter((u) => u.actif), [users]);

  const team = React.useMemo(() => {
    if (!course) return [];
    return course.tarifs.map((tarif) => {
      const members = dispos
        .filter((d) => d.tarifId === tarif.id && isWorkingStatut(d.decision))
        .map((d) => {
          const u = userById.get(d.photographeId);
          const nonRemunere = !!u && u.role === 'admin' && u.nonRemunere;
          return { dispo: d, user: u, amount: nonRemunere ? 0 : amountFor(d.decision, tarif), nonRemunere };
        })
        .sort((a, b) => (a.dispo.decision === 'teamLeader' ? -1 : 1) - (b.dispo.decision === 'teamLeader' ? -1 : 1) || `${a.user?.prenom}`.localeCompare(`${b.user?.prenom}`));
      return { tarif, members, cost: members.reduce((s, m) => s + m.amount, 0), hidden: members.filter((m) => !m.dispo.published).length };
    });
  }, [course, dispos, userById]);

  const totalCost = team.reduce((s, t) => s + t.cost, 0);

  const changeStatut = async (user: UserJson, tarif: TarifJson, statut: Statut) => {
    if (!course) return;
    const key = dispoKey(course.id, user.id, tarif.id);
    setBusy((s) => new Set(s).add(key));
    try {
      const res = await fetchJson<{ disponibilite: DispoJson }>('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, photographeId: user.id, tarifId: tarif.id, statut }),
      });
      setDispos((prev) => [...prev.filter((d) => dispoKey(d.courseId, d.photographeId, d.tarifId) !== key), res.disponibilite]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  const summary = React.useMemo(() => {
    if (!course) return { validated: 0, toRejected: 0, toNonPris: 0 };
    let validated = 0, toRejected = 0, toNonPris = 0;
    for (const tarif of course.tarifs) {
      for (const u of activeUsers) {
        const d = dispoMap.get(dispoKey(course.id, u.id, tarif.id));
        if (d && isWorkingStatut(d.decision)) validated++;
        else if (d?.decision) continue;
        else if (d?.declaration === 'available') toRejected++;
        else toNonPris++;
      }
    }
    return { validated, toRejected, toNonPris };
  }, [course, activeUsers, dispoMap]);

  const confirmStatus = async () => {
    if (!course || !statusTarget) return;
    const target = statusTarget;
    setStatusTarget(null);
    try {
      await fetchJson(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statutTraitement: target }),
      });
      await load();
      toast.success(target === 'done' ? 'Course passée en « Fait » : les photographes voient leur statut.' : 'Course repassée « En cours ».');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    }
  };

  if (loading || !course) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const done = course.statutTraitement === 'done';
  const multi = course.tarifs.length > 1;
  const initials = (u?: UserJson) => (u ? `${u.prenom[0] ?? ''}${u.nom[0] ?? ''}`.toUpperCase() : '?');

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" asChild className="mt-0.5">
            <Link href="/admin/planning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{course.nom}</h1>
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', done ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-orange-300 bg-orange-100 text-orange-800')}>
                <span className={cn('h-1.5 w-1.5 rounded-full', done ? 'bg-emerald-500' : 'bg-orange-500')} />
                {done ? 'Fait' : 'En cours'}
              </span>
              {course.annulee && <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"><Ban className="h-3 w-3" /> Annulée</span>}
              {course.archived && <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Archivée</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />{course.localisation || course.ville}
              <span className="mx-2">·</span>
              <Calendar className="mr-1 inline h-3.5 w-3.5" />
              {format(new Date(course.dateDebut), 'EEEE d MMMM yyyy, HH:mm', { locale: fr })}
              {course.dateFin !== course.dateDebut && ` → ${format(new Date(course.dateFin), 'EEEE d MMMM, HH:mm', { locale: fr })}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/planning/${course.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Modifier</Link>
          </Button>
          <Button size="sm" onClick={() => setStatusTarget(done ? 'inProgress' : 'done')} className={done ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'}>
            {done ? <><Clock className="mr-2 h-4 w-4" /> Repasser en cours</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Passer en Fait</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} className={course.annulee ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300' : 'border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950'}>
            {course.annulee ? <><Undo2 className="mr-2 h-4 w-4" /> Rétablir</> : <><Ban className="mr-2 h-4 w-4" /> Course annulée</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950">
            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {course.annulee && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Course annulée{course.annuleeAt ? ` le ${format(new Date(course.annuleeAt), 'd MMMM yyyy', { locale: fr })}` : ''} : elle apparaît en rouge chez les photographes et ne compte plus dans les coûts, les week-ends et les statistiques.</span>
        </div>
      )}

      {!done && !course.annulee && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Course en cours : les photographes ne voient que leur propre réponse. Vos validations et refus seront visibles au passage en « Fait ».</span>
        </div>
      )}

      {/* Cartes d'info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-sky-600" />
            <div>
              <div className="text-xs text-muted-foreground">Coureurs attendus</div>
              <div className="text-lg font-bold">{course.coureursAttendus ? course.coureursAttendus.toLocaleString('fr-FR') : '–'}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Star className="h-8 w-8 text-violet-600" />
            <div>
              <div className="text-xs text-muted-foreground">Photographes validés</div>
              <div className="text-lg font-bold">
                {team.reduce((s, t) => s + t.members.length, 0)}
                {course.numberAttended ? <span className="text-sm font-normal text-muted-foreground"> / {course.numberAttended} attendus</span> : null}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Euro className="h-8 w-8 text-emerald-600" />
            <div>
              <div className="text-xs text-muted-foreground">Coût photographes</div>
              <div className="text-lg font-bold">{formatEuros(totalCost)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="h-8 w-8 text-gray-500" />
            <div>
              <div className="text-xs text-muted-foreground">Brief</div>
              {course.briefPdfUrl ? (
                <a href={course.briefPdfUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700 hover:underline">Ouvrir le PDF</a>
              ) : (
                <div className="text-sm text-muted-foreground">Aucun</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Équipe par créneau */}
      <div className={cn('grid gap-4', multi ? 'md:grid-cols-2' : '')}>
        {team.map(({ tarif, members, cost, hidden }) => (
          <Card key={tarif.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{multi ? tarif.nom : 'Équipe'} <span className="ml-1 text-sm font-normal text-muted-foreground">· {tarif.tarifPhotographe} € (+{tarif.bonusChefEquipe} € référent)</span></span>
                <span className="text-sm font-semibold">{formatEuros(cost)}</span>
              </CardTitle>
              <CardDescription>
                {members.length} validé{members.length > 1 ? 's' : ''}
                {hidden > 0 && <span className="ml-2 inline-flex items-center gap-1 text-amber-700"><EyeOff className="h-3 w-3" /> {hidden} non encore visible{hidden > 1 ? 's' : ''}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Personne n’est encore validé sur ce créneau.</p>
              ) : (
                <ul className="divide-y">
                  {members.map(({ dispo, user, amount, nonRemunere }) => (
                    <li key={dispo.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn('text-xs', dispo.decision === 'teamLeader' ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800')}>{initials(user)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Link href={user?.role === 'admin' ? `/admin/admins/${dispo.photographeId}/profile` : `/admin/photographers/${dispo.photographeId}/profile`} className="text-sm font-medium hover:underline">
                            {user ? `${user.prenom} ${user.nom}` : dispo.photographeId}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {dispo.decision === 'teamLeader' ? '★ Référent' : 'Validé'}
                            {user?.region ? ` · ${user.region}` : ''}
                            {nonRemunere ? ' · admin non rémunéré' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold">{nonRemunere ? '–' : formatEuros(amount)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logistique */}
      {(course.hotel || course.transport || course.supplementaire || course.description) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Logistique</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <div className="mb-1 flex items-center gap-1 font-medium"><Hotel className="h-4 w-4" /> Hôtel <span className={cn('ml-1 rounded px-1 text-[10px]', course.hotelValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{course.hotelValid ? 'validé' : 'à valider'}</span></div>
              <p className="whitespace-pre-wrap text-muted-foreground">{course.hotel || '–'}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1 font-medium"><Train className="h-4 w-4" /> Transport <span className={cn('ml-1 rounded px-1 text-[10px]', course.transportValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{course.transportValid ? 'validé' : 'à valider'}</span></div>
              <p className="whitespace-pre-wrap text-muted-foreground">{course.transport || '–'}</p>
            </div>
            <div>
              <div className="mb-1 font-medium">Informations</div>
              <p className="whitespace-pre-wrap text-muted-foreground">{course.supplementaire || course.description || '–'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau complet */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Toutes les réponses</CardTitle>
          <CardDescription>Déclaration du photographe et décision de l’admin, par créneau. <EyeOff className="inline h-3 w-3" /> = décision pas encore visible du photographe.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-muted-foreground dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left">Photographe</th>
                <th className="px-4 py-2 text-left">Région</th>
                {course.tarifs.map((t) => (
                  <th key={t.id} className="px-4 py-2 text-left">{multi ? t.nom : 'Statut'}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-2">
                    <span className={cn('font-medium', u.role === 'admin' && 'font-bold')}>{u.prenom} {u.nom}</span>
                    {u.role === 'admin' && <span className="ml-2 rounded bg-gray-100 px-1 text-[10px] text-gray-600">admin</span>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.region || '–'}</td>
                  {course.tarifs.map((t) => {
                    const d = dispoMap.get(dispoKey(course.id, u.id, t.id));
                    return (
                      <td key={t.id} className="px-4 py-2">
                        <div className="flex max-w-[190px] items-center gap-2">
                          <StatutSelect
                            value={d?.statut ?? 'pending'}
                            options={ALL_OPTIONS}
                            onChange={(v) => changeStatut(u, t, v)}
                            hidden={!!d?.decision && !d.published}
                            loading={busy.has(dispoKey(course.id, u.id, t.id))}
                            size="sm"
                          />
                          {d?.decision && d.declaration !== 'pending' && (
                            <span className="shrink-0 text-[10px] text-muted-foreground" title="Réponse du photographe">
                              ({STATUT_META[d.declaration].short.toLowerCase()})
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Dialog statut */}
      <Dialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{statusTarget === 'done' ? 'Passer la course en « Fait »' : 'Repasser la course « En cours »'}</DialogTitle>
            <DialogDescription>{course.nom}</DialogDescription>
          </DialogHeader>
          {statusTarget === 'done' ? (
            <ul className="space-y-1 rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-900">
              <li>✅ <b>{summary.validated}</b> validé{summary.validated > 1 ? 's' : ''} / référent{summary.validated > 1 ? 's' : ''} voient leur affectation</li>
              <li>❌ <b>{summary.toRejected}</b> disponible{summary.toRejected > 1 ? 's' : ''} non retenu{summary.toRejected > 1 ? 's' : ''} → <b>Refusé</b></li>
              <li>⊘ <b>{summary.toNonPris}</b> en attente / pas dispo → <b>Non pris</b></li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ce qui a déjà été publié reste visible. Les lignes jamais publiées attendront le prochain passage en « Fait ».</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>Annuler</Button>
            <Button onClick={confirmStatus} className={statusTarget === 'done' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-500 hover:bg-orange-600'}>
              {statusTarget === 'done' ? 'Passer en Fait et publier' : 'Repasser en cours'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog annulation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{course.annulee ? 'Rétablir la course' : 'Marquer la course comme annulée'}</DialogTitle>
            <DialogDescription>{course.nom}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {course.annulee
              ? 'La course redevient normale : les affectations et les montants comptent de nouveau.'
              : 'La course apparaîtra en rouge « Course annulée » chez les photographes. Les réponses sont conservées mais ne comptent plus (coûts, week-ends, statistiques).'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Annuler</Button>
            <Button onClick={confirmCancel} className={course.annulee ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 text-white hover:bg-red-700'}>
              {course.annulee ? 'Rétablir' : 'Marquer annulée'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Supprimer la course</DialogTitle>
            <DialogDescription>{course.nom}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            La course, ses créneaux et toutes les réponses des photographes seront supprimés définitivement. Si vous voulez seulement la retirer du calendrier, préférez l’archivage.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Annuler</Button>
            <Button onClick={confirmDelete} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
