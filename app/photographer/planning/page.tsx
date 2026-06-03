'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ZoomIn, ZoomOut, ArrowUpDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface PhotographerStats {
  nombreCourses: number;
  nombrePrestations: number;
  montantTotal: number;
  heuresTravail: number;
  tauxReussite?: number;
}

export default function PhotographerPlanningPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [zoom, setZoom] = useState(90);

  // Stats personnelles du photographe depuis Google Sheets
  const [myStats, setMyStats] = useState<PhotographerStats>({
    nombreCourses: 0,
    nombrePrestations: 0,
    montantTotal: 0,
    heuresTravail: 0,
    tauxReussite: 0,
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

      // Charger les données en parallèle pour optimiser la vitesse
      const [coursesRes, tarifsRes, disponibilitesRes, statsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/tarifs'),
        fetch('/api/disponibilites'),
        fetch('/api/statistics'), // Récupère les stats personnelles pour le photographe
      ]);

      // Traiter les courses
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        const allCourses = coursesData.courses || [];
        // Filtrer les courses non archivées
        const activeCourses = allCourses.filter((c: Course) => c.archived !== 'oui');
        setCourses(activeCourses);
      }

      // Traiter les tarifs
      if (tarifsRes.ok) {
        const tarifsData = await tarifsRes.json();
        setTarifs(tarifsData.tarifs || []);
      }

      // Traiter les disponibilités
      if (disponibilitesRes.ok) {
        const disponibilitesData = await disponibilitesRes.json();
        setDisponibilites(disponibilitesData.disponibilites || []);
      }

      // Traiter les statistiques personnelles depuis Google Sheets
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.photographerStats) {
          setMyStats({
            nombreCourses: Number(statsData.photographerStats.nombreCourses) || 0,
            nombrePrestations: Number(statsData.photographerStats.nombrePrestations) || 0,
            montantTotal: Number(statsData.photographerStats.montantTotal) || 0,
            heuresTravail: Number(statsData.photographerStats.heuresTravail) || 0,
            tauxReussite: Number(statsData.photographerStats.tauxReussite) || 0,
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

  const handleStatusChange = async (
    disponibiliteId: string,
    newStatus: string,
    courseId: string,
    photographerId: string
  ) => {
    // Vérifier que c'est bien le photographe connecté
    if (!currentUser || currentUser.id !== photographerId) {
      return;
    }

    try {
      // Mise à jour optimiste
      setDisponibilites((prev) =>
        prev.map((d) => (d.id === disponibiliteId ? { ...d, statut: newStatus as Disponibilite['statut'] } : d))
      );

      // Appel API
      const res = await fetch('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: disponibiliteId,
          statut: newStatus,
          courseId,
          photographeId: photographerId,
          dateModification: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        // Rollback en cas d'erreur
        fetchData();
      }
    } catch (error) {
      fetchData();
    }
  };

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

  const getStatusColorClass = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 border-yellow-300 text-yellow-900 hover:bg-yellow-200',
      available: 'bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200',
      unavailable: 'bg-gray-200 border-gray-400 text-gray-900 hover:bg-gray-300',
      validated: 'bg-green-100 border-green-300 text-green-900 hover:bg-green-200',
      teamLeader: 'bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200',
      rejected: 'bg-red-100 border-red-300 text-red-900 hover:bg-red-200',
    };
    return colors[status] || 'bg-white border-gray-300';
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

  // Fonction pour déterminer à quel week-end appartient une date
  // Un week-end va du jeudi au lundi (inclus)
  const getWeekendKey = (date: Date): string => {
    const day = date.getDay();
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let thursdayOffset = 0;
    if (day === 0) thursdayOffset = -3;
    else if (day === 1) thursdayOffset = -4;
    else if (day === 2) thursdayOffset = 2;
    else if (day === 3) thursdayOffset = 1;
    else if (day === 4) thursdayOffset = 0;
    else if (day === 5) thursdayOffset = -1;
    else if (day === 6) thursdayOffset = -2;

    const thursday = new Date(dateOnly);
    thursday.setDate(thursday.getDate() + thursdayOffset);

    return `${thursday.getFullYear()}-${thursday.getMonth()}-${thursday.getDate()}`;
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col space-y-1.5">
      {/* En-tête */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Mon Planning</h1>
          <p className="text-xs text-muted-foreground">Gérez vos disponibilités et consultez vos prestations</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link href="/photographer/planning/stats">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Mes statistiques
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistiques personnelles */}
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2 flex-shrink-0">
          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  Mes courses
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Nombre de courses où vous êtes validé ce mois</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{myStats.nombreCourses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  Prestations
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Total de vos prestations ce mois</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{myStats.nombrePrestations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  Montant gagné
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Total de vos rémunérations ce mois</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{formatCurrency(myStats.montantTotal)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  Heures
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Heures de travail ce mois</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{myStats.heuresTravail}h</div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Barre zoom */}
      <div className="flex items-center justify-end gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">Zoom:</span>
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 50}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[3rem] text-center">{zoom}%</span>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 150}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Tableau */}
      <div className="flex-1 rounded-lg border shadow-lg bg-white dark:bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full" style={{ zoom: `${zoom}%` }}>
          {/* En-tête */}
          <div className="sticky top-0 z-20">
            <div
              className="grid gap-0 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 border-b-2 border-green-600/30"
              style={{ gridTemplateColumns: '200px 120px 1fr', minWidth: '100%' }}
            >
              <div
                className="sticky left-0 z-30 p-2 pr-1.5 border-r-2 border-green-600/40 font-semibold text-sm bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900"
                style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Course
              </div>
              <div
                className="sticky z-30 p-2 pr-1.5 border-r-2 border-green-600/40 font-semibold text-sm bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900"
                style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Date
              </div>
              <div className="p-2 text-center font-semibold text-sm">Mon statut</div>
            </div>
          </div>

          {/* Lignes */}
          <div>
            {sortedMonths.map((monthData) => {
              const monthKey = `${monthData.year}-${monthData.month}`;
              const myValidatedCount = currentUser
                ? monthData.courses.reduce((count, course) => {
                    const dispo = disponibilites.find(
                      (d) => d.courseId === course.id && d.photographeId === currentUser.id
                    );
                    if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                      return count + 1;
                    }
                    return count;
                  }, 0)
                : 0;

              // Calculer le montant total gagné ce mois
              const myMonthlyAmount = currentUser
                ? monthData.courses.reduce((total, course) => {
                    const dispo = disponibilites.find(
                      (d) => d.courseId === course.id && d.photographeId === currentUser.id
                    );
                    if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                      const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                      const courseTarif = dispo.tarifId
                        ? tarifs.find((t) => t.id === dispo.tarifId)
                        : courseTarifs[0];

                      if (courseTarif) {
                        const montant = dispo.statut === 'teamLeader'
                          ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                          : Number(courseTarif.tarifPhotographe);
                        return total + montant;
                      }
                    }
                    return total;
                  }, 0)
                : 0;

              return (
                <div key={monthKey}>
                  {/* Ligne mois */}
                  <div
                    className="grid gap-0 bg-orange-100 dark:bg-orange-900 border-b-2 border-orange-300 font-semibold"
                    style={{ gridTemplateColumns: '200px 120px 1fr', minWidth: '100%' }}
                  >
                    <div className="sticky left-0 z-10 p-3 border-r-2 border-orange-300 bg-orange-100 dark:bg-orange-900">
                      <div className="text-sm font-bold">
                        {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                      </div>
                    </div>
                    <div
                      className="sticky z-10 p-3 border-r-2 border-orange-300 bg-orange-100 dark:bg-orange-900"
                      style={{ left: '200px' }}
                    >
                      <div className="text-xs">
                        {monthData.courses.length} course{monthData.courses.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="p-3 flex flex-col items-center justify-center text-xs font-semibold">
                      <div>
                        {myValidatedCount > 0 ? `${myValidatedCount} validée${myValidatedCount > 1 ? 's' : ''}` : '-'}
                      </div>
                      {myMonthlyAmount > 0 && (
                        <div className="text-green-700 dark:text-green-400 mt-0.5">
                          {formatCurrency(myMonthlyAmount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Courses */}
                  {(() => {
                    const sortedCourses = monthData.courses.sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());
                    return sortedCourses.map((course, courseIdx) => {
                    const myDispo = currentUser
                      ? disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id)
                      : undefined;

                    const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                    const courseTarif = courseTarifs[0];
                    const hasMultipleTarifs = courseTarifs.length > 1;

                    const isValidated = myDispo && (myDispo.statut === 'validated' || myDispo.statut === 'teamLeader');
                    const isRejected = myDispo && myDispo.statut === 'rejected';

                    const bgColor = courseIdx % 2 === 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-emerald-50 dark:bg-emerald-950';
                    const rowBgColor = isValidated
                      ? myDispo.statut === 'teamLeader'
                        ? 'bg-purple-50 dark:bg-purple-950/30'
                        : 'bg-green-100 dark:bg-green-900/40'
                      : bgColor;

                    // Détection des changements de week-end
                    const currentWeekend = getWeekendKey(new Date(course.dateDebut));
                    const prevCourse = courseIdx > 0 ? sortedCourses[courseIdx - 1] : null;
                    const prevWeekend = prevCourse ? getWeekendKey(new Date(prevCourse.dateDebut)) : null;
                    const isNewWeekend = prevWeekend && currentWeekend !== prevWeekend;

                    return (
                      <React.Fragment key={course.id}>
                        {/* Séparateur de week-end */}
                        {isNewWeekend && (
                          <div
                            className="border-t border-green-300/30 dark:border-green-700/30"
                            style={{ gridColumn: '1 / -1', height: '1px' }}
                          />
                        )}

                        <div
                          className={cn(
                            'grid gap-0 border-b transition-all duration-200',
                            rowBgColor,
                            isValidated && 'border-l-4 border-l-green-600 hover:bg-green-200 shadow-sm',
                            myDispo?.statut === 'teamLeader' && 'border-l-4 border-l-purple-600 hover:bg-purple-200',
                            isRejected && 'opacity-40 hover:opacity-60 border-green-200/50',
                            !isValidated && !isRejected && 'border-green-200/50 hover:bg-green-100'
                          )}
                          style={{ gridTemplateColumns: '200px 120px 1fr', minWidth: '100%' }}
                        >
                        {/* Colonne Course */}
                        <div
                          className={cn('sticky left-0 z-10 p-2 pr-1.5 border-r-2 border-green-600/40', rowBgColor)}
                          style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {isValidated && (
                              <span className="text-sm">{myDispo?.statut === 'teamLeader' ? '👑' : '✓'}</span>
                            )}
                            <Link
                              href={`/photographer/planning/${course.id}`}
                              className={cn(
                                'font-semibold hover:underline text-xs',
                                isValidated && 'text-green-800',
                                myDispo?.statut === 'teamLeader' && 'text-purple-800'
                              )}
                            >
                              {course.nom}
                            </Link>
                            {course.statutTraitement === 'done' ? <span className="text-[10px]">🟢</span> : <span className="text-[10px]">🟠</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground">📍 {course.localisation}</div>
                          {courseTarif && (
                            <div className="flex items-center gap-1.5 mt-1">
                              {isValidated && courseTarif ? (
                                <span
                                  className={cn(
                                    'text-xs font-bold',
                                    myDispo?.statut === 'teamLeader' ? 'text-purple-700' : 'text-green-700'
                                  )}
                                >
                                  💰{' '}
                                  {myDispo?.statut === 'teamLeader'
                                    ? courseTarif.tarifPhotographe + courseTarif.bonusChefEquipe
                                    : courseTarif.tarifPhotographe}
                                  €
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  💰 {courseTarif.tarifPhotographe}€
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Colonne Date */}
                        <div
                          className={cn('sticky z-10 p-2 pr-1.5 flex flex-col border-r-2 border-green-600/40', rowBgColor)}
                          style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                        >
                          <div className="text-xs font-semibold">{format(new Date(course.dateDebut), 'dd/MM/yy', { locale: fr })}</div>
                          {course.dateFin && course.dateFin !== course.dateDebut && (
                            <div className="text-[10px] text-muted-foreground">
                              au {format(new Date(course.dateFin), 'dd/MM/yy', { locale: fr })}
                            </div>
                          )}
                        </div>

                        {/* Colonne Mon Statut */}
                        <div className="p-2 flex flex-col items-center justify-center gap-0.5">
                          {myDispo ? (
                            <>
                              <Select
                                value={myDispo.statut}
                                onValueChange={(value) => currentUser && handleStatusChange(myDispo.id, value, course.id, currentUser.id)}
                                disabled={
                                  // Désactiver seulement si le statut est validé, teamLeader ou rejected
                                  myDispo.statut === 'validated' || myDispo.statut === 'teamLeader' || myDispo.statut === 'rejected'
                                }
                              >
                                <SelectTrigger
                                  className={`h-8 text-xs w-full border transition-all focus:border-green-600 px-2 font-medium ${getStatusColorClass(
                                    myDispo.statut
                                  )}`}
                                >
                                  <SelectValue>{getStatusLabel(myDispo.statut)}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                                      <span className="text-xs">Attente</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="available">
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                                      <span className="text-xs">Dispo</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="unavailable">
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                                      <span className="text-xs">Pas dispo</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="validated" disabled>
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-green-500" />
                                      <span className="text-xs">Validé</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="teamLeader" disabled>
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-purple-500" />
                                      <span className="text-xs">Chef</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="rejected" disabled>
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-red-500" />
                                      <span className="text-xs">Refusé</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              {hasMultipleTarifs && myDispo.tarifId && (
                                <div className="text-[9px] w-full text-center text-gray-600 mt-1">
                                  {courseTarifs.find((t) => t.id === myDispo.tarifId)?.description || 'Tarif personnalisé'}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">-</div>
                          )}
                        </div>
                        </div>
                      </React.Fragment>
                    );
                  });
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
