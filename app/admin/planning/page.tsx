'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ZoomIn, ZoomOut, Calendar, Users, Briefcase, Euro, Filter, ArrowUpDown, Info, Archive } from 'lucide-react';
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
  nonRemunere?: boolean | string;
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

export default function AdminPlanningPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseWithData[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);

  // Filtres
  const [statutFilter, setStatutFilter] = useState<string>('all');
  const [zoom, setZoom] = useState(90);

  // Dialogs d'archivage
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showArchiveSuccessDialog, setShowArchiveSuccessDialog] = useState(false);
  const [courseToArchive, setCourseToArchive] = useState<CourseWithData | null>(null);

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
        // API disponibilités non disponible, création des disponibilités par défaut
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

      // Archiver les courses passées en parallèle
      if (coursesToArchive.length > 0) {
        await Promise.all(
          coursesToArchive.map((course: Course) =>
            fetch(`/api/courses/${course.id}/archive`, {
              method: 'POST',
            }).catch(() => {
              // Erreur archivage automatique ignorée
            })
          )
        );

        // Marquer les courses comme archivées dans la liste locale
        coursesToArchive.forEach((courseToArchive: Course) => {
          const course = allCourses.find((c: Course) => c.id === courseToArchive.id);
          if (course) {
            course.archived = 'oui';
            course.archivedAt = new Date().toISOString();
          }
        });
      }

      // Combiner admins et photographes (admins en premier)
      const allUsers = [...allAdmins, ...allPhotographers];

      // Créer des disponibilités par défaut pour tous les utilisateurs qui n'en ont pas
      let finalDisponibilites: Disponibilite[] = [...allDisponibilites];

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
        const courseTarifs = allTarifs.filter((t: Tarif) => t.courseId === course.id);
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
            // Vérifier si c'est un admin non rémunéré
            const user = allAdmins.find((a: Admin) => a.id === d.photographeId);
            const isNonRemunere = user && (user.nonRemunere === 'TRUE' || user.nonRemunere === true);

            // Ne pas compter les admins non rémunérés
            if (isNonRemunere) return;

            const tarifDispo = d.tarifId
              ? allTarifs.find((t: Tarif) => t.id === d.tarifId)
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
      const activeCourses = coursesWithData.filter((c: CourseWithData) => c.archived !== 'oui');

      // Calculer les stats globales avec détails (uniquement sur les courses actives)
      const totalPrestations = activeCourses.reduce(
        (sum: number, c: CourseWithData) => sum + c.photographesValides,
        0
      );
      const coutTotal = activeCourses.reduce((sum: number, c: CourseWithData) => sum + c.coutTotal, 0);

      // Détails des courses (uniquement actives)
      const coursesDetails = activeCourses.map((c: CourseWithData) => ({
        nom: c.nom,
        ville: c.ville,
        validated: c.photographesValides,
      }));

      // Obtenir les IDs des courses actives
      const activeCourseIds = new Set(activeCourses.map((c: CourseWithData) => c.id));

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
      activeCourses.forEach((course: CourseWithData) => {
        course.disponibilites.forEach((d: Disponibilite) => {
          if (d.statut === 'validated' || d.statut === 'teamLeader') {
            // Vérifier si c'est un admin non rémunéré
            const user = allAdmins.find((a: Admin) => a.id === d.photographeId);
            const isNonRemunere = user && (user.nonRemunere === 'TRUE' || user.nonRemunere === true);

            // Ne pas compter les admins non rémunérés
            if (isNonRemunere) return;

            // Utiliser le tarif assigné au photographe, ou le tarif par défaut de la course
            const tarifDispo = d.tarifId
              ? allTarifs.find((t: Tarif) => t.id === d.tarifId)
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
      // Erreur chargement données
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
    courseId: string
  ) => {
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
            // Vérifier si c'est un admin non rémunéré
            const user = admins.find((a) => a.id === d.photographeId);
            const isNonRemunere = user && (user.nonRemunere === 'TRUE' || user.nonRemunere === true);

            // Ne pas compter les admins non rémunérés
            if (isNonRemunere) return;

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
            // Vérifier si c'est un admin non rémunéré
            const user = admins.find((a) => a.id === d.photographeId);
            const isNonRemunere = user && (user.nonRemunere === 'TRUE' || user.nonRemunere === true);

            // Ne pas compter les admins non rémunérés
            if (isNonRemunere) return;

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
        // Disponibilité non trouvée
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
        // Erreur API, rollback
        fetchData();
      }
    } catch (error) {
      // Erreur mise à jour statut
      fetchData();
    }
  };

  const handleTarifChange = async (
    disponibiliteId: string,
    newTarifId: string,
    courseId: string
  ) => {
    try {
      // Mise à jour optimiste
      const updatedDisponibilites = disponibilites.map((d) =>
        d.id === disponibiliteId
          ? { ...d, tarifId: newTarifId }
          : d
      );
      setDisponibilites(updatedDisponibilites);

      // Recalculer les courses avec nouveaux tarifs
      const coursesWithData = courses.map((course) => {
        const dispos = updatedDisponibilites.filter((d) => d.courseId === course.id);

        // Recalculer le coût total avec les tarifs assignés
        let coutTotal = 0;
        dispos.forEach((d: Disponibilite) => {
          if (d.statut === 'validated' || d.statut === 'teamLeader') {
            // Vérifier si c'est un admin non rémunéré
            const user = admins.find((a) => a.id === d.photographeId);
            const isNonRemunere = user && (user.nonRemunere === 'TRUE' || user.nonRemunere === true);

            // Ne pas compter les admins non rémunérés
            if (isNonRemunere) return;

            const tarifDispo = d.tarifId
              ? tarifs.find((t) => t.id === d.tarifId)
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
          coutTotal,
        };
      });

      setCourses(coursesWithData);

      // Récupérer la disponibilité pour extraire le photographeId
      const dispo = updatedDisponibilites.find(d => d.id === disponibiliteId);
      if (!dispo) return;

      // Appel API
      const res = await fetch('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: disponibiliteId,
          statut: dispo.statut,
          tarifId: newTarifId,
          courseId: dispo.courseId,
          photographeId: dispo.photographeId,
        }),
      });

      if (!res.ok) {
        // Erreur API, rollback
        fetchData();
      }
    } catch (error) {
      // Erreur mise à jour tarif
      fetchData();
    }
  };

  const handleArchiveCourse = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    setCourseToArchive(course);
    setShowArchiveDialog(true);
  };

  const confirmArchive = async () => {
    if (!courseToArchive) return;

    setShowArchiveDialog(false);

    try {
      // Mise à jour optimiste - marquer la course comme archivée immédiatement
      const updatedCourses = courses.map((c) =>
        c.id === courseToArchive.id
          ? { ...c, archived: 'oui', archivedAt: new Date().toISOString() }
          : c
      );
      setCourses(updatedCourses);

      // Recalculer les stats sans la course archivée
      const activeCourses = updatedCourses.filter((c) => c.archived !== 'oui');

      const totalPrestations = activeCourses.reduce((sum, c) => sum + c.photographesValides, 0);
      const coutTotal = activeCourses.reduce((sum, c) => sum + c.coutTotal, 0);

      setStats({
        ...stats,
        totalCourses: activeCourses.length,
        totalPrestations,
        coutTotal,
      });

      // Envoyer la requête d'archivage
      const res = await fetch(`/api/courses/${courseToArchive.id}/archive`, {
        method: 'POST',
      });

      if (res.ok) {
        // Succès - montrer le dialog de succès
        setShowArchiveSuccessDialog(true);
      } else {
        // En cas d'erreur, restaurer l'état précédent
        setCourses(courses);
        // Recharger pour être sûr
        fetchData();
      }
    } catch (error) {
      // Erreur archivage course
      setCourses(courses);
      fetchData();
    } finally {
      setCourseToArchive(null);
    }
  };

  // Filtrage par statut uniquement
  const filteredCourses = courses.filter((course) => {
    // Exclure les courses archivées
    if (course.archived === 'oui') return false;

    // Filtre par statut
    if (statutFilter === 'all') return true;
    return course.statutTraitement === statutFilter;
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

  // Trier les courses de chaque mois par date (plus proche en premier)
  Object.values(coursesByMonth).forEach(monthData => {
    monthData.courses.sort((a, b) =>
      new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime()
    );
  });

  // Trier par année et mois (ordre chronologique : plus proche en premier)
  const sortedMonths = Object.values(coursesByMonth).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  // Fonction pour déterminer le week-end auquel appartient une date
  // Un week-end va de jeudi à lundi
  const getWeekendKey = (dateString: string) => {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi

    // Clone de la date pour manipulation
    const weekendStart = new Date(date);

    // Déterminer le jeudi de référence pour ce week-end
    if (dayOfWeek === 0) {
      // Dimanche -> le jeudi était 3 jours avant
      weekendStart.setDate(date.getDate() - 3);
    } else if (dayOfWeek === 1) {
      // Lundi -> le jeudi était 4 jours avant
      weekendStart.setDate(date.getDate() - 4);
    } else if (dayOfWeek === 2) {
      // Mardi -> appartient au prochain week-end (jeudi dans 2 jours)
      weekendStart.setDate(date.getDate() + 2);
    } else if (dayOfWeek === 3) {
      // Mercredi -> appartient au prochain week-end (jeudi demain)
      weekendStart.setDate(date.getDate() + 1);
    } else {
      // Jeudi (4), Vendredi (5), Samedi (6) -> chercher le jeudi de cette semaine
      const daysFromThursday = dayOfWeek - 4;
      weekendStart.setDate(date.getDate() - daysFromThursday);
    }

    // Retourner une clé unique basée sur le jeudi du week-end
    return `${weekendStart.getFullYear()}-${weekendStart.getMonth()}-${weekendStart.getDate()}`;
  };

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
    <div className="h-full overflow-hidden flex flex-col space-y-1.5 -mx-3 -my-4 md:-mx-6 md:-my-8 px-3 py-4 md:px-6 md:py-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Planning des courses</h1>
          <p className="text-xs text-muted-foreground">
            Gérez les affectations des photographes sur les courses
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link href="/admin/planning/stats">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Statistiques</span>
              <span className="sm:hidden">Stats</span>
            </Link>
          </Button>
          <Button size="sm" asChild className="w-full sm:w-auto">
            <Link href="/admin/planning/new">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Nouvelle course</span>
              <span className="sm:hidden">Nouvelle</span>
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
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

      {/* Tableau type Excel - NOUVELLE STRUCTURE */}
      <div className="flex-1 rounded-lg border shadow-lg bg-white dark:bg-gray-950 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full" style={{ position: 'relative', zoom: `${zoom}%` }}>
          {/* En-tête du tableau */}
          <div className="sticky top-0 z-40" style={{ position: 'sticky' }}>
            <div
              className="grid gap-0 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 border-b-2 border-green-600/30"
              style={{
                gridTemplateColumns: `200px 120px repeat(${[...admins, ...photographers].filter((u) => u.actif).length}, 70px)`,
                minWidth: 'max-content'
              }}
            >
              {/* Colonne Course - STICKY */}
              <div
                className="sticky left-0 z-50 p-2 pr-1.5 border-r-2 border-green-600/40 font-semibold text-sm bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900"
                style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Course
              </div>

              {/* Colonne Date - STICKY */}
              <div
                className="sticky z-50 p-2 pr-1.5 border-r-2 border-green-600/40 font-semibold text-sm bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900"
                style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Date
              </div>
              {/* Colonnes Admins */}
              {admins.filter((a) => a.actif).map(admin => (
                <div key={admin.id} className="p-2 text-center">
                  <Link
                    href={`/admin/admins/${admin.id}/profile`}
                    className="hover:text-green-700 hover:underline transition-colors font-bold text-xs flex flex-col items-center"
                    title={`${admin.prenom} ${admin.nom}`}
                  >
                    <div className="truncate w-full">{admin.prenom}</div>
                    <div className="text-[9px] truncate w-full">{admin.nom}</div>
                  </Link>
                </div>
              ))}

              {/* Colonnes Photographes */}
              {photographers.filter((p) => p.actif).map(photographer => (
                <div key={photographer.id} className="p-2 text-center">
                  <Link
                    href={`/admin/photographers/${photographer.id}/profile`}
                    className="hover:text-green-700 hover:underline transition-colors text-xs flex flex-col items-center"
                    title={`${photographer.prenom} ${photographer.nom}`}
                  >
                    <div className="truncate w-full">{photographer.prenom}</div>
                    <div className="text-[9px] truncate w-full">{photographer.nom}</div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Lignes du tableau - Groupées par mois */}
          <div>
            {sortedMonths.map((monthData) => {
              const monthKey = `${monthData.year}-${monthData.month}`;
              return (
                <div key={monthKey}>
                  {/* Ligne de titre du mois avec totaux */}
                  <div
                    className="grid gap-0 bg-orange-100 dark:bg-orange-900 border-b-2 border-orange-300 dark:border-orange-700 font-semibold"
                    style={{
                      gridTemplateColumns: `200px 120px repeat(${[...admins, ...photographers].filter((u) => u.actif).length}, 70px)`,
                      minWidth: 'max-content'
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
                    {[...admins, ...photographers].filter((u) => u.actif).map(user => {
                      // Calculer le nombre de fois où ce photographe est validé ou chef dans ce mois
                      const userCount = monthData.courses.reduce((count, course) => {
                        const dispo = course.disponibilites.find(d => d.photographeId === user.id);
                        if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                          return count + 1;
                        }
                        return count;
                      }, 0);

                      return (
                        <div key={user.id} className="p-3 flex items-center justify-center text-xs font-semibold">
                          {userCount > 0 ? userCount : '-'}
                        </div>
                      );
                    })}
                  </div>

                  {/* Courses du mois */}
                  {monthData.courses.map((course, courseIdx) => {
                    const validatedCount = course.photographesValides;
                    const availableCount = course.photographesDisponibles;
                    const bgColor = courseIdx % 2 === 0
                      ? "bg-green-50 dark:bg-green-950"
                      : "bg-emerald-50 dark:bg-emerald-950";

                    // Vérifier si c'est le début d'un nouveau week-end
                    const currentWeekend = getWeekendKey(course.dateDebut);
                    const previousWeekend = courseIdx > 0
                      ? getWeekendKey(monthData.courses[courseIdx - 1].dateDebut)
                      : null;
                    const isNewWeekend = previousWeekend && currentWeekend !== previousWeekend;

                    return (
                      <div
                        key={course.id}
                        className={cn(
                          "grid gap-0 border-b border-green-200/50 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors",
                          bgColor,
                          isNewWeekend && "border-t-2 border-t-blue-300/60 dark:border-t-blue-600/60"
                        )}
                        style={{
                          gridTemplateColumns: `200px 120px repeat(${[...admins, ...photographers].filter((u) => u.actif).length}, 70px)`,
                          minWidth: 'max-content'
                        }}
                      >
                        {/* Colonne infos course - STICKY */}
                        <div
                          className={cn(
                            "sticky left-0 z-10 p-2 pr-1.5 border-r-2 border-green-600/40",
                            bgColor
                          )}
                          style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                        >
                          {/* Ligne 1: Titre + Statut */}
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                              <div className="flex items-center gap-1.5 flex-1">
                                <Link
                                  href={`/admin/planning/${course.id}`}
                                  className="font-semibold hover:underline text-xs hover:text-primary transition-colors"
                                >
                                  {course.nom}
                                </Link>
                                {course.statutTraitement === 'done' ? (
                                  <span className="text-[10px]">🟢</span>
                                ) : (
                                  <span className="text-[10px]">🟠</span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArchiveCourse(course.id)}
                                className="text-[10px] h-4 px-1 text-muted-foreground/50 hover:text-orange-600 hover:bg-orange-50"
                                title="Archiver la course"
                              >
                                <Archive className="h-2.5 w-2.5" />
                              </Button>
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
                              
                            {/* Ligne 3: Stats + Prix */}
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                                {validatedCount}
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {validatedCount}-{availableCount}
                              </span>
                              <span className="text-[10px] font-medium text-muted-foreground">
                                💰 {course.tarif ? course.tarif.tarifPhotographe : 0}€
                              </span>
                            </div>
                          </div>

                          {/* Colonne Date - STICKY */}
                          <div
                            className={cn(
                              "sticky z-10 p-2 pr-1.5 flex flex-col justify-start items-start gap-0.5 border-r-2 border-green-600/40",
                              bgColor
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

                          {/* Colonnes admins */}
                          {admins.filter((a) => a.actif).map(admin => {
                            const dispo = course.disponibilites.find((d) => d.photographeId === admin.id);
                            if (!dispo) return <div key={admin.id} className="flex items-center justify-center p-2">-</div>;

                            const hasMultipleTarifs = course.tarifs && course.tarifs.length > 1;

                            return (
                              <div key={admin.id} className="p-2 flex flex-col items-start justify-start gap-0.5">
                                <Select
                                  value={dispo.statut}
                                  onValueChange={(value) => handleStatusChange(dispo.id, value, course.id)}
                                >
                                  <SelectTrigger className={`h-7 text-[9px] w-full border transition-all focus:border-green-600 px-0.5 font-medium ${getStatusColorClass(dispo.statut)}`}>
                                    <SelectValue>
                                      {getStatusLabel(dispo.statut)}
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
                                    <SelectItem value="validated">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                        <span className="text-xs">Validé</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="teamLeader">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                                        <span className="text-xs">Chef</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="rejected">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-red-500" />
                                        <span className="text-xs">Refusé</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                {/* Select tarif - seulement si plusieurs tarifs disponibles */}
                                {hasMultipleTarifs && (
                                  <Select
                                    value={dispo.tarifId || ''}
                                    onValueChange={(value) => handleTarifChange(dispo.id, value, course.id)}
                                  >
                                    <SelectTrigger className="h-6 text-[8px] w-full border border-gray-300 bg-white hover:bg-gray-50 px-0.5">
                                      <SelectValue placeholder="Tarif">
                                        {dispo.tarifId
                                          ? course.tarifs?.find(t => t.id === dispo.tarifId)?.description || 'Tarif'
                                          : 'Choisir tarif'}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {course.tarifs?.map(tarif => (
                                        <SelectItem key={tarif.id} value={tarif.id}>
                                          <div className="flex flex-col text-[10px]">
                                            <span className="font-medium">{tarif.description || 'Sans nom'}</span>
                                            <span className="text-[9px] text-muted-foreground">
                                              {tarif.tarifPhotographe}€ {tarif.nombreJours ? `(${tarif.nombreJours}j)` : ''}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            );
                          })}

                          {/* Colonnes photographes */}
                          {photographers.filter((p) => p.actif).map(photographer => {
                            const dispo = course.disponibilites.find((d) => d.photographeId === photographer.id);
                            if (!dispo) return <div key={photographer.id} className="flex items-center justify-center p-2">-</div>;

                            const hasMultipleTarifs = course.tarifs && course.tarifs.length > 1;

                            return (
                              <div key={photographer.id} className="p-2 flex flex-col items-start justify-start gap-0.5">
                                <Select
                                  value={dispo.statut}
                                  onValueChange={(value) => handleStatusChange(dispo.id, value, course.id)}
                                >
                                  <SelectTrigger className={`h-7 text-[9px] w-full border transition-all focus:border-green-600 px-0.5 font-medium ${getStatusColorClass(dispo.statut)}`}>
                                    <SelectValue>
                                      {getStatusLabel(dispo.statut)}
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
                                    <SelectItem value="validated">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                        <span className="text-xs">Validé</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="teamLeader">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                                        <span className="text-xs">Chef</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="rejected">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-red-500" />
                                        <span className="text-xs">Refusé</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                {/* Select tarif - seulement si plusieurs tarifs disponibles */}
                                {hasMultipleTarifs && (
                                  <Select
                                    value={dispo.tarifId || ''}
                                    onValueChange={(value) => handleTarifChange(dispo.id, value, course.id)}
                                  >
                                    <SelectTrigger className="h-6 text-[8px] w-full border border-gray-300 bg-white hover:bg-gray-50 px-0.5">
                                      <SelectValue placeholder="Tarif">
                                        {dispo.tarifId
                                          ? course.tarifs?.find(t => t.id === dispo.tarifId)?.description || 'Tarif'
                                          : 'Choisir tarif'}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {course.tarifs?.map(tarif => (
                                        <SelectItem key={tarif.id} value={tarif.id}>
                                          <div className="flex flex-col text-[10px]">
                                            <span className="font-medium">{tarif.description || 'Sans nom'}</span>
                                            <span className="text-[9px] text-muted-foreground">
                                              {tarif.tarifPhotographe}€ {tarif.nombreJours ? `(${tarif.nombreJours}j)` : ''}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>
        </div>
      </div>


      {/* Dialog de confirmation d'archivage */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-orange-600" />
              Archiver la course
            </DialogTitle>
            <DialogDescription className="pt-2">
              Êtes-vous sûr de vouloir archiver la course{' '}
              <span className="font-semibold text-foreground">{courseToArchive?.nom}</span> ?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Cette course sera retirée du planning principal et déplacée dans la section Archives. Vous pourrez la désarchiver à tout moment.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowArchiveDialog(false);
                setCourseToArchive(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={confirmArchive} className="bg-orange-600 hover:bg-orange-700">
              Archiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de succès d'archivage */}
      <Dialog open={showArchiveSuccessDialog} onOpenChange={setShowArchiveSuccessDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              Course archivée avec succès
            </DialogTitle>
            <DialogDescription className="pt-2">
              La course a été déplacée dans les archives.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Voulez-vous consulter les archives maintenant ?
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowArchiveSuccessDialog(false)}
            >
              Rester ici
            </Button>
            <Button
              onClick={() => {
                setShowArchiveSuccessDialog(false);
                router.push('/admin/archives');
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Voir les archives
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
