'use client';

import React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ZoomIn, ZoomOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AvailabilityCell } from '@/app/photographer/planning/_components/AvailabilityCell';

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

interface Photographer {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  inCharge?: boolean | string;
  chargeOne?: string;
  chargeTwo?: string;
  chargeThree?: string;
  chargeFour?: string;
  chargeFive?: string;
}

export default function PhotographerArchivesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]); // Toutes les courses (pour calculs du mois actuel)
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [currentPhotographer, setCurrentPhotographer] = useState<Photographer | null>(null);
  const [managedPhotographers, setManagedPhotographers] = useState<Photographer[]>([]);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string>('');
  const [zoom, setZoom] = useState(90);

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

      // Charger les données en parallèle (sans disponibilités pour l'instant)
      const [coursesRes, tarifsRes, photographersRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/tarifs'),
        fetch('/api/photographers'),
      ]);

      // Traiter les courses
      let archivedCourses: Course[] = [];
      let allCoursesData: Course[] = [];
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        allCoursesData = coursesData.courses || [];
        // Filtrer SEULEMENT les courses archivées
        archivedCourses = allCoursesData.filter((c: Course) => c.archived === 'oui');
        setCourses(archivedCourses);
        setAllCourses(allCoursesData);
      }

      // Traiter les tarifs
      let tarifsData: any = null;
      if (tarifsRes.ok) {
        tarifsData = await tarifsRes.json();
        // Convertir les tarifs en nombres pour éviter la concaténation de chaînes
        const tarifsWithNumbers = (tarifsData.tarifs || []).map((t: any) => ({
          ...t,
          tarifPhotographe: Number(t.tarifPhotographe) || 0,
          bonusChefEquipe: Number(t.bonusChefEquipe) || 0,
        }));
        setTarifs(tarifsWithNumbers);
        tarifsData.tarifs = tarifsWithNumbers;
      }

      // Traiter les photographes et charger leurs disponibilités
      let managedPhotographerIds: string[] = [];
      if (photographersRes.ok && userId) {
        const photographersData = await photographersRes.json();
        const allPhotographers = photographersData.photographers || [];

        // Trouver le photographe actuel
        const currentPhotog = allPhotographers.find((p: Photographer) => p.id === userId);
        setCurrentPhotographer(currentPhotog || null);

        // Trouver les photographes gérés (même logique que planning page)
        let managed: Photographer[] = [];
        if (currentPhotog && (currentPhotog.inCharge === 'TRUE' || currentPhotog.inCharge === true)) {
          // Collecter les IDs des photographes à charge
          const managedIds: string[] = [];
          if (currentPhotog.chargeOne) managedIds.push(currentPhotog.chargeOne);
          if (currentPhotog.chargeTwo) managedIds.push(currentPhotog.chargeTwo);
          if (currentPhotog.chargeThree) managedIds.push(currentPhotog.chargeThree);
          if (currentPhotog.chargeFour) managedIds.push(currentPhotog.chargeFour);
          if (currentPhotog.chargeFive) managedIds.push(currentPhotog.chargeFive);

          // Récupérer les objets photographes complets
          managed = allPhotographers.filter((p: Photographer) => managedIds.includes(p.id));
          managedPhotographerIds = managedIds;
        }

        setManagedPhotographers(managed);

        // Initialiser le photographe sélectionné (pour mobile) au photographe principal
        if (!selectedPhotographerId) {
          setSelectedPhotographerId(userId);
        }
      }

      // Charger les disponibilités pour l'utilisateur connecté ET tous les photographes à charge
      if (userId && archivedCourses.length > 0) {
        // Créer la liste de tous les IDs de photographes (principal + à charge)
        const allPhotographerIds = [userId, ...managedPhotographerIds];

        // Charger les disponibilités pour chaque photographe
        const disponibilitesRess = await Promise.all(
          allPhotographerIds.map(id => fetch(`/api/disponibilites?photographerId=${id}`))
        );

        // Traiter toutes les disponibilités (photographe principal + à charge)
        let allDisponibilites: any[] = [];
        for (const dispoRes of disponibilitesRess) {
          if (dispoRes.ok) {
            const disponibilitesData = await dispoRes.json();
            allDisponibilites = [...allDisponibilites, ...(disponibilitesData.disponibilites || [])];
          }
        }
        setDisponibilites(allDisponibilites);
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
      teamLeader: 'Ref',
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
    <div className="h-screen overflow-hidden flex flex-col space-y-1.5 p-4">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Sélecteur de photographe (mobile uniquement, si photographes à charge) */}
          {managedPhotographers.length > 0 && currentUser && currentPhotographer && (
            <div className="md:hidden w-full">
              <Select
                value={selectedPhotographerId}
                onValueChange={(value) => setSelectedPhotographerId(value)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Sélectionner un photographe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentUser.id}>
                    {currentPhotographer.prenom} {currentPhotographer.nom} (Moi)
                  </SelectItem>
                  {managedPhotographers.map(photographer => (
                    <SelectItem key={photographer.id} value={photographer.id}>
                      {photographer.prenom} {photographer.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Barre zoom - Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[3rem] text-center">{zoom}%</span>
            <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 150}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Vue liste mobile */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-3 px-2">
        {sortedMonths.map((monthData) => {
          const monthKey = `${monthData.year}-${monthData.month}`;

          // Utiliser le photographe sélectionné pour la vue mobile
          const activePhotographerId = selectedPhotographerId || currentUser?.id;

          // Déterminer si c'est le mois actuel
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const isCurrentMonth = monthData.year === currentYear && monthData.month === currentMonth;

          // Pour le mois actuel, inclure aussi les courses non archivées
          const coursesToCalculate = isCurrentMonth
            ? allCourses.filter(c => {
                const courseDate = new Date(c.dateDebut);
                return courseDate.getMonth() === currentMonth && courseDate.getFullYear() === currentYear;
              })
            : monthData.courses;

          // Calculer le montant total du mois pour les courses validées (photographe actuel)
          const monthTotal = coursesToCalculate.reduce((total, course) => {
            if (!activePhotographerId) return total;
            const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === activePhotographerId);
            if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
              const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
              const courseTarif = dispo.tarifId
                ? tarifs.find((t) => t.id === dispo.tarifId)
                : courseTarifs[0];

              if (courseTarif) {
                const amount = dispo.statut === 'teamLeader'
                  ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                  : Number(courseTarif.tarifPhotographe);
                return total + amount;
              }
            }
            return total;
          }, 0);

          // Calculer le total de tous les photographes
          const allPhotographersIds = [
            ...(currentUser ? [currentUser.id] : []),
            ...managedPhotographers.map(p => p.id)
          ];
          const allMonthTotal = coursesToCalculate.reduce((total, course) => {
            allPhotographersIds.forEach(photographerId => {
              const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === photographerId);
              if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                const courseTarif = dispo.tarifId
                  ? tarifs.find((t) => t.id === dispo.tarifId)
                  : courseTarifs[0];

                if (courseTarif) {
                  const amount = dispo.statut === 'teamLeader'
                    ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                    : Number(courseTarif.tarifPhotographe);
                  total += amount;
                }
              }
            });
            return total;
          }, 0);

          // Filtrer les courses pour afficher uniquement celles validées/chef pour le photographe actif
          const filteredCourses = monthData.courses.filter((course) => {
            if (!activePhotographerId) return false;
            const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === activePhotographerId);
            return dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader');
          });

          // Ne pas afficher le mois si aucune course validée
          if (filteredCourses.length === 0) return null;

          return (
            <div key={monthKey} className="space-y-2">
              {/* En-tête du mois */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900 dark:to-orange-950 p-3 rounded-lg border-2 border-orange-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base capitalize">
                      {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                    </h3>
                    {monthTotal > 0 && (
                      <div className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                        {activePhotographerId === currentUser?.id ? 'Mon total' : currentPhotographer?.prenom}: {monthTotal.toLocaleString('fr-FR')}€
                      </div>
                    )}
                  </div>
                  {allMonthTotal > 0 && (
                    <span className="font-bold text-sm text-orange-700 dark:text-orange-300">
                      Total: {allMonthTotal.toLocaleString('fr-FR')}€
                    </span>
                  )}
                </div>
              </div>

              {/* Cartes des courses */}
              {filteredCourses.map((course) => {
                const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === activePhotographerId);
                if (!dispo) return null;

                const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                const courseTarif = dispo.tarifId
                  ? tarifs.find((t) => t.id === dispo.tarifId)
                  : courseTarifs[0];

                const isTeamLeader = dispo.statut === 'teamLeader';

                return (
                  <div
                    key={course.id}
                    className={cn(
                      'p-3 rounded-lg border-2 shadow-sm opacity-75',
                      isTeamLeader
                        ? 'bg-purple-50 dark:bg-purple-950/30 border-l-4 border-l-purple-600'
                        : 'bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-600'
                    )}
                  >
                    {/* En-tête */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{isTeamLeader ? '👑' : '✓'}</span>
                          <h4 className="font-bold text-sm">{course.nom}</h4>
                          <span className="text-xs">🟢</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          📍 {course.ville || course.localisation}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs ml-2">
                        {isTeamLeader ? 'Ref' : 'Validé'}
                      </Badge>
                    </div>

                    {/* Infos */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">📅</span>
                        <span>{format(new Date(course.dateDebut), 'd MMM yyyy', { locale: fr })}</span>
                      </div>
                      {courseTarif && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">💶</span>
                          <span className="font-semibold text-foreground">
                            {isTeamLeader
                              ? `${Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)}€ (ref)`
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
        })}
      </div>

      {/* Tableau - Desktop uniquement */}
      <div className="hidden md:block flex-1 min-h-0 rounded-lg border shadow-lg bg-white dark:bg-gray-950 w-full overflow-y-auto">
        <div className="overflow-x-auto w-full" style={{ zoom: `${zoom}%` }}>
          {/* En-tête */}
          <div className="sticky top-0 z-20">
            <div
              className="grid gap-0 bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-900 dark:to-slate-900 border-b-2 border-gray-600/30 w-full"
              style={{ gridTemplateColumns: `2fr 1fr ${Array(1 + managedPhotographers.length).fill('2fr').join(' ')}` }}
            >
              <div
                className="sticky left-0 z-30 p-3 pr-2 border-r-2 border-gray-600/40 font-semibold text-sm"
                style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Course
              </div>
              <div className="p-3 pr-2 border-r-2 border-gray-600/40 font-semibold text-sm text-center">
                Date
              </div>
              <div className="p-3 text-center font-semibold text-sm border-r border-gray-600/40">
                {currentPhotographer ? `${currentPhotographer.prenom} ${currentPhotographer.nom}` : 'Mon statut'}
              </div>
              {managedPhotographers.map(photographer => (
                <div key={photographer.id} className="p-3 text-center font-semibold text-sm border-r border-gray-600/40">
                  {photographer.prenom} {photographer.nom}
                </div>
              ))}
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
              sortedMonths
                .filter((monthData) => {
                  // Filtrer pour afficher uniquement les mois avec au moins une course validée
                  const allPhotographersIds = [
                    ...(currentUser ? [currentUser.id] : []),
                    ...managedPhotographers.map(p => p.id)
                  ];

                  const hasValidatedCourse = monthData.courses.some(course => {
                    return allPhotographersIds.some(photographerId => {
                      const dispo = disponibilites.find(
                        (d) => d.courseId === course.id && d.photographeId === photographerId
                      );
                      return dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader');
                    });
                  });

                  return hasValidatedCourse;
                })
                .map((monthData) => {
                const monthKey = `${monthData.year}-${monthData.month}`;

                // Déterminer si c'est le mois actuel
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const isCurrentMonth = monthData.year === currentYear && monthData.month === currentMonth;

                // Pour le mois actuel, inclure aussi les courses non archivées
                const coursesToCalculate = isCurrentMonth
                  ? allCourses.filter(c => {
                      const courseDate = new Date(c.dateDebut);
                      return courseDate.getMonth() === currentMonth && courseDate.getFullYear() === currentYear;
                    })
                  : monthData.courses;

                // Calculer les stats pour chaque photographe
                const calculatePhotographerMonthStats = (photographerId: string) => {
                  const validatedCount = coursesToCalculate.reduce((count, course) => {
                    const dispo = disponibilites.find(
                      (d) => d.courseId === course.id && d.photographeId === photographerId
                    );
                    if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                      return count + 1;
                    }
                    return count;
                  }, 0);

                  const monthlyAmount = coursesToCalculate.reduce((total, course) => {
                    const dispo = disponibilites.find(
                      (d) => d.courseId === course.id && d.photographeId === photographerId
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
                  }, 0);

                  return { validatedCount, monthlyAmount };
                };

                const myValidatedCount = currentUser ? calculatePhotographerMonthStats(currentUser.id).validatedCount : 0;
                const myMonthlyAmount = currentUser ? calculatePhotographerMonthStats(currentUser.id).monthlyAmount : 0;

                // Calculer le total de tous les photographes pour ce mois
                const allPhotographersIds = [
                  ...(currentUser ? [currentUser.id] : []),
                  ...managedPhotographers.map(p => p.id)
                ];
                const totalMonthAmount = allPhotographersIds.reduce((sum, id) => {
                  return sum + calculatePhotographerMonthStats(id).monthlyAmount;
                }, 0);

                return (
                  <div key={monthKey}>
                    {/* Ligne mois */}
                    <div
                      className="grid gap-0 bg-orange-100 dark:bg-orange-900 border-b-2 border-orange-300 font-semibold w-full"
                      style={{ gridTemplateColumns: `2fr 1fr ${Array(1 + managedPhotographers.length).fill('2fr').join(' ')}` }}
                    >
                      <div className="sticky left-0 z-10 p-3 pr-2 border-r-2 border-orange-300 bg-orange-100 dark:bg-orange-900">
                        <div className="text-sm md:text-base font-bold">
                          {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                          {totalMonthAmount > 0 && (
                            <div className="text-xs font-bold text-orange-700 dark:text-orange-300 mt-1">
                              Total: {formatCurrency(totalMonthAmount)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-3 pr-2 border-r-2 border-orange-300 bg-orange-100 dark:bg-orange-900">
                        <div className="text-xs text-center">
                          {monthData.courses.length} course{monthData.courses.length > 1 ? 's' : ''}
                        </div>
                      </div>
                      {/* Colonne pour le photographe principal */}
                      <div className="p-3 flex flex-col items-center justify-center text-xs font-semibold border-r border-orange-300">
                        <div>
                          {myValidatedCount > 0 ? `${myValidatedCount} validée${myValidatedCount > 1 ? 's' : ''}` : '-'}
                        </div>
                        {myMonthlyAmount > 0 && (
                          <div className="text-gray-700 dark:text-gray-400 mt-0.5 font-bold">
                            {formatCurrency(myMonthlyAmount)}
                          </div>
                        )}
                      </div>
                      {/* Colonnes pour les photographes à charge */}
                      {managedPhotographers.map(photographer => {
                        const stats = calculatePhotographerMonthStats(photographer.id);
                        return (
                          <div key={photographer.id} className="p-3 flex flex-col items-center justify-center text-xs font-semibold border-r border-orange-300">
                            <div>
                              {stats.validatedCount > 0 ? `${stats.validatedCount} validée${stats.validatedCount > 1 ? 's' : ''}` : '-'}
                            </div>
                            {stats.monthlyAmount > 0 && (
                              <div className="text-gray-700 dark:text-gray-400 mt-0.5 font-bold">
                                {formatCurrency(stats.monthlyAmount)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Courses */}
                    {monthData.courses
                      .filter((course) => {
                        // Filtrer pour afficher uniquement les courses où au moins un photographe est validé ou chef
                        const allPhotographersIds = [
                          ...(currentUser ? [currentUser.id] : []),
                          ...managedPhotographers.map(p => p.id)
                        ];

                        const hasValidated = allPhotographersIds.some(photographerId => {
                          const dispo = disponibilites.find(
                            (d) => d.courseId === course.id && d.photographeId === photographerId
                          );
                          return dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader');
                        });

                        return hasValidated;
                      })
                      .map((course, courseIdx) => {
                      const myDispo = currentUser
                        ? disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id)
                        : undefined;

                      const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                      const courseTarif = courseTarifs[0];

                      const isValidated = myDispo && (myDispo.statut === 'validated' || myDispo.statut === 'teamLeader');
                      const isRejected = myDispo && myDispo.statut === 'rejected';

                      // Calculer les validations et le coût total pour TOUS les photographes
                      const allPhotographersIds = [
                        ...(currentUser ? [currentUser.id] : []),
                        ...managedPhotographers.map(p => p.id)
                      ];

                      const allValidatedDispos = disponibilites.filter(d =>
                        d.courseId === course.id &&
                        allPhotographersIds.includes(d.photographeId) &&
                        (d.statut === 'validated' || d.statut === 'teamLeader')
                      );

                      const totalCourseAmount = allValidatedDispos.reduce((sum, dispo) => {
                        const tarifForDispo = dispo.tarifId
                          ? tarifs.find(t => t.id === dispo.tarifId)
                          : courseTarif;

                        if (tarifForDispo) {
                          const amount = dispo.statut === 'teamLeader'
                            ? Number(tarifForDispo.tarifPhotographe) + Number(tarifForDispo.bonusChefEquipe)
                            : Number(tarifForDispo.tarifPhotographe);
                          return sum + amount;
                        }
                        return sum;
                      }, 0);

                      const bgColor = courseIdx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-950' : 'bg-gray-50 dark:bg-gray-950';
                      const rowBgColor = isValidated
                        ? myDispo.statut === 'teamLeader'
                          ? 'bg-purple-50 dark:bg-purple-950/30'
                          : 'bg-green-50 dark:bg-green-950/30'
                        : bgColor;

                      return (
                        <div
                          key={course.id}
                          className={cn(
                            'grid gap-0 border-b transition-all duration-200 w-full opacity-75',
                            rowBgColor,
                            isValidated && myDispo.statut !== 'teamLeader' && 'border-l-4 border-l-green-600',
                            myDispo?.statut === 'teamLeader' && 'border-l-4 border-l-purple-600',
                            isRejected && 'opacity-40',
                            !isValidated && !isRejected && 'border-gray-200/50'
                          )}
                          style={{ gridTemplateColumns: `2fr 1fr ${Array(1 + managedPhotographers.length).fill('2fr').join(' ')}` }}
                        >
                          {/* Colonne Course */}
                          <div
                            className={cn('sticky left-0 z-10 p-3 pr-2 border-r-2 border-gray-600/40', rowBgColor)}
                            style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              {isValidated && (
                                <span className="text-base">{myDispo?.statut === 'teamLeader' ? '👑' : '✓'}</span>
                              )}
                              <span className="font-semibold text-sm">{course.nom}</span>
                              <span className="text-xs">🟢</span>
                            </div>
                            <div className="text-xs text-muted-foreground">📍 {course.ville || course.localisation}</div>

                            {/* Afficher tous les photographes validés */}
                            {allValidatedDispos.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  {allValidatedDispos.length} validé{allValidatedDispos.length > 1 ? 's' : ''}
                                </div>
                                {totalCourseAmount > 0 && (
                                  <div className="text-sm font-bold text-green-700 dark:text-green-400">
                                    💰 Total: {totalCourseAmount}€
                                  </div>
                                )}
                              </div>
                            )}

                            {allValidatedDispos.length === 0 && courseTarif && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                  💰 {courseTarif.tarifPhotographe}€
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Colonne Date */}
                          <div className="p-3 pr-2 flex flex-col justify-center border-r-2 border-gray-600/40">
                            <div className="text-sm font-semibold text-center">{format(new Date(course.dateDebut), 'dd/MM', { locale: fr })}</div>
                            {course.dateFin && course.dateFin !== course.dateDebut && (
                              <div className="text-xs text-muted-foreground text-center">
                                → {format(new Date(course.dateFin), 'dd/MM', { locale: fr })}
                              </div>
                            )}
                          </div>

                          {/* Colonne Mon Statut */}
                          <div className="p-2 flex flex-col items-center justify-center gap-1 border-r border-gray-600/40">
                            {currentUser && (
                              <AvailabilityCell
                                disponibilite={myDispo || null}
                                course={course}
                                photographerId={currentUser.id}
                                onStatusChange={() => {}}
                                tarifAmount={courseTarif?.tarifPhotographe}
                                bonusChefEquipe={courseTarif?.bonusChefEquipe}
                              />
                            )}
                          </div>

                          {/* Colonnes pour les photographes à charge */}
                          {managedPhotographers.map(photographer => {
                            const photoDispo = disponibilites.find(
                              (d) => d.courseId === course.id && d.photographeId === photographer.id
                            );

                            return (
                              <div key={photographer.id} className="p-2 flex flex-col items-center justify-center gap-1 border-r border-gray-600/40">
                                <AvailabilityCell
                                  disponibilite={photoDispo || null}
                                  course={course}
                                  photographerId={photographer.id}
                                  onStatusChange={() => {}}
                                  tarifAmount={courseTarif?.tarifPhotographe}
                                  bonusChefEquipe={courseTarif?.bonusChefEquipe}
                                />
                              </div>
                            );
                          })}
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
