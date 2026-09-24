'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, ChevronDown, ChevronRight, Crown, Medal, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatEuros } from '@/components/planning/statuts';
import { fetchJson } from '@/components/planning/types';

interface RankingCourse {
  courseId: string;
  nom: string;
  ville: string;
  date: string;
  statut: 'validated' | 'teamLeader';
  montant: number;
  tarif: string;
}
interface RankingEntry {
  id: string;
  prenom: string;
  nom: string;
  region: string;
  role: 'admin' | 'photographer';
  actif: boolean;
  test: boolean;
  courses: number;
  referent: number;
  valide: number;
  montant: number;
  details: RankingCourse[];
}

type SortKey = 'courses' | 'referent' | 'montant';

export default function PhotographerRankingPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState<string>('all');
  const [sort, setSort] = React.useState<SortKey>('montant');
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<RankingEntry[]>([]);
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<{ ranking: RankingEntry[] }>(`/api/photographers/ranking${year === 'all' ? '' : `?year=${year}`}`)
      .then((r) => {
        if (!cancelled) setRows(r.ranking);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erreur de chargement'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => b[sort] - a[sort] || b.montant - a.montant || b.courses - a.courses),
    [rows, sort]
  );
  const totals = React.useMemo(
    // Les admins restent dans le tableau mais ne comptent pas dans les totaux.
    () => rows.filter((r) => r.role !== 'admin').reduce((s, r) => ({ n: s.n + 1, courses: s.courses + r.courses, referent: s.referent + r.referent, montant: s.montant + r.montant }), { n: 0, courses: 0, referent: 0, montant: 0 }),
    [rows]
  );
  const years = Array.from({ length: currentYear + 1 - 2019 }, (_, i) => String(currentYear + 1 - i));

  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="h-full space-y-5 overflow-y-auto pb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" asChild className="mt-0.5">
            <Link href="/admin/photographers"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Trophy className="h-6 w-6 text-amber-500" /> Classement des photographes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Courses où le photographe a été validé ou référent, et montant correspondant. Les courses annulées ne comptent pas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les années</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="courses">Trier par courses</SelectItem>
              <SelectItem value="referent">Trier par fois référent</SelectItem>
              <SelectItem value="montant">Trier par montant</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Photographes classés <span className="opacity-70">(hors admins)</span></div><div className="text-2xl font-bold">{totals.n}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Prestations (validé + référent)</div><div className="text-2xl font-bold">{totals.courses} <span className="text-sm font-medium text-muted-foreground">dont {totals.referent} en référent</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Montant total versé <span className="opacity-70">(hors admins)</span></div><div className="text-2xl font-bold">{formatEuros(totals.montant)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Calcul du classement…</div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Aucune course validée sur cette période.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-muted-foreground dark:bg-gray-900">
                <tr>
                  <th className="w-12 px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Photographe</th>
                  <th className="hidden px-3 py-2 text-left md:table-cell">Région</th>
                  <th className={cn('px-3 py-2 text-right', sort === 'courses' && 'text-foreground')}>Courses</th>
                  <th className={cn('px-3 py-2 text-right', sort === 'referent' && 'text-foreground')}>Référent</th>
                  <th className="hidden px-3 py-2 text-right md:table-cell">Validé</th>
                  <th className={cn('px-3 py-2 text-right', sort === 'montant' && 'text-foreground')}>Montant</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const rank = i + 1;
                  const isOpen = open.has(r.id);
                  return (
                    <React.Fragment key={r.id}>
                      <tr className={cn('cursor-pointer border-b transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/40', r.test && 'text-muted-foreground', !r.actif && 'opacity-60')} onClick={() => toggle(r.id)}>
                        <td className="px-3 py-2 font-semibold tabular-nums">
                          {rank <= 3 ? <Medal className={cn('inline h-4 w-4', rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-gray-400' : 'text-amber-700')} /> : rank}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold">
                            {r.prenom} {r.nom}
                            {r.role === 'admin' && <span className="ml-2 rounded border px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">admin</span>}
                            {!r.actif && <span className="ml-2 rounded border px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">inactif</span>}
                          </div>
                        </td>
                        <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{r.region || '–'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{r.courses}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.referent > 0 ? <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300"><Crown className="h-3.5 w-3.5" />{r.referent}</span> : <span className="text-muted-foreground">–</span>}
                        </td>
                        <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{r.valide}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatEuros(r.montant)}</td>
                        <td className="px-2 py-2 text-muted-foreground">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b bg-gray-50/60 dark:bg-gray-900/30">
                          <td colSpan={8} className="px-3 py-2 md:px-14">
                            <div className="grid gap-1 text-xs">
                              {r.details.map((c, j) => (
                                <div key={`${c.courseId}-${c.tarif}-${j}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-0.5">
                                  <span className="w-24 shrink-0 whitespace-nowrap capitalize text-muted-foreground">{format(new Date(c.date), 'dd MMM yyyy', { locale: fr })}</span>
                                  <Link href={`/admin/planning/${c.courseId}`} className="font-medium hover:underline">{c.nom}</Link>
                                  <span className="text-muted-foreground">{c.ville}</span>
                                  {c.tarif && <span className="rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">{c.tarif}</span>}
                                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', c.statut === 'teamLeader' ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200')}>
                                    {c.statut === 'teamLeader' ? '★ Référent' : 'Validé'}
                                  </span>
                                  <span className="ml-auto font-semibold tabular-nums">{formatEuros(c.montant)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
