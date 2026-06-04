'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ZoomIn, ZoomOut, Info, ArrowLeft, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Course {
  id: string;
  nom: string;
  localisation: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  statutTraitement: 'inProgress' | 'done';
  coureursAttendus?: number;
  archived?: string;
  archivedAt?: string;
}

interface Tarif {
  id: string;
  courseId: string;
  tarifPhotographe: number;
  bonusChefEquipe: number;
  description?: string;
}

interface Disponibilite {
  id: string;
  photographeId: string;
  courseId: string;
  statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected';
  tarifId?: string;
}

export default function PhotographerArchivesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [zoom, setZoom] = useState(90);

  // Stats des archives
  const [archiveStats, setArchiveStats] = useState({
    totalCourses: 0,
    totalValidated: 0,
    totalAmount: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Récupérer l'utilisateur connecté
      const userRes = await fetch('/api/auth/me');
      let userId: string | null = null;
      if (userRes.ok) {
        const userData = await userRes.json();
        userId = userData.user.id;
        if (userId) {
          setCurrentUser({ id: userId });
        }
      }

      // Charger les données en parallèle
      const [coursesRes, tarifsRes, disponibilitesRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/tarifs'),
        fetch('/api/disponibilites'),
      ]);

      // Traiter les courses
      let archivedCourses: Course[] = [];
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        const allCourses = coursesData.courses || [];
        // Filtrer SEULEMENT les courses archivées
        archivedCourses = allCourses.filter((c: Course) => c.archived === 'oui');
        setCourses(archivedCourses);
      }

      // Traiter les tarifs
      let tarifsData: any = null;
      if (tarifsRes.ok) {
        tarifsData = await tarifsRes.json();
        setTarifs(tarifsData.tarifs || []);
      }

      // Traiter les disponibilités
      if (disponibilitesRes.ok) {
        const disponibilitesData = await disponibilitesRes.json();
        const allDisponibilites = disponibilitesData.disponibilites || [];
        setDisponibilites(allDisponibilites);

        // Calculer les stats des archives pour ce photographe
        if (userId && tarifsData) {
          const myArchivedDispos = allDisponibilites.filter(
            (d: Disponibilite) =>
              d.photographeId === userId &&
              (d.statut === 'validated' || d.statut === 'teamLeader')
          );

          let totalAmount = 0;
          myArchivedDispos.forEach((dispo: Disponibilite) => {
            const courseTarifs = tarifsData.tarifs.filter((t: Tarif) => t.courseId === dispo.courseId);
            const tarif = dispo.tarifId
              ? tarifsData.tarifs.find((t: Tarif) => t.id === dispo.tarifId)
              : courseTarifs[0];

            if (tarif) {
              const tarifPhoto = Number(tarif.tarifPhotographe) || 0;
              const bonusChef = Number(tarif.bonusChefEquipe) || 0;
              const montant = dispo.statut === 'teamLeader' ? tarifPhoto + bonusChef : tarifPhoto;
              totalAmount += montant;
            }
          });

          setArchiveStats({
            totalCourses: archivedCourses.length,
            totalValidated: myArchivedDispos.length,
            totalAmount,
          });
        }
      }
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Attente',
      available: 'Dispo',
      unavailable: 'Pas dispo',
      validated: 'Validé',
      teamLeader: 'Chef',
      rejected: 'Refusé',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      available: 'outline',
      unavailable: 'secondary',
      validated: 'default',
      teamLeader: 'default',
      rejected: 'destructive',
    };
    return colors[status] || 'outline';
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Regrouper par mois
  const coursesByMonth = courses.reduce((acc, course) => {
    const date = new Date(course.dateDebut);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;

    if (!acc[key]) {
      acc[key] = { year, month, courses: [] };
    }

    acc[key].courses.push(course);
    return acc;
  }, {} as Record<string, { year: number; month: number; courses: Course[] }>);

  const sortedMonths = Object.values(coursesByMonth).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement des archives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col space-y-1.5">
      {/* En-tête */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/photographer/planning">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au calendrier
              </Button>
            </Link>
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Archives</h1>
          <p className="text-xs text-muted-foreground">Consultez vos prestations passées (lecture seule)</p>
        </div>
      </div>

      {/* Statistiques archives */}
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-2 flex-shrink-0">
          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  Courses archivées
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Total de courses archivées</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{archiveStats.totalCourses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  Mes prestations
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Prestations validées dans les archives</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{archiveStats.totalValidated}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  Montant total
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Total gagné sur prestations archivées</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{formatCurrency(archiveStats.totalAmount)}</div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Barre zoom - Masquer sur mobile */}
      <div className="hidden md:flex items-center justify-end gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">Zoom:</span>
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 50}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[3rem] text-center">{zoom}%</span>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 150}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Vue liste mobile */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-3 px-2">
        {sortedMonths.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <p className="text-muted-foreground">Aucune course archivée</p>
            </div>
          </div>
        ) : (
          sortedMonths.map((monthData) => {
            const monthKey = `${monthData.year}-${monthData.month}`;
            return (
              <div key={monthKey} className="space-y-2">
                {/* Header mois */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900 dark:to-orange-800 px-3 py-2 rounded-lg shadow-sm border border-orange-200 dark:border-orange-700">
                  <h3 className="font-bold text-base capitalize">
                    {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {monthData.courses.length} course{monthData.courses.length > 1 ? 's' : ''}
                  </p>
                </div>

                {/* Courses du mois */}
                {monthData.courses.map((course) => {
                  const myDispo = currentUser
                    ? disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id)
                    : undefined;

                  const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                  const courseTarif = courseTarifs[0];

                  const isValidated = myDispo && (myDispo.statut === 'validated' || myDispo.statut === 'teamLeader');

                  const config = {
                    bg: 'bg-gray-50 dark:bg-gray-900',
                    border: 'border-gray-200 dark:border-gray-700',
                  };

                  return (
                    <div
                      key={course.id}
                      className={cn(
                        'p-3 rounded-lg border-2 shadow-sm opacity-75',
                        config.bg,
                        config.border
                      )}
                    >
                      {/* En-tête */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            {isValidated && (
                              <span className="text-sm">{myDispo?.statut === 'teamLeader' ? '👑' : '✓'}</span>
                            )}
                            <h4 className="font-bold text-sm">{course.nom}</h4>
                            <span className="text-xs">🟢</span>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            📍 {course.localisation}
                          </p>
                        </div>
                        {myDispo && (
                          <Badge variant={getStatusColor(myDispo.statut)} className="text-xs ml-2">
                            {getStatusLabel(myDispo.statut)}
                          </Badge>
                        )}
                      </div>

                      {/* Infos */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">📅</span>
                          <span>{format(new Date(course.dateDebut), 'd MMM yyyy', { locale: fr })}</span>
                        </div>
                        {courseTarif && isValidated && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">💶</span>
                            <span className="font-semibold text-foreground">
                              {myDispo?.statut === 'teamLeader'
                                ? `${Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)}€ (chef)`
                                : `${courseTarif.tarifPhotographe}€`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Tableau - Desktop uniquement */}
      <div className="hidden md:block flex-1 rounded-lg border shadow-lg bg-white dark:bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full" style={{ zoom: `${zoom}%` }}>
          {/* En-tête */}
          <div className="sticky top-0 z-20">
            <div
              className="grid gap-0 bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-900 dark:to-slate-900 border-b-2 border-gray-600/30"
              style={{ gridTemplateColumns: '200px 120px 1fr', minWidth: '100%' }}
            >
              <div
                className="sticky left-0 z-30 p-2 pr-1.5 border-r-2 border-gray-600/40 font-semibold text-sm bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-900 dark:to-slate-900"
                style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Course
              </div>
              <div
                className="sticky z-30 p-2 pr-1.5 border-r-2 border-gray-600/40 font-semibold text-sm bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-900 dark:to-slate-900"
                style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Date
              </div>
              <div className="p-2 text-center font-semibold text-sm">Statut final</div>
            </div>
          </div>

          {/* Lignes */}
          <div>
            {sortedMonths.length === 0 ? (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <p className="text-muted-foreground">Aucune course archivée</p>
                </div>
              </div>
            ) : (
              sortedMonths.map((monthData) => {
                const monthKey = `${monthData.year}-${monthData.month}`;

                return (
                  <div key={monthKey}>
                    {/* Ligne mois */}
                    <div
                      className="grid gap-0 bg-gray-100 dark:bg-gray-900 border-b-2 border-gray-300 font-semibold"
                      style={{ gridTemplateColumns: '200px 120px 1fr', minWidth: '100%' }}
                    >
                      <div className="sticky left-0 z-10 p-3 border-r-2 border-gray-300 bg-gray-100 dark:bg-gray-900">
                        <div className="text-sm font-bold">
                          {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                        </div>
                      </div>
                      <div
                        className="sticky z-10 p-3 border-r-2 border-gray-300 bg-gray-100 dark:bg-gray-900"
                        style={{ left: '200px' }}
                      >
                        <div className="text-xs">
                          {monthData.courses.length} course{monthData.courses.length > 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="p-3 flex items-center justify-center text-xs font-semibold">Archivées</div>
                    </div>

                    {/* Courses */}
                    {monthData.courses.map((course, courseIdx) => {
                      const myDispo = currentUser
                        ? disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id)
                        : undefined;

                      const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                      const courseTarif = courseTarifs[0];

                      const isValidated = myDispo && (myDispo.statut === 'validated' || myDispo.statut === 'teamLeader');

                      const bgColor = courseIdx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-950' : 'bg-slate-50 dark:bg-slate-950';

                      return (
                        <div
                          key={course.id}
                          className={cn('grid gap-0 border-b border-gray-200/50 opacity-75', bgColor)}
                          style={{ gridTemplateColumns: '200px 120px 1fr', minWidth: '100%' }}
                        >
                          {/* Colonne Course */}
                          <div
                            className={cn('sticky left-0 z-10 p-2 pr-1.5 border-r-2 border-gray-600/40', bgColor)}
                            style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {isValidated && (
                                <span className="text-sm">{myDispo?.statut === 'teamLeader' ? '👑' : '✓'}</span>
                              )}
                              <span className="font-semibold text-xs">{course.nom}</span>
                              <span className="text-[10px]">🟢</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">📍 {course.localisation}</div>
                            {courseTarif && isValidated && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  💰{' '}
                                  {myDispo?.statut === 'teamLeader'
                                    ? courseTarif.tarifPhotographe + courseTarif.bonusChefEquipe
                                    : courseTarif.tarifPhotographe}
                                  €
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Colonne Date */}
                          <div
                            className={cn('sticky z-10 p-2 pr-1.5 flex flex-col border-r-2 border-gray-600/40', bgColor)}
                            style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                          >
                            <div className="text-xs font-semibold">{format(new Date(course.dateDebut), 'dd/MM/yy', { locale: fr })}</div>
                            {course.dateFin && course.dateFin !== course.dateDebut && (
                              <div className="text-[10px] text-muted-foreground">
                                au {format(new Date(course.dateFin), 'dd/MM/yy', { locale: fr })}
                              </div>
                            )}
                          </div>

                          {/* Colonne Statut (non éditable) */}
                          <div className="p-2 flex flex-col items-center justify-center gap-0.5">
                            {myDispo ? (
                              <Badge variant={getStatusColor(myDispo.statut)} className="text-xs">
                                {getStatusLabel(myDispo.statut)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
