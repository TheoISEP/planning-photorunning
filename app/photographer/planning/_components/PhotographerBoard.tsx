'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUpDown, CalendarPlus, Info, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { amountFor, defaultDecision, weekendKey, type Statut } from '@/lib/planning';
import { StatutSelect } from '@/components/planning/StatutSelect';
import { DECLARATION_OPTIONS, STATUT_META, formatEuros, isWorkingStatut } from '@/components/planning/statuts';
import { dispoKey, fetchJson, type CourseJson, type DispoJson, type TarifJson, type UserJson, type WeekendSummaryJson } from '@/components/planning/types';

// ---------------------------------------------------------------------------
// Export calendrier (.ics)
// ---------------------------------------------------------------------------

function downloadICS(course: CourseJson) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PhotoRunning//Planning//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${course.id}@photorunning.com`, `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(course.dateDebut)}`, `DTEND:${f(course.dateFin)}`, `SUMMARY:${course.nom}`,
    `LOCATION:${course.localisation}, ${course.ville}`, `DESCRIPTION:Course PhotoRunning - ${course.nom}`, 'STATUS:CONFIRMED',
    'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', `DESCRIPTION:Rappel : ${course.nom} demain`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${course.nom.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface SlotView {
  tarif: TarifJson;
  dispo: DispoJson | null;
  statut: Statut;
  editable: boolean;
  amount: number;
}

interface CourseView {
  course: CourseJson;
  slots: SlotView[];
  working: boolean;
  amount: number;
  isPast: boolean;
}

interface MonthGroup {
  key: string;
  year: number;
  month: number;
  courses: CourseJson[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PhotographerBoardProps {
  /** active : courses à venir (+ archivées du mois) ; archives : courses archivées */
  mode: 'active' | 'archives';
  /** base des liens vers la fiche course (admin : /admin/planning) */
  linkBase?: string;
  statsHref?: string;
  archivesHref?: string;
}

export function PhotographerBoard({ mode, linkBase = '/photographer/planning', statsHref = '/photographer/planning/stats', archivesHref = '/photographer/planning' }: PhotographerBoardProps) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<UserJson | null>(null);
  const [managed, setManaged] = useState<UserJson[]>([]);
  const [courses, setCourses] = useState<CourseJson[]>([]);
  const [dispos, setDispos] = useState<DispoJson[]>([]);
  const [weekends, setWeekends] = useState<Record<string, WeekendSummaryJson>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string>('');

  const loadDispos = useCallback(async (ids: string[]) => {
    const results = await Promise.all(ids.map((id) => fetchJson<{ disponibilites: DispoJson[] }>(`/api/disponibilites?photographerId=${id}`)));
    setDispos(results.flatMap((r) => r.disponibilites));
  }, []);

  const load = useCallback(async () => {
    try {
      const { user } = await fetchJson<{ user: { id: string } }>('/api/auth/me');
      const [{ photographer }, c, w] = await Promise.all([
        fetchJson<{ photographer: UserJson }>(`/api/photographers/${user.id}`),
        fetchJson<{ courses: CourseJson[] }>('/api/courses'),
        fetchJson<{ weekends: Record<string, WeekendSummaryJson> }>('/api/weekends'),
      ]);
      setMe(photographer);
      setSelectedId((s) => s || photographer.id);
      setCourses(c.courses);
      setWeekends(w.weekends);

      const managedIds = [photographer.chargeOne, photographer.chargeTwo, photographer.chargeThree, photographer.chargeFour, photographer.chargeFive].filter(Boolean);
      let managedUsers: UserJson[] = [];
      if (photographer.inCharge && managedIds.length > 0) {
        const res = await Promise.all(managedIds.map((id) => fetchJson<{ photographer: UserJson }>(`/api/photographers/${id}`).catch(() => null)));
        managedUsers = res.filter((r): r is { photographer: UserJson } => !!r).map((r) => r.photographer).filter((p) => p.actif);
      }
      setManaged(managedUsers);
      await loadDispos([photographer.id, ...managedUsers.map((m) => m.id)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [loadDispos]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Rafraîchissement périodique (l'admin peut publier pendant qu'on regarde)
  useEffect(() => {
    if (!me) return;
    const ids = [me.id, ...managed.map((m) => m.id)];
    const interval = window.setInterval(() => {
      void loadDispos(ids);
      fetchJson<{ weekends: Record<string, WeekendSummaryJson> }>('/api/weekends').then((w) => setWeekends(w.weekends)).catch(() => undefined);
    }, 45000);
    return () => window.clearInterval(interval);
  }, [me, managed, loadDispos]);

  const people = useMemo(() => (me ? [me, ...managed] : []), [me, managed]);
  const dispoMap = useMemo(() => {
    const m = new Map<string, DispoJson>();
    for (const d of dispos) m.set(dispoKey(d.courseId, d.photographeId, d.tarifId), d);
    return m;
  }, [dispos]);
  const now = useMemo(() => new Date(), []);

  /** Vue d'une course pour une personne donnée. */
  const viewFor = useCallback(
    (course: CourseJson, personId: string): CourseView => {
      const slots: SlotView[] = course.tarifs.map((tarif) => {
        const dispo = dispoMap.get(dispoKey(course.id, personId, tarif.id)) ?? null;
        const decided = !!dispo?.published && !!dispo?.decision;
        // Course finalisée sans décision publiée (ligne absente) : on applique la
        // règle de publication côté affichage (dispo → refusé, sinon non pris).
        const statut: Statut =
          course.statutTraitement === 'done' && !decided ? defaultDecision(dispo?.declaration ?? 'pending') : dispo?.statut ?? 'pending';
        const editable = !course.archived && course.statutTraitement !== 'done' && !decided;
        return { tarif, dispo, statut, editable, amount: amountFor(statut, tarif) };
      });
      const working = slots.some((s) => isWorkingStatut(s.statut));
      return { course, slots, working, amount: slots.reduce((s, x) => s + x.amount, 0), isPast: new Date(course.dateFin) < now };
    },
    [dispoMap, now]
  );

  /** Une course est cachée si tous ses créneaux sont refusés / non pris pour la personne. */
  const isHiddenFor = useCallback(
    (course: CourseJson, personId: string) => {
      const v = viewFor(course, personId);
      return v.slots.length > 0 && v.slots.every((s) => s.statut === 'rejected' || s.statut === 'nonPris');
    },
    [viewFor]
  );

  const months = useMemo<MonthGroup[]>(() => {
    const visible = courses.filter((c) => {
      if (mode === 'archives') return c.archived;
      if (!c.archived) return true;
      const d = new Date(c.dateDebut);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const groups = new Map<string, MonthGroup>();
    for (const c of visible) {
      const d = new Date(c.dateDebut);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, year: d.getFullYear(), month: d.getMonth(), courses: [] };
        groups.set(key, g);
      }
      g.courses.push(c);
    }
    return [...groups.values()]
      .map((g) => ({ ...g, courses: g.courses.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut)) }))
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }, [courses, now, mode]);

  const monthTotal = useCallback(
    (group: MonthGroup, personId: string) => {
      let count = 0;
      let amount = 0;
      for (const c of group.courses) {
        const v = viewFor(c, personId);
        if (v.working) count++;
        amount += v.amount;
      }
      return { count, amount };
    },
    [viewFor]
  );

  const changeStatut = async (course: CourseJson, personId: string, tarif: TarifJson, statut: Statut) => {
    const key = dispoKey(course.id, personId, tarif.id);
    if (busy.has(key)) return;
    setBusy((s) => new Set(s).add(key));
    const previous = dispoMap.get(key);
    setDispos((prev) => {
      const rest = prev.filter((d) => dispoKey(d.courseId, d.photographeId, d.tarifId) !== key);
      const base: DispoJson = previous ?? { id: key, courseId: course.id, photographeId: personId, tarifId: tarif.id, statut: 'pending', declaration: 'pending', decision: null, published: false, noteAdmin: '' };
      return [...rest, { ...base, statut }];
    });
    try {
      const res = await fetchJson<{ disponibilite: DispoJson }>('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, photographeId: personId, tarifId: tarif.id, statut }),
      });
      setDispos((prev) => [...prev.filter((d) => dispoKey(d.courseId, d.photographeId, d.tarifId) !== key), res.disponibilite]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de mettre à jour');
      setDispos((prev) => {
        const rest = prev.filter((d) => dispoKey(d.courseId, d.photographeId, d.tarifId) !== key);
        return previous ? [...rest, previous] : rest;
      });
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  if (loading || !me) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
          <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
        </div>
      </div>
    );
  }

  const activeId = selectedId || me.id;
  const gridTemplate = `minmax(240px, 2fr) 90px ${people.map(() => 'minmax(150px, 1fr)').join(' ')}`;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">{mode === 'archives' ? 'Mes archives' : 'Mon calendrier'}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {mode === 'archives' ? 'Courses passées et archivées.' : 'Indiquez vos disponibilités. Les affectations apparaissent quand la course est finalisée.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {managed.length > 0 && (
            <div className="w-full md:hidden">
              <Select value={activeId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={me.id}>{me.prenom} {me.nom} (moi)</SelectItem>
                  {managed.map((p) => <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" size="sm" asChild className="h-10 w-full sm:h-9 sm:w-auto">
            {mode === 'archives'
              ? <Link href={archivesHref}><ArrowUpDown className="mr-2 h-4 w-4" /> Retour au calendrier</Link>
              : <Link href={statsHref}><ArrowUpDown className="mr-2 h-4 w-4" /> Mes statistiques</Link>}
          </Button>
        </div>
      </div>

      {/* Vue mobile : cartes */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto md:hidden">
        {months.map((group) => {
          const t = monthTotal(group, activeId);
          const visibleCourses = group.courses.filter((c) => !isHiddenFor(c, activeId));
          if (visibleCourses.length === 0) return null;
          return (
            <div key={group.key} className="space-y-2">
              <div className="sticky top-0 z-10 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold capitalize">{format(new Date(group.year, group.month), 'MMMM yyyy', { locale: fr })}</h3>
                  {t.count > 0 && <span className="text-sm font-bold text-orange-800 dark:text-orange-200">{t.count} validée{t.count > 1 ? 's' : ''} · {formatEuros(t.amount)}</span>}
                </div>
              </div>
              {visibleCourses.map((course, idx) => {
                const v = viewFor(course, activeId);
                const prev = idx > 0 ? visibleCourses[idx - 1] : null;
                const wk = weekendKey(course.dateDebut);
                const newWeekend = !prev || weekendKey(prev.dateDebut) !== wk;
                return (
                  <React.Fragment key={course.id}>
                    {newWeekend && v.working && weekends[wk] && <WeekendBanner w={weekends[wk]} />}
                    <CourseCard view={v} personId={activeId} busy={busy} onChange={changeStatut} linkBase={linkBase} fade={mode !== 'archives'} />
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Vue desktop : tableau */}
      <div className="hidden min-h-0 flex-1 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-950 md:flex">
        <div className="h-full w-full overflow-auto">
          <div className="sticky top-0 z-20 grid border-b-2 border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="border-r p-3 text-sm font-semibold">Course</div>
            <div className="border-r p-3 text-center text-sm font-semibold">Date</div>
            {people.map((p) => (
              <div key={p.id} className="border-r p-3 text-center text-sm font-semibold last:border-r-0">
                {p.prenom} {p.nom}{p.id === me.id && managed.length > 0 ? ' (moi)' : ''}
              </div>
            ))}
          </div>

          {months.map((group) => {
            const visibleCourses = group.courses.filter((c) => people.some((p) => !isHiddenFor(c, p.id)));
            if (visibleCourses.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="grid border-b-2 border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/60" style={{ gridTemplateColumns: gridTemplate }}>
                  <div className="border-r border-orange-200 p-3 dark:border-orange-900">
                    <div className="text-base font-bold capitalize">{format(new Date(group.year, group.month), 'MMMM yyyy', { locale: fr })}</div>
                  </div>
                  <div className="border-r border-orange-200 p-3 text-center text-xs text-muted-foreground dark:border-orange-900">
                    {visibleCourses.length} course{visibleCourses.length > 1 ? 's' : ''}
                  </div>
                  {people.map((p) => {
                    const t = monthTotal(group, p.id);
                    return (
                      <div key={p.id} className="flex flex-col items-center justify-center border-r border-orange-200 p-2 text-xs font-semibold last:border-r-0 dark:border-orange-900">
                        <div>{t.count > 0 ? `${t.count} validée${t.count > 1 ? 's' : ''}` : '–'}</div>
                        {t.amount > 0 && <div className="font-bold text-orange-800 dark:text-orange-200">{formatEuros(t.amount)}</div>}
                      </div>
                    );
                  })}
                </div>

                {visibleCourses.map((course, idx) => {
                  const prev = idx > 0 ? visibleCourses[idx - 1] : null;
                  const wk = weekendKey(course.dateDebut);
                  const newWeekend = prev ? weekendKey(prev.dateDebut) !== wk : false;
                  const myView = viewFor(course, me.id);
                  const showBanner = myView.working && !!weekends[wk] && (!prev || weekendKey(prev.dateDebut) !== wk || !viewFor(prev, me.id).working);
                  const multi = course.tarifs.length > 1;
                  const leader = myView.slots.some((s) => s.statut === 'teamLeader');
                  return (
                    <React.Fragment key={course.id}>
                      {showBanner && (
                        <div className="border-b bg-emerald-50/70 px-3 py-1.5 dark:bg-emerald-950/30">
                          <WeekendBanner w={weekends[wk]} inline />
                        </div>
                      )}
                      <div
                        className={cn(
                          'grid border-b transition-colors',
                          newWeekend && !showBanner && 'border-t-4 border-t-orange-200 dark:border-t-orange-900',
                          myView.working ? (leader ? STATUT_META.teamLeader.row : STATUT_META.validated.row) : 'hover:bg-gray-50 dark:hover:bg-gray-900/40',
                          myView.working && (leader ? 'border-l-4 border-l-violet-500' : 'border-l-4 border-l-emerald-500'),
                          myView.isPast && mode !== 'archives' && 'opacity-50'
                        )}
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        <div className="border-r p-3">
                          <div className="flex items-center gap-1.5">
                            {myView.working && <span>{leader ? '👑' : '✓'}</span>}
                            <Link href={`${linkBase}/${course.id}`} className="text-sm font-semibold hover:underline">{course.nom}</Link>
                            <CourseStateDot course={course} />
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">📍 {course.ville || course.localisation}</div>
                          <SlotsSummary view={myView} multi={multi} />
                        </div>
                        <div className="flex flex-col items-center justify-center border-r p-2">
                          <div className="text-sm font-semibold capitalize">{format(new Date(course.dateDebut), 'EEE dd/MM', { locale: fr })}</div>
                          {format(new Date(course.dateFin), 'dd/MM') !== format(new Date(course.dateDebut), 'dd/MM') && (
                            <div className="text-xs capitalize text-muted-foreground">→ {format(new Date(course.dateFin), 'EEE dd/MM', { locale: fr })}</div>
                          )}
                        </div>
                        {people.map((p) => {
                          const v = viewFor(course, p.id);
                          const hidden = isHiddenFor(course, p.id);
                          return (
                            <div key={p.id} className="flex flex-col justify-center gap-1.5 border-r p-2 last:border-r-0">
                              {hidden ? (
                                <span className="text-center text-xs text-muted-foreground">–</span>
                              ) : (
                                v.slots.map((slot) => (
                                  <SlotControl key={slot.tarif.id} slot={slot} multi={multi} loading={busy.has(dispoKey(course.id, p.id, slot.tarif.id))} onChange={(s) => changeStatut(course, p.id, slot.tarif, s)} />
                                ))
                              )}
                              {v.working && p.id === me.id && (
                                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => downloadICS(course)}>
                                  <CalendarPlus className="mr-1 h-3 w-3" /> Ajouter au calendrier
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="hidden items-center gap-1 text-[11px] text-muted-foreground md:flex">
        <Info className="h-3 w-3" /> Une réponse ne peut plus être modifiée une fois la course finalisée par l’admin : contactez-le si besoin.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composants
// ---------------------------------------------------------------------------

function WeekendBanner({ w, inline }: { w: WeekendSummaryJson; inline?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 text-xs font-medium text-emerald-900 dark:text-emerald-100', !inline && 'rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/40')}>
      <Users className="h-4 w-4 shrink-0 text-emerald-600" />
      <span>
        Week-end du {w.label} : <b>{w.photographers}</b> photographe{w.photographers > 1 ? 's' : ''} travaill{w.photographers > 1 ? 'ent' : 'e'} sur <b>{w.events}</b> événement{w.events > 1 ? 's' : ''}
      </span>
    </div>
  );
}

function CourseStateDot({ course }: { course: CourseJson }) {
  const done = course.statutTraitement === 'done';
  return (
    <span className="text-[10px]" title={done ? 'Course finalisée' : 'Course en cours de constitution'}>
      {done ? '🟢' : '🟠'}
    </span>
  );
}

/** Résumé lisible des créneaux : « Validé sur Samedi et Dimanche · 600 € ». */
function SlotsSummary({ view, multi }: { view: CourseView; multi: boolean }) {
  const working = view.slots.filter((s) => isWorkingStatut(s.statut));
  if (working.length > 0) {
    const days = working.map((s) => s.tarif.nom).filter(Boolean);
    const leader = working.some((s) => s.statut === 'teamLeader');
    const all = multi && working.length === view.slots.length;
    return (
      <div className="mt-1 text-xs">
        <span className={cn('inline-block rounded px-1.5 py-0.5 font-semibold', leader ? 'bg-violet-200 text-violet-900' : 'bg-emerald-200 text-emerald-900')}>
          {leader ? 'Référent' : 'Validé'}
          {multi && days.length > 0 ? ` sur ${days.join(' et ')}` : ''}
          {all && days.length > 2 ? ' (tous les jours)' : ''}
        </span>
        <span className="ml-2 font-bold text-emerald-700 dark:text-emerald-300">{formatEuros(view.amount)}</span>
      </div>
    );
  }
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      {view.slots.map((s) => (
        <span key={s.tarif.id} className="mr-3">
          {multi && <span className="font-medium text-sky-800 dark:text-sky-300">{s.tarif.nom} · </span>}
          {s.tarif.tarifPhotographe} €
        </span>
      ))}
    </div>
  );
}

function SlotControl({ slot, multi, loading, onChange }: { slot: SlotView; multi: boolean; loading: boolean; onChange: (s: Statut) => void }) {
  const meta = STATUT_META[slot.statut];
  if (slot.editable) {
    return <StatutSelect value={slot.statut} options={DECLARATION_OPTIONS} onChange={onChange} label={multi ? slot.tarif.nom : undefined} loading={loading} size="md" />;
  }
  return (
    <div className="w-full">
      {multi && <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">{slot.tarif.nom}</div>}
      <div className={cn('flex h-9 items-center justify-between rounded-md border px-3 text-sm font-medium', meta.chip)} title="Tranché par l’admin">
        <span className="flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />{meta.label}</span>
        {isWorkingStatut(slot.statut) ? <span className="text-xs">{formatEuros(slot.amount)}</span> : <Lock className="h-3 w-3 opacity-50" />}
      </div>
    </div>
  );
}

function CourseCard({ view, personId, busy, onChange, linkBase, fade }: { view: CourseView; personId: string; busy: Set<string>; onChange: (course: CourseJson, personId: string, tarif: TarifJson, statut: Statut) => void; linkBase: string; fade: boolean }) {
  const { course } = view;
  const multi = course.tarifs.length > 1;
  const leader = view.slots.some((s) => s.statut === 'teamLeader');
  return (
    <div className={cn('rounded-lg border-2 p-3 transition-all', view.working ? (leader ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/30' : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30') : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950', view.isPast && fade && 'opacity-50')}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`${linkBase}/${course.id}`} className="flex-1 text-sm font-semibold hover:underline">{course.nom}</Link>
        <CourseStateDot course={course} />
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <div>📍 {course.ville || course.localisation}</div>
        <div className="capitalize">📅 {format(new Date(course.dateDebut), 'EEEE d MMMM', { locale: fr })}{format(new Date(course.dateFin), 'dd/MM') !== format(new Date(course.dateDebut), 'dd/MM') ? ` → ${format(new Date(course.dateFin), 'EEEE d MMMM', { locale: fr })}` : ''}</div>
      </div>
      <SlotsSummary view={view} multi={multi} />
      <div className="mt-2 space-y-2">
        {view.slots.map((slot) => (
          <SlotControl key={slot.tarif.id} slot={slot} multi={multi} loading={busy.has(dispoKey(course.id, personId, slot.tarif.id))} onChange={(s) => onChange(course, personId, slot.tarif, s)} />
        ))}
      </div>
      {view.working && (
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => downloadICS(course)}>
          <CalendarPlus className="mr-2 h-4 w-4" /> Ajouter au calendrier
        </Button>
      )}
    </div>
  );
}
