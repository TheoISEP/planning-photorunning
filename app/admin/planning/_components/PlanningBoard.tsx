'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Archive, ArchiveRestore, ArrowUpDown, CheckCircle2, Clock, Filter, LayoutGrid, List, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { amountFor, weekendKey, type Statut } from '@/lib/planning';
import { StatutSelect } from '@/components/planning/StatutSelect';
import { ALL_OPTIONS, formatEuros, isWorkingStatut } from '@/components/planning/statuts';
import { dispoKey, fetchJson, type CourseJson, type DispoJson, type TarifJson, type UserJson } from '@/components/planning/types';

// ---------------------------------------------------------------------------
// Régions
// ---------------------------------------------------------------------------

const REGION_ORDER = ['Ile-de-France', 'Sud-Est', 'Sud-Ouest', 'Nord', 'Zone Lyon', 'Zone Centre'];
const REGION_BG: Record<string, string> = {
  'Ile-de-France': 'bg-gray-50 dark:bg-gray-900/40',
  'Zone Lyon': 'bg-blue-50 dark:bg-blue-950/30',
  'Zone Centre': 'bg-amber-50 dark:bg-amber-950/30',
  'Sud-Est': 'bg-emerald-50 dark:bg-emerald-950/30',
  'Sud-Ouest': 'bg-purple-50 dark:bg-purple-950/30',
  'Nord': 'bg-rose-50 dark:bg-rose-950/30',
};
const regionBg = (region?: string) => REGION_BG[region ?? ''] ?? 'bg-white dark:bg-gray-950';
const regionRank = (region: string) => {
  const i = REGION_ORDER.indexOf(region);
  return i === -1 ? REGION_ORDER.length : i;
};

function sortByRegion(users: UserJson[]) {
  return [...users].sort((a, b) => {
    const r = regionRank(a.region) - regionRank(b.region);
    if (r !== 0) return r;
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr');
  });
}

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface TarifStats {
  tarif: TarifJson;
  validated: number;
  available: number;
  cost: number;
}

interface CourseView extends CourseJson {
  tarifStats: TarifStats[];
  validated: number;
  available: number;
  cost: number;
  isPast: boolean;
}

interface MonthGroup {
  key: string;
  year: number;
  month: number;
  courses: CourseView[];
}

