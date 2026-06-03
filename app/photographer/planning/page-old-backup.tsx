'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Calendar, Users, Briefcase, Euro, ArrowUpDown, Info, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  visible: boolean;
  archived?: string;
  archivedAt?: string;
  archivedBy?: string;
}

interface Photographer {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
}

interface Admin {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
}

interface Tarif {
  id: string;
  courseId: string;
  tarifPhotographe: number;
  bonusChefEquipe: number;
  description?: string;
  nombreJours?: string;
}

interface Disponibilite {
  id: string;
  photographeId: string;
  courseId: string;
  statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected';
  tarifId?: string;
}

interface CourseWithData extends Course {
  tarif?: Tarif;
  tarifs?: Tarif[];
  disponibilites: Disponibilite[];
  photographesValides: number;
  photographesDisponibles: number;
  coutTotal: number;
}

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

export default function PhotographerPlanningPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseWithData[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  // Zoom uniquement (pas de filtre statut pour le photographe)
  const [zoom, setZoom] = useState(90);

  // Stats globales avec détails
  const [stats, setStats] = useState({
    totalCourses: 0,
    coursesDetails: [] as Array<{ nom: string; ville: string; validated: number }>,
    totalPhotographers: 0,
    photographersDetails: [] as Array<{ nom: string; prenom: string; prestations: number }>,
    totalPrestations: 0,
    prestationsDetails: { validated: 0, teamLeaders: 0 },
    coutTotal: 0,
    coutDetails: { tarifBase: 0, bonus: 0 },
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch current user
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser({ id: userData.user.id });
      }

      // Fetch courses, photographers, admins, tarifs et statistiques en parallèle
      const [coursesRes, photographersRes, adminsRes, tarifsRes, statsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/photographers'),
        fetch('/api/admins'),
        fetch('/api/tarifs'),
        fetch('/api/statistics')
      ]);

      const [coursesData, photographersData, adminsData, tarifsData, statsData] = await Promise.all([
        coursesRes.json(),
        photographersRes.json(),
        adminsRes.json(),
        tarifsRes.json(),
        statsRes.json()
      ]);

      // Essayer de récupérer les disponibilités, sinon tableau vide
      let disponibilitesData = { disponibilites: [] };
      try {
        const disponibilitesRes = await fetch('/api/disponibilites');
        if (disponibilitesRes.ok) {
          disponibilitesData = await disponibilitesRes.json();
        }
      } catch (error) {
        // API disponibilités non disponible
      }

      const allPhotographers = photographersData.photographers || [];
      const allAdmins = adminsData.admins || [];
      const allCourses = coursesData.courses || [];
      const allDisponibilites = disponibilitesData.disponibilites || [];
      const allTarifs = tarifsData.tarifs || [];

      // Auto-archiver les courses passées
      const now = new Date();
      const coursesToArchive = allCourses.filter((course: Course) => {
        // Ne pas archiver si déjà archivé
        if (course.archived === 'oui') return false;

        // Archiver si la date de fin est passée
        const dateFin = new Date(course.dateFin);
        return dateFin < now;
      });

      // Marquer les courses comme archivées dans la liste locale
      coursesToArchive.forEach((courseToArchive: Course) => {
        const course = allCourses.find((c: Course) => c.id === courseToArchive.id);
        if (course) {
          course.archived = 'oui';
          course.archivedAt = new Date().toISOString();
        }
      });

      // Combiner admins et photographes (admins en premier)
      const allUsers = [...allAdmins, ...allPhotographers];

      // Créer des disponibilités par défaut pour tous les utilisateurs qui n'en ont pas
      let finalDisponibilites = [...allDisponibilites];

      allCourses.forEach((course: Course) => {
        allUsers.forEach((user) => {
          // Vérifier si une disponibilité existe déjà pour cet utilisateur et cette course
          const existingDispo = finalDisponibilites.find(
            (d: Disponibilite) => d.courseId === course.id && d.photographeId === user.id
          );

          // Si aucune disponibilité n'existe, en créer une par défaut
          if (!existingDispo) {
            finalDisponibilites.push({
              id: `dispo-${course.id}-${user.id}`,
              photographeId: user.id,
              courseId: course.id,
              statut: 'pending',
            });
          }
        });
      });

      setTarifs(allTarifs);
      setDisponibilites(finalDisponibilites);
      setPhotographers(allPhotographers);
      setAdmins(allAdmins);

      // Calculer les données enrichies pour chaque course
      const coursesWithData = allCourses.map((course: Course) => {
        const courseTarifs = allTarifs.filter((t) => t.courseId === course.id);
        const tarif = courseTarifs[0]; // Premier tarif par défaut pour affichage
        const dispos = finalDisponibilites.filter((d: Disponibilite) => d.courseId === course.id);

        const photographesValides = dispos.filter(
          (d: Disponibilite) => d.statut === 'validated' || d.statut === 'teamLeader'
        ).length;

        const photographesDisponibles = dispos.filter(
          (d: Disponibilite) => d.statut === 'available' || d.statut === 'validated' || d.statut === 'teamLeader'
        ).length;

        // Calcul du coût total basé sur les tarifs assignés
        let coutTotal = 0;
        dispos.forEach((d: Disponibilite) => {
          if (d.statut === 'validated' || d.statut === 'teamLeader') {
            const tarifDispo = d.tarifId
              ? allTarifs.find((t) => t.id === d.tarifId)
              : tarif;

            if (tarifDispo) {
              const tarifPhoto = Number(tarifDispo.tarifPhotographe) || 0;
              const bonusChef = Number(tarifDispo.bonusChefEquipe) || 0;
              const montant = d.statut === 'teamLeader'
                ? tarifPhoto + bonusChef
                : tarifPhoto;
              coutTotal += montant;
            }
          }
        });

        return {
          ...course,
          tarif,
          tarifs: courseTarifs,
          disponibilites: dispos,
          photographesValides,
          photographesDisponibles,
          coutTotal,
        };
      });

      setCourses(coursesWithData);

      // Filtrer les courses non archivées pour les statistiques
      const activeCourses = coursesWithData.filter((c) => c.archived !== 'oui');

      // Calculer les stats globales avec détails (uniquement sur les courses actives)
      const totalPrestations = activeCourses.reduce(
        (sum, c) => sum + c.photographesValides,
        0
      );
      const coutTotal = activeCourses.reduce((sum, c) => sum + c.coutTotal, 0);

      // Détails des courses (uniquement actives)
      const coursesDetails = activeCourses.map((c) => ({
        nom: c.nom,
        ville: c.ville,
        validated: c.photographesValides,
      }));

      // Obtenir les IDs des courses actives
      const activeCourseIds = new Set(activeCourses.map(c => c.id));

      // Filtrer les disponibilités pour ne garder que celles des courses actives
      const activeDisponibilites = finalDisponibilites.filter(
        (d: Disponibilite) => activeCourseIds.has(d.courseId)
      );

      // Détails des photographes avec leur nombre de prestations (uniquement courses actives)
      const photographersMap = new Map<string, { nom: string; prenom: string; prestations: number }>();
      allUsers.forEach((user: any) => {
        photographersMap.set(user.id, {
          nom: user.nom,
          prenom: user.prenom,
          prestations: 0,
        });
      });

      activeDisponibilites.forEach((dispo: Disponibilite) => {
        if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
          const photographer = photographersMap.get(dispo.photographeId);
          if (photographer) {
            photographer.prestations++;
          }
        }
      });

      const photographersDetails = Array.from(photographersMap.values())
        .filter(p => p.prestations > 0)
        .sort((a, b) => b.prestations - a.prestations);

      // Détails des prestations (uniquement courses actives)
      const validatedCount = activeDisponibilites.filter((d: Disponibilite) => d.statut === 'validated').length;
      const teamLeadersCount = activeDisponibilites.filter((d: Disponibilite) => d.statut === 'teamLeader').length;

      // Détails du coût (uniquement courses actives)
      let tarifBase = 0;
      let bonus = 0;
      activeCourses.forEach((course) => {
        course.disponibilites.forEach((d: Disponibilite) => {
          if (d.statut === 'validated' || d.statut === 'teamLeader') {
            // Utiliser le tarif assigné au photographe, ou le tarif par défaut de la course
            const tarifDispo = d.tarifId
              ? allTarifs.find((t) => t.id === d.tarifId)
              : course.tarif;

            if (tarifDispo) {
              tarifBase += Number(tarifDispo.tarifPhotographe) || 0;
              if (d.statut === 'teamLeader') {
                bonus += Number(tarifDispo.bonusChefEquipe) || 0;
              }
            }
          }
        });
      });

      // Utiliser les statistiques depuis Google Sheets si disponibles
      const adminStats = statsData.adminStats;
      if (adminStats) {
        setStats({
          totalCourses: Number(adminStats.nombreCourses) || activeCourses.length,
          coursesDetails,
          totalPhotographers: Number(adminStats.nombrePhotographes) || allUsers.filter((u: any) => u.actif).length,
          photographersDetails,
          totalPrestations: Number(adminStats.nombrePrestations) || totalPrestations,
          prestationsDetails: { validated: validatedCount, teamLeaders: teamLeadersCount },
          coutTotal: Number(adminStats.coutTotal) || coutTotal,
          coutDetails: { tarifBase, bonus },
        });
      } else {
        // Fallback sur les statistiques calculées si pas disponibles dans Google Sheets
        setStats({
          totalCourses: activeCourses.length,
          coursesDetails,
          totalPhotographers: allUsers.filter((u: any) => u.actif).length,
          photographersDetails,
          totalPrestations,
          prestationsDetails: { validated: validatedCount, teamLeaders: teamLeadersCount },
          coutTotal,
          coutDetails: { tarifBase, bonus },
        });
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
    // Vérifier que c'est bien le photographe connecté qui modifie ses disponibilités
    if (!currentUser || currentUser.id !== photographerId) {
      return;
    }

    try {
      // Mise à jour optimiste immédiate
      const updatedDisponibilites = disponibilites.map((d) =>
        d.id === disponibiliteId
          ? { ...d, statut: newStatus as Disponibilite['statut'] }
          : d
      );
      setDisponibilites(updatedDisponibilites);

      // Recalculer immédiatement les courses avec les nouvelles dispos
      const coursesWithData = courses.map((course) => {
        const dispos = updatedDisponibilites.filter((d) => d.courseId === course.id);

        const photographesValides = dispos.filter(
          (d) => d.statut === 'validated' || d.statut === 'teamLeader'
        ).length;

        const photographesDisponibles = dispos.filter(
          (d) => d.statut === 'available' || d.statut === 'validated' || d.statut === 'teamLeader'
        ).length;

        // Calculer le coût total en utilisant les tarifs assignés
        let coutTotal = 0;
        dispos.forEach((d) => {
          if (d.statut === 'validated' || d.statut === 'teamLeader') {
            const tarifDispo = d.tarifId
              ? tarifs.find((t: Tarif) => t.id === d.tarifId)
              : course.tarif;

            if (tarifDispo) {
              const tarifPhoto = Number(tarifDispo.tarifPhotographe) || 0;
              const bonusChef = Number(tarifDispo.bonusChefEquipe) || 0;
              const montant = d.statut === 'teamLeader'
                ? tarifPhoto + bonusChef
                : tarifPhoto;
              coutTotal += montant;
            }
          }
        });

        return {
          ...course,
          disponibilites: dispos,
          photographesValides,
          photographesDisponibles,
          coutTotal,
        };
      });

      setCourses(coursesWithData);

      // Filtrer les courses non archivées pour les statistiques
      const activeCourses = coursesWithData.filter((c) => c.archived !== 'oui');

      // Recalculer les stats avec détails (uniquement courses actives)
      const totalPrestations = activeCourses.reduce((sum, c) => sum + c.photographesValides, 0);
      const coutTotal = activeCourses.reduce((sum, c) => sum + c.coutTotal, 0);

      // Recalculer les détails (uniquement courses actives)
      const coursesDetails = activeCourses.map((c) => ({
        nom: c.nom,
        ville: c.ville,
        validated: c.photographesValides,
      }));

      // Obtenir les IDs des courses actives
      const activeCourseIds = new Set(activeCourses.map(c => c.id));

      // Filtrer les disponibilités pour ne garder que celles des courses actives
      const activeDisponibilites = updatedDisponibilites.filter(
        (d: Disponibilite) => activeCourseIds.has(d.courseId)
      );

      const photographersMap = new Map<string, { nom: string; prenom: string; prestations: number }>();
      [...admins, ...photographers].forEach((user: any) => {
        photographersMap.set(user.id, {
          nom: user.nom,
          prenom: user.prenom,
          prestations: 0,
        });
      });

      activeDisponibilites.forEach((dispo: Disponibilite) => {
        if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
          const photographer = photographersMap.get(dispo.photographeId);
          if (photographer) {
            photographer.prestations++;
          }
        }
      });

      const photographersDetails = Array.from(photographersMap.values())
        .filter(p => p.prestations > 0)
        .sort((a, b) => b.prestations - a.prestations);

      const validatedCount = activeDisponibilites.filter((d: Disponibilite) => d.statut === 'validated').length;
      const teamLeadersCount = activeDisponibilites.filter((d: Disponibilite) => d.statut === 'teamLeader').length;

      let tarifBase = 0;
      let bonus = 0;
      activeCourses.forEach((course) => {
        course.disponibilites.forEach((d: Disponibilite) => {
          if (d.statut === 'validated' || d.statut === 'teamLeader') {
            // Utiliser le tarif assigné au photographe, ou le tarif par défaut de la course
            const tarifDispo = d.tarifId
              ? tarifs.find((t: Tarif) => t.id === d.tarifId)
              : course.tarif;

            if (tarifDispo) {
              tarifBase += Number(tarifDispo.tarifPhotographe) || 0;
              if (d.statut === 'teamLeader') {
                bonus += Number(tarifDispo.bonusChefEquipe) || 0;
              }
            }
          }
        });
      });

      setStats({
        totalCourses: activeCourses.length,
        coursesDetails,
        totalPhotographers: stats.totalPhotographers, // Préserver la valeur existante
        photographersDetails,
        totalPrestations,
        prestationsDetails: { validated: validatedCount, teamLeaders: teamLeadersCount },
        coutTotal,
        coutDetails: { tarifBase, bonus },
      });

      // Récupérer la disponibilité pour extraire le photographeId
      const dispo = updatedDisponibilites.find(d => d.id === disponibiliteId);
      if (!dispo) {
        return;
      }

      // Appel API en arrière-plan
      const res = await fetch('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: disponibiliteId,
          statut: newStatus,
          courseId: dispo.courseId,
          photographeId: dispo.photographeId,
          dateModification: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        // En cas d'erreur, recharger les données
        fetchData();
      }
    } catch (error) {
      fetchData();
    }
  };

  const handleTarifChange = async (
    disponibiliteId: string,
    newTarifId: string,
    courseId: string
  ) => {
    // Les photographes ne peuvent pas changer les tarifs
    return;
  };

  // Filtrer uniquement les courses non archivées (pas de filtre statut pour le photographe)
  const filteredCourses = courses.filter((course) => {
    // Exclure les courses archivées
    return course.archived !== 'oui';
  });

  // Regrouper les courses par année et mois
  const coursesByMonth = filteredCourses.reduce((acc, course) => {
    const date = new Date(course.dateDebut);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;

    if (!acc[key]) {
      acc[key] = {
        year,
        month,
        courses: [],
        total: {
          photographesValides: 0,
          photographesDisponibles: 0,
          coutTotal: 0,
        }
      };
    }

    acc[key].courses.push(course);
    acc[key].total.photographesValides += course.photographesValides;
    acc[key].total.photographesDisponibles += course.photographesDisponibles;
    acc[key].total.coutTotal += course.coutTotal;

    return acc;
  }, {} as Record<string, {
    year: number;
    month: number;
    courses: CourseWithData[];
    total: {
      photographesValides: number;
      photographesDisponibles: number;
      coutTotal: number;
    }
  }>);

  // Trier par année et mois (ordre chronologique inverse)
  const sortedMonths = Object.values(coursesByMonth).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleResetZoom = () => setZoom(90);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement du planning...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col space-y-1.5">
      {/* En-tête */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Planning des courses</h1>
          <p className="text-xs text-muted-foreground">
            Consultez le planning et gérez vos disponibilités
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link href="/photographer/planning/stats">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Statistiques</span>
              <span className="sm:hidden">Stats</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Cartes récapitulatives compactes */}
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2 flex-shrink-0">
          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  <span className="md:hidden">Courses</span>
                  <span className="hidden md:inline">Courses du mois</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3">
                    <p className="font-medium mb-2">Détail des courses :</p>
                    {stats.coursesDetails.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {stats.coursesDetails.slice(0, 5).map((course, idx) => (
                          <li key={idx}>• {course.nom} ({course.ville}) - {course.validated} photographe{course.validated > 1 ? 's' : ''}</li>
                        ))}
                        {stats.coursesDetails.length > 5 && (
                          <li className="text-muted-foreground">... et {stats.coursesDetails.length - 5} autre{stats.coursesDetails.length - 5 > 1 ? 's' : ''}</li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-xs">Aucune course pour le moment</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{stats.totalCourses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  <span className="md:hidden">Photos</span>
                  <span className="hidden md:inline">Photographes</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3">
                    <p className="font-medium mb-2">Photographes actifs avec prestations :</p>
                    {stats.photographersDetails.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {stats.photographersDetails.slice(0, 5).map((photo, idx) => (
                          <li key={idx}>• {photo.prenom} {photo.nom} - {photo.prestations} prestation{photo.prestations > 1 ? 's' : ''}</li>
                        ))}
                        {stats.photographersDetails.length > 5 && (
                          <li className="text-muted-foreground">... et {stats.photographersDetails.length - 5} autre{stats.photographersDetails.length - 5 > 1 ? 's' : ''}</li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-xs">Aucun photographe validé pour le moment</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Total actifs : {stats.totalPhotographers}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{stats.totalPhotographers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  <span className="md:hidden">Presta.</span>
                  <span className="hidden md:inline">Prestations</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3">
                    <p className="font-medium mb-2">Détail des prestations :</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Photographes validés : {stats.prestationsDetails.validated}</li>
                      <li>• Chefs d'équipe : {stats.prestationsDetails.teamLeaders}</li>
                      <li className="font-medium mt-2">Total : {stats.totalPrestations}</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{stats.totalPrestations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-2 py-2 md:px-3 md:py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground">
                  <span className="hidden sm:inline">Coût total</span>
                  <span className="sm:hidden">Coût</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3 md:h-4 md:w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-3">
                    <p className="font-medium mb-2">Détail des coûts :</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Tarifs photographes : {formatCurrency(stats.coutDetails.tarifBase)}</li>
                      <li>• Bonus chefs d'équipe : {formatCurrency(stats.coutDetails.bonus)}</li>
                      <li className="font-medium mt-2">Total : {formatCurrency(stats.coutTotal)}</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-base sm:text-lg md:text-xl font-bold">{formatCurrency(stats.coutTotal)}</div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
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

      {/* Tableau type Excel - VUE PHOTOGRAPHE (seulement sa colonne) */}
      <div className="flex-1 rounded-lg border shadow-lg bg-white dark:bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full" style={{ position: 'relative', zoom: `${zoom}%` }}>
          {/* En-tête du tableau */}
          <div className="sticky top-0 z-20" style={{ position: 'sticky' }}>
            <div
              className="grid gap-0 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 border-b-2 border-green-600/30"
              style={{
                gridTemplateColumns: `200px 120px 1fr`,
                minWidth: '100%'
              }}
            >
              {/* Colonne Course - STICKY */}
              <div
                className="sticky left-0 z-30 p-2 pr-1.5 border-r-2 border-green-600/40 font-semibold text-sm bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900"
                style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Course
              </div>

              {/* Colonne Date - STICKY */}
              <div
                className="sticky z-30 p-2 pr-1.5 border-r-2 border-green-600/40 font-semibold text-sm bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900"
                style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Date
              </div>

              {/* Colonne Mon Statut */}
              <div className="p-2 text-center font-semibold text-sm">
                Mon statut
              </div>
            </div>
          </div>

          {/* Lignes du tableau - Groupées par mois */}
          <div>
            {sortedMonths.map((monthData) => {
              const monthKey = `${monthData.year}-${monthData.month}`;

              // Calculer le nombre de prestations validées pour le photographe ce mois
              const myValidatedCount = currentUser ? monthData.courses.reduce((count, course) => {
                const dispo = course.disponibilites.find(d => d.photographeId === currentUser.id);
                if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                  return count + 1;
                }
                return count;
              }, 0) : 0;

              return (
                <div key={monthKey}>
                  {/* Ligne de titre du mois avec totaux */}
                  <div
                    className="grid gap-0 bg-orange-100 dark:bg-orange-900 border-b-2 border-orange-300 dark:border-orange-700 font-semibold"
                    style={{
                      gridTemplateColumns: `200px 120px 1fr`,
                      minWidth: '100%'
                    }}
                  >
                    <div className="sticky left-0 z-10 p-3 border-r-2 border-orange-300 dark:border-orange-700 bg-orange-100 dark:bg-orange-900">
                      <div className="text-sm font-bold">
                        {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                      </div>
                    </div>
                    <div className="sticky z-10 p-3 border-r-2 border-orange-300 dark:border-orange-700 bg-orange-100 dark:bg-orange-900" style={{ left: '200px' }}>
                      <div className="text-xs">{monthData.courses.length} course{monthData.courses.length > 1 ? 's' : ''}</div>
                    </div>
                    <div className="p-3 flex items-center justify-center text-xs font-semibold">
                      {myValidatedCount > 0 ? `${myValidatedCount} validée${myValidatedCount > 1 ? 's' : ''}` : '-'}
                    </div>
                  </div>

                  {/* Courses du mois */}
                  {monthData.courses.map((course, courseIdx) => {
              const bgColor = courseIdx % 2 === 0
                ? "bg-green-50 dark:bg-green-950"
                : "bg-emerald-50 dark:bg-emerald-950";

              // Récupérer la disponibilité du photographe connecté uniquement
              const myDispo = currentUser ? course.disponibilites.find((d) => d.photographeId === currentUser.id) : undefined;
              const hasMultipleTarifs = course.tarifs && course.tarifs.length > 1;

              // Déterminer le style selon le statut
              const isValidated = myDispo && (myDispo.statut === 'validated' || myDispo.statut === 'teamLeader');
              const isRejected = myDispo && myDispo.statut === 'rejected';

              // Override bgColor pour les validées
              const rowBgColor = isValidated
                ? (myDispo.statut === 'teamLeader' ? 'bg-purple-50 dark:bg-purple-950/30' : 'bg-green-100 dark:bg-green-900/40')
                : bgColor;

              return (
                <div
                  key={course.id}
                  className={cn(
                    "grid gap-0 border-b transition-all duration-200",
                    rowBgColor,
                    isValidated && "border-l-4 border-l-green-600 dark:border-l-green-500 hover:bg-green-200 dark:hover:bg-green-800/50 shadow-sm",
                    myDispo?.statut === 'teamLeader' && "border-l-4 border-l-purple-600 dark:border-l-purple-500 hover:bg-purple-200 dark:hover:bg-purple-800/50",
                    isRejected && "opacity-40 hover:opacity-60 border-green-200/50",
                    !isValidated && !isRejected && "border-green-200/50 hover:bg-green-100 dark:hover:bg-green-900/30"
                  )}
                  style={{
                    gridTemplateColumns: `200px 120px 1fr`,
                    minWidth: '100%'
                  }}
                >
                  {/* Colonne infos course - STICKY */}
                  <div
                    className={cn(
                      "sticky left-0 z-10 p-2 pr-1.5 border-r-2 border-green-600/40",
                      rowBgColor
                    )}
                    style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                  >
                    {/* Ligne 1: Titre + Statut */}
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 flex-1">
                        {isValidated && (
                          <span className="text-sm">
                            {myDispo?.statut === 'teamLeader' ? '👑' : '✓'}
                          </span>
                        )}
                        <Link
                          href={`/photographer/planning/${course.id}`}
                          className={cn(
                            "font-semibold hover:underline text-xs hover:text-primary transition-colors",
                            isValidated && "text-green-800 dark:text-green-200",
                            myDispo?.statut === 'teamLeader' && "text-purple-800 dark:text-purple-200"
                          )}
                        >
                          {course.nom}
                        </Link>
                        {course.statutTraitement === 'done' ? (
                          <span className="text-[10px]">🟢</span>
                        ) : (
                          <span className="text-[10px]">🟠</span>
                        )}
                      </div>
                    </div>

                    {/* Ligne 2: Localisation + Coureurs */}
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground mb-0.5">
                      <div className="flex items-center gap-0.5">
                        📍 {course.localisation}
                      </div>
                      {course.coureursAttendus && (
                        <div className="text-[9px] text-muted-foreground/60">
                          👥 {course.coureursAttendus.toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Ligne 3: Prix */}
                    <div className="flex items-center gap-1.5">
                      {isValidated && course.tarif ? (
                        <span className={cn(
                          "text-xs font-bold",
                          myDispo?.statut === 'teamLeader' ? "text-purple-700 dark:text-purple-300" : "text-green-700 dark:text-green-300"
                        )}>
                          💰 {myDispo?.statut === 'teamLeader'
                            ? course.tarif.tarifPhotographe + course.tarif.bonusChefEquipe
                            : course.tarif.tarifPhotographe}€
                          {myDispo?.statut === 'teamLeader' && (
                            <span className="text-[9px] ml-1">(+{course.tarif.bonusChefEquipe}€ chef)</span>
                          )}
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            💰 {course.tarif ? course.tarif.tarifPhotographe : 0}€
                          </span>
                          {myDispo?.statut === 'teamLeader' && course.tarif && (
                            <span className="text-[9px] text-purple-600 font-semibold">
                              +{course.tarif.bonusChefEquipe}€ chef
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Colonne Date - STICKY */}
                  <div
                    className={cn(
                      "sticky z-10 p-2 pr-1.5 flex flex-col justify-start items-start gap-0.5 border-r-2 border-green-600/40",
                      rowBgColor
                    )}
                    style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                  >
                    <div className="text-xs font-semibold text-gray-700">
                      {format(new Date(course.dateDebut), "dd/MM/yy", { locale: fr })}
                    </div>
                    {course.dateFin && course.dateFin !== course.dateDebut && (
                      <div className="text-[10px] text-muted-foreground">
                        au {format(new Date(course.dateFin), "dd/MM/yy", { locale: fr })}
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
                          disabled={myDispo.statut === 'validated' || myDispo.statut === 'teamLeader' || myDispo.statut === 'rejected'}
                        >
                          <SelectTrigger className={`h-8 text-xs w-full border transition-all focus:border-green-600 px-2 font-medium ${getStatusColorClass(myDispo.statut)}`}>
                            <SelectValue>
                              {getStatusLabel(myDispo.statut)}
                            </SelectValue>
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

                        {/* Affichage du tarif si plusieurs tarifs et un tarif est assigné */}
                        {hasMultipleTarifs && myDispo.tarifId && (
                          <div className="text-[9px] w-full text-center text-gray-600 mt-1">
                            {course.tarifs?.find(t => t.id === myDispo.tarifId)?.description || 'Tarif personnalisé'}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">-</div>
                    )}
                  </div>
                </div>
              );
            })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
