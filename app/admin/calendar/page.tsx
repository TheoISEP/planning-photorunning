'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUpDown, Info, CalendarPlus } from 'lucide-react';
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
  tauxReussite?: number;
}

// Fonction pour générer un fichier .ics compatible avec tous les calendriers
const generateICS = (course: Course) => {
  const formatICSDate = (date: string) => {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PhotoRunning//Planning//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${course.id}@photorunning.com`,
    `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
    `DTSTART:${formatICSDate(course.dateDebut)}`,
    `DTEND:${formatICSDate(course.dateFin)}`,
    `SUMMARY:${course.nom}`,
    `LOCATION:${course.localisation}, ${course.ville}`,
    `DESCRIPTION:Course PhotoRunning - ${course.nom}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel: ${course.nom} demain',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icsContent;
};

// Fonction pour télécharger le fichier .ics
const downloadICS = (course: Course) => {
  const icsContent = generateICS(course);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `${course.nom.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function AdminCalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stats personnelles du photographe depuis Google Sheets
  const [myStats, setMyStats] = useState<PhotographerStats>({
    nombreCourses: 0,
    nombrePrestations: 0,
    montantTotal: 0,
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
        fetch('/api/statistics?personal=true'), // Récupère les stats personnelles pour l'admin
      ]);

      // Traiter les courses
      let activeCourses: Course[] = [];
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        const allCourses = coursesData.courses || [];
        // Filtrer les courses non archivées
        activeCourses = allCourses.filter((c: Course) => c.archived !== 'oui');
        setCourses(activeCourses);
      }

      // Traiter les tarifs
      if (tarifsRes.ok) {
        const tarifsData = await tarifsRes.json();
        // Convertir les tarifs en nombres pour éviter la concaténation de chaînes
        const tarifsWithNumbers = (tarifsData.tarifs || []).map((t: any) => ({
          ...t,
          tarifPhotographe: Number(t.tarifPhotographe) || 0,
          bonusChefEquipe: Number(t.bonusChefEquipe) || 0,
        }));
        setTarifs(tarifsWithNumbers);
      }

      // Traiter les disponibilités
      if (disponibilitesRes.ok) {
        const disponibilitesData = await disponibilitesRes.json();
        const allDispos = disponibilitesData.disponibilites || [];
        setDisponibilites(allDispos);

        // Créer automatiquement les disponibilités manquantes
        if (userId && activeCourses.length > 0) {
          const missingDispos: any[] = [];

          activeCourses.forEach((course: Course) => {
            const hasDisponibilite = allDispos.some(
              (d: any) => d.courseId === course.id && d.photographeId === userId
            );

            if (!hasDisponibilite) {
              missingDispos.push({
                courseId: course.id,
                photographeId: userId,
                statut: 'pending',
                dateDeclaration: new Date().toISOString(),
              });
            }
          });

          // Créer les disponibilités manquantes une par une
          if (missingDispos.length > 0) {
            const createdDispos: any[] = [];

            for (const dispo of missingDispos) {
              try {
                const createRes = await fetch('/api/disponibilites', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(dispo),
                });

                if (createRes.ok) {
                  const newDispo = await createRes.json();
                  createdDispos.push(newDispo.disponibilite);
                }
              } catch (error) {
                // Erreur silencieuse, on continue avec les autres
              }
            }

            // Ajouter toutes les nouvelles disponibilités créées
            if (createdDispos.length > 0) {
              setDisponibilites([...allDispos, ...createdDispos]);
            }
          }
        }
      }

      // Traiter les statistiques personnelles depuis Google Sheets
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.photographerStats) {
          setMyStats({
            nombreCourses: Number(statsData.photographerStats.nombreCourses) || 0,
            nombrePrestations: Number(statsData.photographerStats.nombrePrestations) || 0,
            montantTotal: Number(statsData.photographerStats.montantTotal) || 0,
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

  // Charger les données au montage initial et quand refreshKey change
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Rafraîchir les données quand on revient sur la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Forcer un refresh en changeant la clé
        setRefreshKey(prev => prev + 1);
      }
    };

    const handleFocus = () => {
      // Forcer un refresh en changeant la clé
      setRefreshKey(prev => prev + 1);
    };

    // Écouter les événements de visibilité
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Fonction pour recharger uniquement les disponibilités sans loader
  const refreshDisponibilites = async () => {
    if (!currentUser) return;
    try {
      const disponibilitesRes = await fetch('/api/disponibilites');
      if (disponibilitesRes.ok) {
        const disponibilitesData = await disponibilitesRes.json();
        setDisponibilites(disponibilitesData.disponibilites || []);
      }
    } catch (error) {
      console.error('Erreur refresh disponibilités:', error);
    }
  };

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
        refreshDisponibilites();
      }
    } catch (error) {
      refreshDisponibilites();
    }
  };

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

  const getStatusColorClass = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 border-yellow-300 text-yellow-900 hover:bg-yellow-200',
      available: 'bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200',
      unavailable: 'bg-gray-200 border-gray-400 text-gray-900 hover:bg-gray-300',
      validated: 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200',
      teamLeader: 'bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200',
      rejected: 'bg-red-100 border-red-300 text-red-900 hover:bg-red-200',
    };
    return colors[status] || 'bg-white border-gray-300';
  };

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
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-2 md:space-y-1.5">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Mon Calendrier</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Gérez vos disponibilités</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto h-10 sm:h-9">
            <Link href="/admin/calendar/stats">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Mes statistiques
            </Link>
          </Button>
        </div>
      </div>

      {/* Vue liste (mobile uniquement) */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-3 px-2">
        {sortedMonths.map((monthData) => {
          const monthKey = `${monthData.year}-${monthData.month}`;

          // Calculer le montant total du mois pour les courses validées
          const monthTotal = monthData.courses.reduce((total, course) => {
            if (!currentUser) return total;
            const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id);
            if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
              const courseTarifs = tarifs.filter((t) => t.courseId === course.id);

              // Trouver le tarif correspondant avec fallback
              let courseTarif = dispo.tarifId ? tarifs.find((t) => t.id === dispo.tarifId) : null;

              // Si le tarifId spécifique n'est pas trouvé (ID obsolète), utiliser le tarif de la course
              if (!courseTarif) {
                courseTarif = courseTarifs[0];
              }

              if (courseTarif) {
                const amount = dispo.statut === 'teamLeader'
                  ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                  : Number(courseTarif.tarifPhotographe);
                return total + amount;
              }
            }
            return total;
          }, 0);

          return (
            <div key={monthKey} className="space-y-2">
              {/* En-tête du mois */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900 dark:to-orange-950 p-3 rounded-lg border-2 border-orange-300">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base capitalize">
                    {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                  </h3>
                  {monthTotal > 0 && (
                    <span className="font-bold text-sm text-orange-700 dark:text-orange-300">
                      {monthTotal.toLocaleString('fr-FR')}€
                    </span>
                  )}
                </div>
              </div>

              {/* Cartes des courses */}
              {monthData.courses
                .filter((course) => {
                  // Filtrer les courses rejected
                  if (!currentUser) return true;
                  const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id);
                  return !dispo || dispo.statut !== 'rejected';
                })
                .map((course) => {
                const dispo = currentUser
                  ? disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id)
                  : null;

                const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                const courseTarif = dispo?.tarifId
                  ? tarifs.find((t) => t.id === dispo.tarifId)
                  : courseTarifs[0];

                const statusConfig = {
                  validated: { bg: 'bg-green-50 border-green-300', text: 'text-green-700', label: '✓ Validé' },
                  teamLeader: { bg: 'bg-purple-50 border-purple-300', text: 'text-purple-700', label: '★ Référent' },
                  pending: { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', label: '⏳ En attente' },
                  available: { bg: 'bg-blue-50 border-blue-300', text: 'text-blue-700', label: '✓ Disponible' },
                  unavailable: { bg: 'bg-gray-50 border-gray-300', text: 'text-gray-600', label: '✗ Indisponible' },
                  rejected: { bg: 'bg-red-50 border-red-300', text: 'text-red-700', label: '✗ Refusé' },
                };

                const config = dispo ? statusConfig[dispo.statut] : statusConfig.pending;
                // Afficher le sélecteur pour pending, available, unavailable (pas pour validated, teamLeader, rejected)
                const isValidatedOrLeader = dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader');
                const canChangeStatus = dispo && ['pending', 'available', 'unavailable'].includes(dispo.statut);

                return (
                  <div
                    key={course.id}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all',
                      config.bg
                    )}
                  >
                    <div className="space-y-2">
                      {/* Titre et statut */}
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/admin/planning/${course.id}`} className="font-semibold text-sm flex-1 hover:underline">
                          {course.nom}
                        </Link>
                        {!canChangeStatus && dispo && (
                          <span className={cn('text-xs px-2 py-0.5 rounded font-medium', config.text)}>
                            {config.label}
                          </span>
                        )}
                      </div>

                      {/* Informations */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">📍</span>
                          <span>{course.localisation || course.ville}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">📅</span>
                          <span>{format(new Date(course.dateDebut), 'dd/MM/yyyy', { locale: fr })}</span>
                        </div>
                        {courseTarif && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">💶</span>
                            <span className={cn(
                              "font-semibold",
                              (dispo?.statut === 'validated' || dispo?.statut === 'teamLeader') ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {dispo?.statut === 'teamLeader'
                                ? `${Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)}€ (ref)`
                                : `${courseTarif.tarifPhotographe}€`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bouton d'ajout au calendrier pour les courses validées */}
                      {isValidatedOrLeader && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            downloadICS(course);
                          }}
                        >
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          Ajouter au calendrier
                        </Button>
                      )}

                      {/* Sélecteur de disponibilité pour pending, available, unavailable */}
                      {canChangeStatus && currentUser && dispo && (
                        <div className="w-full">
                          <Select
                            value={dispo.statut}
                            onValueChange={(value) => handleStatusChange(dispo.id, value, course.id, currentUser.id)}
                          >
                            <SelectTrigger className="w-full h-9 text-xs">
                              <SelectValue>
                                {dispo.statut === 'pending' && '⏳ En attente'}
                                {dispo.statut === 'available' && '✓ Disponible'}
                                {dispo.statut === 'unavailable' && '✗ Indisponible'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">⏳ En attente</SelectItem>
                              <SelectItem value="available">✓ Disponible</SelectItem>
                              <SelectItem value="unavailable">✗ Indisponible</SelectItem>
                            </SelectContent>
                          </Select>
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

      {/* Tableau (desktop uniquement) */}
      <div className="hidden md:flex flex-1 min-h-0 rounded-lg border shadow-lg bg-white dark:bg-gray-950 overflow-hidden w-full">
        <div className="overflow-x-auto overflow-y-auto h-full w-full">
          {/* En-tête */}
          <div className="sticky top-0 z-20 w-full">
            <div
              className="grid gap-0 bg-gradient-to-r from-gray-100 to-gray-100 dark:from-gray-900 dark:to-gray-900 border-b-2 border-gray-600/30 w-full"
              style={{ gridTemplateColumns: '2fr 1fr 2fr' }}
            >
              <div
                className="sticky left-0 z-30 p-3 pr-2 border-r-2 border-gray-600/40 font-semibold text-sm bg-gradient-to-r from-gray-100 to-gray-100 dark:from-gray-900 dark:to-gray-900"
                style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Course
              </div>
              <div
                className="sticky z-30 p-3 pr-2 border-r-2 border-gray-600/40 font-semibold text-sm bg-gradient-to-r from-gray-100 to-gray-100 dark:from-gray-900 dark:to-gray-900"
                style={{ position: 'sticky', left: '40%', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Date
              </div>
              <div className="p-3 text-center font-semibold text-sm">Mon statut</div>
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

                      // Trouver le tarif correspondant avec fallback
                      let courseTarif = dispo.tarifId ? tarifs.find((t) => t.id === dispo.tarifId) : null;

                      // Si le tarifId spécifique n'est pas trouvé (ID obsolète), utiliser le tarif de la course
                      if (!courseTarif) {
                        courseTarif = courseTarifs[0];
                      }

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
                    className="grid gap-0 bg-orange-100 dark:bg-orange-900 border-b-2 border-orange-300 font-semibold w-full"
                    style={{ gridTemplateColumns: '2fr 1fr 2fr' }}
                  >
                    <div className="sticky left-0 z-10 p-3 pr-2 border-r-2 border-orange-300 bg-orange-100 dark:bg-orange-900">
                      <div className="text-sm md:text-base font-bold">
                        {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                      </div>
                    </div>
                    <div
                      className="sticky z-10 p-3 pr-2 border-r-2 border-orange-300 bg-orange-100 dark:bg-orange-900"
                      style={{ left: '40%' }}
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
                        <div className="text-gray-700 dark:text-gray-400 mt-0.5 font-bold">
                          {formatCurrency(myMonthlyAmount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Courses */}
                  {(() => {
                    const sortedCourses = monthData.courses
                      .filter((course) => {
                        // Filtrer les courses rejected
                        if (!currentUser) return true;
                        const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id);
                        return !dispo || dispo.statut !== 'rejected';
                      })
                      .sort((a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime());
                    return sortedCourses.map((course, courseIdx) => {
                    const myDispo = currentUser
                      ? disponibilites.find((d) => d.courseId === course.id && d.photographeId === currentUser.id)
                      : undefined;

                    const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
                    const courseTarif = courseTarifs[0];
                    const hasMultipleTarifs = courseTarifs.length > 1;

                    const isValidated = myDispo && (myDispo.statut === 'validated' || myDispo.statut === 'teamLeader');
                    const isRejected = myDispo && myDispo.statut === 'rejected';

                    const bgColor = courseIdx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-950' : 'bg-gray-50 dark:bg-gray-950';
                    const rowBgColor = isValidated
                      ? myDispo.statut === 'teamLeader'
                        ? 'bg-purple-50 dark:bg-purple-950/30'
                        : 'bg-green-50 dark:bg-green-950/30'
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
                            className="border-t border-gray-300/30 dark:border-gray-700/30"
                            style={{ gridColumn: '1 / -1', height: '1px' }}
                          />
                        )}

                        <div
                          className={cn(
                            'grid gap-0 border-b transition-all duration-200 w-full',
                            rowBgColor,
                            isValidated && myDispo.statut !== 'teamLeader' && 'border-l-4 border-l-green-600 hover:bg-green-100 shadow-sm',
                            myDispo?.statut === 'teamLeader' && 'border-l-4 border-l-purple-600 hover:bg-purple-100',
                            isRejected && 'opacity-40 hover:opacity-60 border-gray-200/50',
                            !isValidated && !isRejected && 'border-gray-200/50 hover:bg-gray-100'
                          )}
                          style={{ gridTemplateColumns: '2fr 1fr 2fr' }}
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
                            <Link
                              href={`/admin/planning/${course.id}`}
                              className={cn(
                                'font-semibold hover:underline text-sm touch-manipulation',
                                isValidated && 'text-gray-800',
                                myDispo?.statut === 'teamLeader' && 'text-purple-800'
                              )}
                            >
                              {course.nom}
                            </Link>
                            {course.statutTraitement === 'done' ? <span className="text-xs">🟢</span> : <span className="text-xs">🟠</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">📍 {course.ville || course.localisation}</div>
                          {courseTarif && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {isValidated && courseTarif ? (
                                <span
                                  className={cn(
                                    'text-sm font-bold',
                                    myDispo?.statut === 'teamLeader' ? 'text-purple-700' : 'text-gray-700'
                                  )}
                                >
                                  💰{' '}
                                  {myDispo?.statut === 'teamLeader'
                                    ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                                    : courseTarif.tarifPhotographe}
                                  €
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground">
                                  💰 {courseTarif.tarifPhotographe}€
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Colonne Date */}
                        <div
                          className={cn('sticky z-10 p-3 pr-2 flex flex-col justify-center border-r-2 border-gray-600/40', rowBgColor)}
                          style={{ position: 'sticky', left: 'minmax(180px, 1fr)', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                        >
                          <div className="text-sm font-semibold">{format(new Date(course.dateDebut), 'dd/MM', { locale: fr })}</div>
                          {course.dateFin && course.dateFin !== course.dateDebut && (
                            <div className="text-xs text-muted-foreground">
                              → {format(new Date(course.dateFin), 'dd/MM', { locale: fr })}
                            </div>
                          )}
                        </div>

                        {/* Colonne Mon Statut */}
                        <div className="p-2 flex flex-col items-center justify-center gap-1">
                          {myDispo ? (
                            <>
                              {/* Si la course est "inProgress" ET que le photographe est en pending/available/unavailable, il peut modifier */}
                              {course.statutTraitement === 'inProgress' &&
                               (myDispo.statut === 'pending' || myDispo.statut === 'available' || myDispo.statut === 'unavailable') ? (
                                <Select
                                  value={myDispo.statut}
                                  onValueChange={(value) => currentUser && handleStatusChange(myDispo.id, value, course.id, currentUser.id)}
                                >
                                  <SelectTrigger
                                    className={`h-10 md:h-9 text-sm w-full min-w-[110px] border transition-all focus:border-gray-600 px-3 font-medium touch-manipulation ${getStatusColorClass(
                                      myDispo.statut
                                    )}`}
                                  >
                                    <SelectValue>{getStatusLabel(myDispo.statut)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="z-[9999]">
                                    <SelectItem value="pending" className="h-10 md:h-9">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                                        <span className="text-sm">Attente</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="available" className="h-10 md:h-9">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                        <span className="text-sm">Dispo</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="unavailable" className="h-10 md:h-9">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                                        <span className="text-sm">Pas dispo</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div
                                  className={`h-10 md:h-9 text-sm w-full min-w-[110px] border px-3 font-medium flex items-center justify-center rounded-md ${getStatusColorClass(
                                    myDispo.statut
                                  )}`}
                                >
                                  {getStatusLabel(myDispo.statut)}
                                </div>
                              )}

                              {hasMultipleTarifs && myDispo.tarifId && (
                                <div className="text-[9px] w-full text-center text-gray-600 mt-1">
                                  {courseTarifs.find((t) => t.id === myDispo.tarifId)?.description || 'Tarif personnalisé'}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col gap-1.5 w-full px-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 md:h-9 text-sm font-medium bg-blue-50 hover:bg-blue-100 border-blue-300 touch-manipulation active:scale-95 transition-transform"
                                onClick={async () => {
                                  if (!currentUser) return;

                                  const newDispoId = `dispo-${course.id}-${currentUser.id}`;

                                  // Mise à jour optimiste
                                  setDisponibilites((prev) => [
                                    ...prev,
                                    {
                                      id: newDispoId,
                                      photographeId: currentUser.id,
                                      courseId: course.id,
                                      statut: 'available' as const,
                                    }
                                  ]);

                                  try {
                                    const res = await fetch('/api/disponibilites', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        photographeId: currentUser.id,
                                        courseId: course.id,
                                        statut: 'available',
                                        dateDeclaration: new Date().toISOString(),
                                      }),
                                    });
                                    if (!res.ok) {
                                      // Rollback en cas d'erreur
                                      refreshDisponibilites();
                                    }
                                  } catch (error) {
                                    console.error('Erreur:', error);
                                    refreshDisponibilites();
                                  }
                                }}
                              >
                                ✓ Dispo
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 md:h-9 text-sm font-medium bg-gray-50 hover:bg-gray-100 border-gray-300 touch-manipulation active:scale-95 transition-transform"
                                onClick={async () => {
                                  if (!currentUser) return;

                                  const newDispoId = `dispo-${course.id}-${currentUser.id}`;

                                  // Mise à jour optimiste
                                  setDisponibilites((prev) => [
                                    ...prev,
                                    {
                                      id: newDispoId,
                                      photographeId: currentUser.id,
                                      courseId: course.id,
                                      statut: 'unavailable' as const,
                                    }
                                  ]);

                                  try {
                                    const res = await fetch('/api/disponibilites', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        photographeId: currentUser.id,
                                        courseId: course.id,
                                        statut: 'unavailable',
                                        dateDeclaration: new Date().toISOString(),
                                      }),
                                    });
                                    if (!res.ok) {
                                      // Rollback en cas d'erreur
                                      refreshDisponibilites();
                                    }
                                  } catch (error) {
                                    console.error('Erreur:', error);
                                    refreshDisponibilites();
                                  }
                                }}
                              >
                                ✗ Pas dispo
                              </Button>
                            </div>
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