interface StatusDialogState {
  course: CourseView;
  target: 'done' | 'inProgress';
  summary: { validated: number; toRejected: number; toNonPris: number; total: number };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PlanningBoardProps {
  /** active : courses à venir (+ archivées du mois) ; archives : courses archivées */
  mode: 'active' | 'archives';
}

export function PlanningBoard({ mode }: PlanningBoardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseJson[]>([]);
  const [admins, setAdmins] = useState<UserJson[]>([]);
  const [photographers, setPhotographers] = useState<UserJson[]>([]);
  const [dispos, setDispos] = useState<DispoJson[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const [statutFilter, setStatutFilter] = useState<'all' | 'inProgress' | 'done'>('all');
  const [zoom, setZoom] = useState(90);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(66);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  const [statusDialog, setStatusDialog] = useState<StatusDialogState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CourseView | null>(null);

  // ---- Chargement ---------------------------------------------------------

  const load = useCallback(async () => {
    try {
      const [c, p, a, d] = await Promise.all([
        fetchJson<{ courses: CourseJson[] }>('/api/courses'),
        fetchJson<{ photographers: UserJson[] }>('/api/photographers'),
        fetchJson<{ admins: UserJson[] }>('/api/admins'),
        fetchJson<{ disponibilites: DispoJson[] }>('/api/disponibilites'),
      ]);
      setCourses(c.courses);
      setPhotographers(sortByRegion(p.photographers));
      setAdmins(a.admins);
      setDispos(d.disponibilites);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Chargement initial (hors du rendu, après le premier paint)
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const refreshCourse = useCallback(async (courseId: string) => {
    const [c, d] = await Promise.all([
      fetchJson<{ course: CourseJson }>(`/api/courses/${courseId}`),
      fetchJson<{ disponibilites: DispoJson[] }>(`/api/disponibilites?courseId=${courseId}`),
    ]);
    setCourses((prev) => prev.map((x) => (x.id === courseId ? c.course : x)));
    setDispos((prev) => [...prev.filter((x) => x.courseId !== courseId), ...d.disponibilites]);
  }, []);

  // ---- Données dérivées ---------------------------------------------------

  const activeAdmins = useMemo(() => admins.filter((u) => u.actif), [admins]);
  const activePhotographers = useMemo(() => photographers.filter((u) => u.actif), [photographers]);
  const columns = useMemo(() => [...activeAdmins, ...activePhotographers], [activeAdmins, activePhotographers]);

  const regionGroups = useMemo(() => {
    const groups: Array<{ region: string; count: number }> = [];
    for (const p of activePhotographers) {
      const region = p.region || 'Sans région';
      const last = groups[groups.length - 1];
      if (last && last.region === region) last.count++;
      else groups.push({ region, count: 1 });
    }
    return groups;
  }, [activePhotographers]);

  const dispoMap = useMemo(() => {
    const m = new Map<string, DispoJson>();
    for (const d of dispos) m.set(dispoKey(d.courseId, d.photographeId, d.tarifId), d);
    return m;
  }, [dispos]);

  const now = useMemo(() => new Date(), []);

  const courseViews = useMemo<CourseView[]>(() => {
    return courses.map((course) => {
      const tarifStats: TarifStats[] = course.tarifs.map((tarif) => {
        let validated = 0;
        let available = 0;
        let cost = 0;
        for (const u of columns) {
          const d = dispoMap.get(dispoKey(course.id, u.id, tarif.id));
          if (!d) continue;
          if (isWorkingStatut(d.decision)) {
            validated++;
            // Un admin non rémunéré ne coûte rien à la course
            if (!(u.role === 'admin' && u.nonRemunere)) cost += amountFor(d.decision, tarif);
          } else if (d.statut === 'available') {
            available++;
          }
        }
        return { tarif, validated, available, cost };
      });
      return {
        ...course,
        tarifStats,
        validated: tarifStats.reduce((s, t) => s + t.validated, 0),
        available: tarifStats.reduce((s, t) => s + t.available, 0),
        cost: tarifStats.reduce((s, t) => s + t.cost, 0),
        isPast: new Date(course.dateFin) < now,
      };
    });
  }, [courses, columns, dispoMap, now]);

  const months = useMemo<MonthGroup[]>(() => {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const visible = courseViews.filter((c) => {
      if (mode === 'archives') {
        if (!c.archived) return false;
      } else if (c.archived) {
        const d = new Date(c.dateDebut);
        if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return false;
      }
      return statutFilter === 'all' || c.statutTraitement === statutFilter;
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
  }, [courseViews, statutFilter, now, mode]);

  /** Total du mois pour un utilisateur : nombre de courses + montant. */
  const monthUserTotal = useCallback(
    (group: MonthGroup, user: UserJson) => {
      let count = 0;
      let amount = 0;
      for (const course of group.courses) {
        let worked = false;
        for (const tarif of course.tarifs) {
          const d = dispoMap.get(dispoKey(course.id, user.id, tarif.id));
          if (d && isWorkingStatut(d.decision)) {
            worked = true;
            amount += amountFor(d.decision, tarif, { nonRemunere: user.nonRemunere });
          }
        }
        if (worked) count++;
      }
      return { count, amount };
    },
    [dispoMap]
  );

  // ---- Actions ------------------------------------------------------------

  const changeStatut = async (course: CourseView, user: UserJson, tarif: TarifJson, statut: Statut) => {
    const key = dispoKey(course.id, user.id, tarif.id);
    if (busy.has(key)) return;
    setBusy((s) => new Set(s).add(key));
    const previous = dispoMap.get(key);
    // Optimiste
    setDispos((prev) => {
      const rest = prev.filter((d) => dispoKey(d.courseId, d.photographeId, d.tarifId) !== key);
      const base: DispoJson = previous ?? {
        id: key, courseId: course.id, photographeId: user.id, tarifId: tarif.id,
        statut: 'pending', declaration: 'pending', decision: null, published: false, noteAdmin: '',
      };
      return [...rest, { ...base, statut }];
    });
    try {
      const res = await fetchJson<{ disponibilite: DispoJson }>('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, photographeId: user.id, tarifId: tarif.id, statut }),
      });
      setDispos((prev) => [...prev.filter((d) => dispoKey(d.courseId, d.photographeId, d.tarifId) !== key), res.disponibilite]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
      setDispos((prev) => {
        const rest = prev.filter((d) => dispoKey(d.courseId, d.photographeId, d.tarifId) !== key);
        return previous ? [...rest, previous] : rest;
      });
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  };

  const openStatusDialog = (course: CourseView) => {
    const target = course.statutTraitement === 'done' ? 'inProgress' : 'done';
    let validated = 0;
    let toRejected = 0;
    let toNonPris = 0;
    let total = 0;
    for (const tarif of course.tarifs) {
      for (const u of columns) {
        total++;
        const d = dispoMap.get(dispoKey(course.id, u.id, tarif.id));
        if (d && isWorkingStatut(d.decision)) validated++;
        else if (d && d.decision) continue; // déjà refusé / non pris
        else if (d?.declaration === 'available') toRejected++;
        else toNonPris++;
      }
    }
    setStatusDialog({ course, target, summary: { validated, toRejected, toNonPris, total } });
  };

  const confirmStatusChange = async () => {
    if (!statusDialog) return;
    const { course, target } = statusDialog;
    setStatusDialog(null);
    try {
      const res = await fetchJson<{ course: CourseJson; published?: number }>(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statutTraitement: target }),
      });
      await refreshCourse(course.id);
      if (target === 'done') {
        toast.success(`${course.nom} passée en « Fait » : les photographes voient maintenant leur statut${res.published ? ` (${res.published} ligne${res.published > 1 ? 's' : ''} publiée${res.published > 1 ? 's' : ''})` : ''}.`);
      } else {
        toast.success(`${course.nom} repassée en « En cours ».`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors du changement de statut');
    }
  };

  const toggleValidation = async (course: CourseView, field: 'hotelValid' | 'transportValid') => {
    const next = !course[field];
    setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, [field]: next } : c)));
    try {
      await fetchJson(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
    } catch (error) {
      setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, [field]: !next } : c)));
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const course = archiveTarget;
    setArchiveTarget(null);
    try {
      if (course.archived) {
        await fetchJson(`/api/courses/${course.id}/archive`, { method: 'DELETE' });
        setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, archived: false, archivedAt: '' } : c)));
        toast.success(`${course.nom} remise dans le calendrier`, {
          action: { label: 'Voir le calendrier', onClick: () => router.push('/admin/planning') },
        });
      } else {
        await fetchJson(`/api/courses/${course.id}/archive`, { method: 'POST' });
        setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, archived: true, archivedAt: new Date().toISOString() } : c)));
        toast.success(`${course.nom} archivée`, {
          action: { label: 'Voir les archives', onClick: () => router.push('/admin/archives') },
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'archivage");
    }
  };

  // ---- Rendu --------------------------------------------------------------

  const gridTemplate = `220px 96px repeat(${columns.length}, 96px)`;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
          <p className="mt-4 text-sm text-muted-foreground">Chargement du planning…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-3 -my-4 flex h-[calc(100%+2rem)] min-h-0 flex-col gap-2 overflow-hidden px-3 py-3 md:-mx-6 md:-my-8 md:h-[calc(100%+4rem)] md:px-6 md:py-5">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight sm:text-lg">{mode === 'archives' ? 'Archives des courses' : 'Calendrier des courses'}</h1>
          <p className="text-xs text-muted-foreground">
            {mode === 'archives'
              ? 'Courses archivées (passées). Vous pouvez encore corriger une affectation ou remettre une course dans le calendrier.'
              : <>Ce que vous validez ici n’est visible des photographes qu’une fois la course passée en <span className="font-medium">Fait</span>.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'archives' ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/planning">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Retour au calendrier
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/planning/stats">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Statistiques
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/admin/planning/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle course
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select value={statutFilter} onValueChange={(v) => setStatutFilter(v as typeof statutFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les courses</SelectItem>
              <SelectItem value="inProgress">🟠 En cours</SelectItem>
              <SelectItem value="done">🟢 Fait</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-2 flex items-center gap-1 md:hidden">
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')} title="Vue grille">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} title="Vue liste">
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className={cn('flex items-center gap-2', viewMode === 'list' && 'hidden md:flex')}>
            <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(z - 10, 50))} disabled={zoom <= 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <button className="min-w-[3rem] text-center text-xs font-medium tabular-nums" onClick={() => setZoom(90)} title="Réinitialiser">
              {zoom}%
            </button>
            <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(z + 10, 150))} disabled={zoom >= 150}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Vue liste (mobile) */}
      {viewMode === 'list' && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto md:hidden">
          {months.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="sticky top-0 z-10 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold capitalize">{format(new Date(group.year, group.month), 'MMMM yyyy', { locale: fr })}</h3>
                  <span className="text-xs text-muted-foreground">{group.courses.length} course{group.courses.length > 1 ? 's' : ''}</span>
                </div>
              </div>
              {group.courses.map((course) => (
                <div key={course.id} className={cn('rounded-lg border bg-white p-3 shadow-sm dark:bg-gray-950', course.isPast && mode !== 'archives' && 'opacity-50')}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/planning/${course.id}`} className="flex-1 text-sm font-semibold hover:underline">
                      {course.nom}
                    </Link>
                    <CourseStatusPill course={course} onClick={() => openStatusDialog(course)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>📍 {course.ville || course.localisation}</span>
                    <span>📅 {format(new Date(course.dateDebut), 'dd/MM', { locale: fr })}</span>
                    <span>📷 {course.validated} validé{course.validated > 1 ? 's' : ''} · {course.available} dispo</span>
                    <span>💶 {formatEuros(course.cost)}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Link href={`/admin/planning/${course.id}`} className="flex-1 rounded bg-gray-100 px-2 py-1.5 text-center text-xs hover:bg-gray-200 dark:bg-gray-800">
                      Détails
                    </Link>
                    <Link href={`/admin/planning/${course.id}/edit`} className="flex-1 rounded bg-blue-50 px-2 py-1.5 text-center text-xs text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20">
                      Modifier
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Grille */}
      <div
        className={cn('min-h-0 flex-1 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-950', viewMode === 'list' && 'hidden md:block')}
      >
        <div className="h-full overflow-auto" style={{ zoom: `${zoom}%` }}>
          {/* En-tête sticky */}
          <div ref={headerRef} className="sticky top-0 z-40 bg-white shadow-sm dark:bg-gray-950">
            <div className="grid border-b border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900" style={{ gridTemplateColumns: gridTemplate, minWidth: 'max-content' }}>
              <div className="sticky left-0 z-50 bg-gray-100 dark:bg-gray-900" />
              <div className="sticky z-50 bg-gray-100 dark:bg-gray-900" style={{ left: 220 }} />
              {activeAdmins.length > 0 && (
                <div className="p-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ gridColumn: `span ${activeAdmins.length}` }}>
                  Admins
                </div>
              )}
              {regionGroups.map((g) => (
                <div key={g.region} className={cn('border-l border-gray-300/60 p-1 text-center text-[10px] font-bold uppercase tracking-wider', regionBg(g.region))} style={{ gridColumn: `span ${g.count}` }}>
                  {g.region}
                </div>
              ))}
            </div>
            <div className="grid border-b-2 border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900" style={{ gridTemplateColumns: gridTemplate, minWidth: 'max-content' }}>
              <div className="sticky left-0 z-50 border-r border-gray-300 bg-gray-50 p-2 text-sm font-semibold dark:bg-gray-900" style={{ boxShadow: '2px 0 5px rgba(0,0,0,0.06)' }}>
                Course
              </div>
              <div className="sticky z-50 border-r border-gray-300 bg-gray-50 p-2 text-sm font-semibold dark:bg-gray-900" style={{ left: 220, boxShadow: '2px 0 5px rgba(0,0,0,0.06)' }}>
                Date
              </div>
              {columns.map((u) => (
                <div key={u.id} className={cn('p-1.5 text-center', u.role === 'photographer' && regionBg(u.region))}>
                  <Link
                    href={u.role === 'admin' ? `/admin/admins/${u.id}/profile` : `/admin/photographers/${u.id}/profile`}
                    className={cn('flex flex-col items-center text-xs hover:underline', u.role === 'admin' && 'font-bold')}
                    title={`${u.prenom} ${u.nom}${u.region ? ` · ${u.region}` : ''}${u.nonRemunere ? ' · non rémunéré' : ''}`}
                  >
                    <span className="w-full truncate">{u.prenom}</span>
                    <span className="w-full truncate text-[9px] text-muted-foreground">{u.nom}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {months.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">{mode === 'archives' ? 'Aucune course archivée.' : 'Aucune course pour ce filtre.'}</div>
          )}

          {months.map((group) => (
            <div key={group.key}>
              {/* Ligne du mois */}
              <div className="sticky z-30 grid border-b-2 border-orange-200 bg-orange-50 font-semibold shadow-sm dark:border-orange-900 dark:bg-orange-950/60" style={{ gridTemplateColumns: gridTemplate, minWidth: 'max-content', top: headerHeight }}>
                <div className="sticky left-0 z-10 border-r border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/60" style={{ boxShadow: '2px 0 5px rgba(0,0,0,0.06)' }}>
                  <div className="text-sm font-bold capitalize">{format(new Date(group.year, group.month), 'MMMM yyyy', { locale: fr })}</div>
                  <div className="mt-0.5 text-xs text-orange-800 dark:text-orange-200">
                    {formatEuros(group.courses.reduce((s, c) => s + c.cost, 0))}
                  </div>
                </div>
                <div className="sticky z-10 border-r border-orange-200 bg-orange-50 p-3 text-xs dark:border-orange-900 dark:bg-orange-950/60" style={{ left: 220 }}>
                  {group.courses.length} course{group.courses.length > 1 ? 's' : ''}
                </div>
                {columns.map((u) => {
                  const t = monthUserTotal(group, u);
                  return (
                    <div key={u.id} className="flex flex-col items-center justify-center p-2 text-xs font-semibold">
                      <div>{t.count > 0 ? t.count : '–'}</div>
                      {t.count > 0 && (
                        <div className="text-[10px] text-gray-600 dark:text-gray-400" title={u.nonRemunere ? 'Valeur photographe (admin non rémunéré)' : undefined}>
                          {u.nonRemunere ? `(${formatEuros(t.amount)})` : formatEuros(t.amount)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Courses du mois */}
              {group.courses.map((course, idx) => {
                const prev = idx > 0 ? group.courses[idx - 1] : null;
                const newWeekend = prev ? weekendKey(course.dateDebut) !== weekendKey(prev.dateDebut) : false;
                const multi = course.tarifs.length > 1;
                const stripe = idx % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/70 dark:bg-gray-900/40';
                return (
                  <div
                    key={course.id}
                    className={cn(
                      'group grid border-b border-gray-200/70 transition-colors dark:border-gray-800',
                      stripe,
                      newWeekend && 'border-t-4 border-t-sky-300 dark:border-t-sky-700',
                      course.isPast && mode !== 'archives' && 'opacity-50'
                    )}
                    style={{ gridTemplateColumns: gridTemplate, minWidth: 'max-content' }}
                  >
                    {/* Colonne course */}
                    <div className={cn('sticky left-0 z-30 border-r border-gray-300 p-2 pr-1.5', stripe)} style={{ boxShadow: '2px 0 5px rgba(0,0,0,0.06)' }}>
                      <div className="mb-1 flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <Link href={`/admin/planning/${course.id}`} className="line-clamp-2 text-xs font-semibold leading-tight hover:underline" title={course.nom}>
                            {course.nom}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="truncate">📍 {course.ville || course.localisation}</span>
                            {course.coureursAttendus > 0 && <span className="shrink-0">👥 {course.coureursAttendus.toLocaleString('fr-FR')}</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 shrink-0 p-0 text-muted-foreground/50 hover:text-orange-600"
                          onClick={() => setArchiveTarget(course)}
                          title={course.archived ? 'Remettre dans le calendrier' : 'Archiver la course'}
                        >
                          {course.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div className="mb-1 flex items-center gap-1">
                        <CourseStatusPill course={course} onClick={() => openStatusDialog(course)} />
                        <button
                          onClick={() => toggleValidation(course, 'hotelValid')}
                          className={cn('rounded border px-1 py-0.5 text-[9px] font-bold', course.hotelValid ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-rose-300 bg-rose-100 text-rose-700')}
                          title={course.hotelValid ? 'Hôtel validé' : 'Hôtel non validé'}
                        >
                          H
                        </button>
                        <button
                          onClick={() => toggleValidation(course, 'transportValid')}
                          className={cn('rounded border px-1 py-0.5 text-[9px] font-bold', course.transportValid ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-rose-300 bg-rose-100 text-rose-700')}
                          title={course.transportValid ? 'Transport validé' : 'Transport non validé'}
                        >
                          T
                        </button>
                      </div>
                      <div className={cn('space-y-0.5', multi && 'border-t border-gray-200 pt-1 dark:border-gray-800')}>
                        {course.tarifStats.map((ts) => (
                          <div key={ts.tarif.id} className="flex items-center gap-1.5 text-[10px]">
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-800 px-1 text-[10px] font-bold text-white dark:bg-gray-200 dark:text-gray-900" title="Validés + référents">
                              {ts.validated}
                            </span>
                            <span className="text-muted-foreground" title="Disponibles non encore tranchés – objectif">
                              {ts.available}
                              {course.numberAttended > 0 && !multi ? `/${course.numberAttended}` : ''}
                            </span>
                            {multi && <span className="truncate font-semibold text-sky-800 dark:text-sky-300">{ts.tarif.nom}</span>}
                            <span className="ml-auto shrink-0 text-muted-foreground">{ts.tarif.tarifPhotographe}€</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Colonne date */}
                    <div className={cn('sticky z-30 flex flex-col justify-start gap-0.5 border-r border-gray-300 p-2', stripe)} style={{ left: 220, boxShadow: '2px 0 5px rgba(0,0,0,0.06)' }}>
                      <CourseDates course={course} />
                    </div>

                    {/* Cellules */}
                    {columns.map((u) => (
                      <div key={u.id} className={cn('flex flex-col justify-end gap-1 p-1.5', u.role === 'photographer' && regionBg(u.region))}>
                        {course.tarifs.map((tarif) => {
                          const d = dispoMap.get(dispoKey(course.id, u.id, tarif.id));
                          const statut: Statut = d?.statut ?? 'pending';
                          return (
                            <StatutSelect
                              key={tarif.id}
                              value={statut}
                              options={ALL_OPTIONS}
                              onChange={(v) => changeStatut(course, u, tarif, v)}
                              label={multi ? tarif.nom : undefined}
                              hidden={!!d?.decision && !d.published}
                              loading={busy.has(dispoKey(course.id, u.id, tarif.id))}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Dialog passage En cours / Fait */}
      <Dialog open={!!statusDialog} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <DialogContent className="sm:max-w-[520px]">
          {statusDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {statusDialog.target === 'done' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock className="h-5 w-5 text-orange-500" />}
                  {statusDialog.target === 'done' ? 'Passer la course en « Fait »' : 'Repasser la course « En cours »'}
                </DialogTitle>
                <DialogDescription className="pt-2">
                  <span className="font-semibold text-foreground">{statusDialog.course.nom}</span>
                  {' · '}
                  {format(new Date(statusDialog.course.dateDebut), 'd MMMM yyyy', { locale: fr })}
                </DialogDescription>
              </DialogHeader>
              {statusDialog.target === 'done' ? (
                <div className="space-y-2 py-2 text-sm">
                  <p>Les décisions deviennent visibles des photographes :</p>
                  <ul className="space-y-1 rounded-lg border bg-gray-50 p-3 dark:bg-gray-900">
                    <li>✅ <b>{statusDialog.summary.validated}</b> validé{statusDialog.summary.validated > 1 ? 's' : ''} / référent{statusDialog.summary.validated > 1 ? 's' : ''} voient leur affectation</li>
                    <li>❌ <b>{statusDialog.summary.toRejected}</b> disponible{statusDialog.summary.toRejected > 1 ? 's' : ''} non retenu{statusDialog.summary.toRejected > 1 ? 's' : ''} passent en <b>Refusé</b> (la course disparaît de leur planning)</li>
                    <li>⊘ <b>{statusDialog.summary.toNonPris}</b> en attente / pas dispo passent en <b>Non pris</b></li>
                  </ul>
                  <p className="text-xs text-muted-foreground">Vous pourrez toujours modifier une affectation ensuite : le changement sera alors visible immédiatement.</p>
                </div>
              ) : (
                <div className="py-2 text-sm text-muted-foreground">
                  Ce qui a déjà été publié reste visible des photographes. Seuls les nouveaux créneaux ou les lignes jamais publiées attendront le prochain passage en « Fait ».
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusDialog(null)}>Annuler</Button>
                <Button onClick={confirmStatusChange} className={statusDialog.target === 'done' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-500 hover:bg-orange-600'}>
                  {statusDialog.target === 'done' ? 'Passer en Fait et publier' : 'Repasser en cours'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog archivage */}
      <Dialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {archiveTarget?.archived ? <ArchiveRestore className="h-5 w-5 text-emerald-600" /> : <Archive className="h-5 w-5 text-orange-600" />}
              {archiveTarget?.archived ? 'Remettre dans le calendrier' : 'Archiver la course'}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {archiveTarget?.archived
                ? <><span className="font-semibold text-foreground">{archiveTarget?.nom}</span> sera de nouveau visible dans le calendrier principal.</>
                : <><span className="font-semibold text-foreground">{archiveTarget?.nom}</span> sera retirée du calendrier principal et déplacée dans les archives. Vous pourrez la désarchiver à tout moment.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Annuler</Button>
            <Button onClick={confirmArchive} className={archiveTarget?.archived ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}>
              {archiveTarget?.archived ? 'Remettre' : 'Archiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Petits composants
// ---------------------------------------------------------------------------

function CourseStatusPill({ course, onClick }: { course: CourseJson; onClick: () => void }) {
  const done = course.statutTraitement === 'done';
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
        done
          ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200'
      )}
      title={done ? 'Fait : décisions publiées. Cliquer pour repasser en cours.' : 'En cours : décisions non visibles des photographes. Cliquer pour passer en Fait.'}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', done ? 'bg-emerald-500' : 'bg-orange-500')} />
      {done ? 'Fait' : 'En cours'}
    </button>
  );
}

function CourseDates({ course }: { course: CourseJson }) {
  const debut = new Date(course.dateDebut);
  const fin = new Date(course.dateFin);
  const d0 = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
  const d1 = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
  const days = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
  return (
    <>
      <div className="flex items-center gap-1 text-xs font-semibold">
        <span className="capitalize">{format(debut, 'EEE dd/MM', { locale: fr })}</span>
        {days > 1 && <span className="rounded bg-sky-100 px-1 text-[9px] text-sky-800 dark:bg-sky-900 dark:text-sky-200">{days}j</span>}
      </div>
      {days > 1 && <div className="text-[11px] text-muted-foreground">au {format(fin, 'EEE dd/MM', { locale: fr })}</div>}
      <div className="text-[10px] text-muted-foreground">{format(debut, 'yyyy')}</div>
    </>
  );
}
