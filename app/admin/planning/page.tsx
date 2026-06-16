'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ZoomIn, ZoomOut, Calendar, Users, Briefcase, Euro, Filter, ArrowUpDown, Info, Archive, List, LayoutGrid } from 'lucide-react';
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
import { toast } from 'sonner';

interface Course {
  id: string;
  nom: string;
  localisation: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  statutTraitement: 'inProgress' | 'done';
  coureursAttendus?: number;
  numberAttended?: number;
  visible: boolean;
  archived?: string;
  archivedAt?: string;
  archivedBy?: string;
  hotelValid?: string | boolean;
  transportValid?: string | boolean;
  twoPrices?: string | boolean;
}

interface Photographer {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
  region?: string;
}

interface Admin {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
  rem?: boolean | string;
}

interface Tarif {
  id: string;
  courseId: string;
  tarifPhotographe: number;
  bonusChefEquipe: number;
  description?: string;
  nombreJours?: string;
  firstTarifName?: string;
  secondTarifName?: string;
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
    validated: 'bg-green-100 border-green-300 text-green-900 hover:bg-green-200',
    teamLeader: 'bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200',
    rejected: 'bg-red-100 border-red-300 text-red-900 hover:bg-red-200',
  };
  return colors[status] || 'bg-white border-gray-300';
};

// Fonction pour obtenir la couleur de fond de la région (tons sobres)
const getRegionBackgroundColor = (region?: string): string => {
  const regionColors: Record<string, string> = {
    'Ile-de-France': 'bg-gray-50',
    'Zone Lyon': 'bg-blue-50',
    'Zone Centre': 'bg-amber-50',
    'Sud-Est': 'bg-emerald-50',
    'Sud-Ouest': 'bg-purple-50',
    'Nord': 'bg-rose-50',
  };
  return regionColors[region || ''] || 'bg-white';
};

// Ordre des régions
const REGION_ORDER = [
  'Ile-de-France',
  'Sud-Est',
  'Sud-Ouest',
  'Nord',
  'Zone Lyon',
  'Zone Centre',
];

// Fonction de tri des photographes par région puis alphabétiquement
const sortPhotographersByRegion = (photographers: Photographer[]) => {
  return [...photographers].sort((a, b) => {
    const regionA = a.region || '';
    const regionB = b.region || '';

    // Trouver les indices dans l'ordre des régions
    const indexA = REGION_ORDER.indexOf(regionA);
    const indexB = REGION_ORDER.indexOf(regionB);

    // Si les deux ont une région connue, trier par ordre de région
    if (indexA !== -1 && indexB !== -1) {
      if (indexA !== indexB) {
        return indexA - indexB;
      }
    } else if (indexA !== -1) {
      // A a une région connue, B non -> A avant B
      return -1;
    } else if (indexB !== -1) {
      // B a une région connue, A non -> B avant A
      return 1;
    }

    // Si même région (ou pas de région), trier alphabétiquement
    const nameA = `${a.prenom} ${a.nom}`.toLowerCase();
    const nameB = `${b.prenom} ${b.nom}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

// Fonction pour regrouper les photographes par région
const groupPhotographersByRegion = (photographers: Photographer[]) => {
  const groups: Array<{ region: string; photographers: Photographer[] }> = [];

  photographers.forEach(photographer => {
    const region = photographer.region || 'Sans région';
    let group = groups.find(g => g.region === region);

    if (!group) {
      group = { region, photographers: [] };
      groups.push(group);
    }

    group.photographers.push(photographer);
  });

  // Trier les groupes selon l'ordre des régions
  return groups.sort((a, b) => {
    const indexA = REGION_ORDER.indexOf(a.region);
    const indexB = REGION_ORDER.indexOf(b.region);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return 0;
  });
};

export default function AdminCalendrierPage() {
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Mode d'affichage responsive

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

      // Trier les photographes par région puis alphabétiquement
      const sortedPhotographers = sortPhotographersByRegion(allPhotographers);

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

      // Combiner admins et photographes (admins en premier, photographes triés)
      const allUsers = [...allAdmins, ...sortedPhotographers];

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
      setPhotographers(sortedPhotographers);
      setAdmins(allAdmins);

      // Calculer les données enrichies pour chaque course
      const coursesWithData = allCourses.map((course: Course) => {
        const courseTarifs = allTarifs.filter((t: Tarif) => t.courseId === course.id);
        if (courseTarifs.length > 1) {
          console.log(`[fetchData] Course ${course.nom} a ${courseTarifs.length} tarifs`);
        }
        const tarif = courseTarifs[0]; // Premier tarif par défaut pour affichage
        const dispos = finalDisponibilites.filter((d: Disponibilite) => d.courseId === course.id);

        const photographesValides = dispos.filter((d: Disponibilite) => {
          if (d.statut !== 'validated' && d.statut !== 'teamLeader') return false;

          // Exclure les admins non rémunérés
          const user = allAdmins.find((a: Admin) => a.id === d.photographeId);
          const isNonRemunere = user && (user.rem === 'non' || user.rem === 'non');

          return !isNonRemunere;
        }).length;

        const photographesDisponibles = dispos.filter(
          (d: Disponibilite) => d.statut === 'available' || d.statut === 'validated' || d.statut === 'teamLeader'
        ).length;

        // Calcul du coût total basé sur les tarifs assignés
        let coutTotal = 0;
        dispos.forEach((d: Disponibilite) => {
          if (d.statut === 'validated' || d.statut === 'teamLeader') {
            // Vérifier si c'est un admin non rémunéré
            const user = allAdmins.find((a: Admin) => a.id === d.photographeId);
            const isNonRemunere = user && (user.rem === 'non' || user.rem === 'non');

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
            const isNonRemunere = user && (user.rem === 'non' || user.rem === 'non');

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

  // Fonction pour rafraîchir uniquement les disponibilités sans recharger toute la page
  const refreshDisponibilites = async () => {
    try {
      const disponibilitesRes = await fetch('/api/disponibilites');
      if (disponibilitesRes.ok) {
        const disponibilitesData = await disponibilitesRes.json();
        const newDisponibilites = disponibilitesData.disponibilites || [];
        setDisponibilites(newDisponibilites);

        // Recalculer les courses avec les nouvelles dispos (même logique que handleStatusChange)
        const coursesWithData = courses.map((course) => {
          const dispos = newDisponibilites.filter((d: any) => d.courseId === course.id);

          const photographesValides = dispos.filter((d: any) => {
            if (d.statut !== 'validated' && d.statut !== 'teamLeader') return false;
            const user = admins.find((a) => a.id === d.photographeId);
            const isNonRemunere = user && (user.rem === 'non' || user.rem === 'non');
            return !isNonRemunere;
          }).length;

          const photographesDisponibles = dispos.filter(
            (d: any) => d.statut === 'available' || d.statut === 'validated' || d.statut === 'teamLeader'
          ).length;

          let coutTotal = 0;
          dispos.forEach((d: any) => {
            if (d.statut === 'validated' || d.statut === 'teamLeader') {
              const user = admins.find((a) => a.id === d.photographeId);
              const isNonRemunere = user && (user.rem === 'non' || user.rem === 'non');
              if (isNonRemunere) return;

              const tarifDispo = d.tarifId
                ? tarifs.find((t: any) => t.id === d.tarifId)
                : course.tarif;

              if (tarifDispo) {
                const tarifPhoto = Number(tarifDispo.tarifPhotographe) || 0;
                const bonusChef = Number(tarifDispo.bonusChefEquipe) || 0;
                const montant = d.statut === 'teamLeader' ? tarifPhoto + bonusChef : tarifPhoto;
                coutTotal += montant;
              }
            }
          });

          return { ...course, disponibilites: dispos, photographesValides, photographesDisponibles, coutTotal };
        });

        setCourses(coursesWithData);

        // Recalculer les stats
        const activeCourses = coursesWithData.filter((c) => c.archived !== 'oui');
        const totalPrestations = activeCourses.reduce((sum, c) => sum + c.photographesValides, 0);
        const coutTotal = activeCourses.reduce((sum, c) => sum + c.coutTotal, 0);

        const coursesDetails = activeCourses.map((c) => ({
          nom: c.nom,
          ville: c.ville,
          validated: c.photographesValides,
        }));

        const activeCourseIds = new Set(activeCourses.map(c => c.id));
        const activeDisponibilites = newDisponibilites.filter((d: any) => activeCourseIds.has(d.courseId));

        const photographersMap = new Map();
        [...admins, ...photographers].forEach((user: any) => {
          photographersMap.set(user.id, { nom: user.nom, prenom: user.prenom, prestations: 0 });
        });

        activeDisponibilites.forEach((dispo: any) => {
          if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
            const photographer = photographersMap.get(dispo.photographeId);
            if (photographer) photographer.prestations++;
          }
        });

        const photographersDetails = Array.from(photographersMap.values())
          .filter((p: any) => p.prestations > 0)
          .sort((a: any, b: any) => b.prestations - a.prestations);

        const validatedCount = activeDisponibilites.filter((d: any) => d.statut === 'validated').length;
        const teamLeadersCount = activeDisponibilites.filter((d: any) => d.statut === 'teamLeader').length;

        let tarifBase = 0;
        let bonus = 0;
        activeCourses.forEach((course) => {
          course.disponibilites.forEach((d: any) => {
            if (d.statut === 'validated' || d.statut === 'teamLeader') {
              const user = admins.find((a) => a.id === d.photographeId);
              const isNonRemunere = user && (user.rem === 'non' || user.rem === 'non');
              if (isNonRemunere) return;

              const tarifDispo = d.tarifId ? tarifs.find((t: any) => t.id === d.tarifId) : course.tarif;
              if (tarifDispo) {
                tarifBase += Number(tarifDispo.tarifPhotographe) || 0;
                if (d.statut === 'teamLeader') bonus += Number(tarifDispo.bonusChefEquipe) || 0;
              }
            }
          });
        });

        setStats({
          totalCourses: activeCourses.length,
          coursesDetails,
          totalPhotographers: stats.totalPhotographers,
          photographersDetails,
          totalPrestations,
          prestationsDetails: { validated: validatedCount, teamLeaders: teamLeadersCount },
          coutTotal,
          coutDetails: { tarifBase, bonus },
        });

        console.log(`✅ Disponibilités et stats rafraîchies: ${newDisponibilites.length} disponibilités`);
      }
    } catch (error) {
      console.error('❌ Erreur refresh disponibilités:', error);
    }
  };

  const handleStatusChange = async (
    disponibiliteId: string,
    newStatus: string,
    courseId: string
  ) => {
    try {
      // Mise à jour optimiste SIMPLE - juste changer le statut visuellement
      const updatedDisponibilites = disponibilites.map((d) =>
        d.id === disponibiliteId
          ? { ...d, statut: newStatus as Disponibilite['statut'] }
          : d
      );
      setDisponibilites(updatedDisponibilites);

      // Récupérer la disponibilité pour extraire le photographeId et tarifId
      let dispo = updatedDisponibilites.find(d => d.id === disponibiliteId);

      // Si la dispo n'existe pas encore, extraire les infos de l'ID temporaire
      let tarifId: string | undefined;
      if (!dispo && disponibiliteId.startsWith('dispo-')) {
        // Format: dispo-courseId-photoId-tarifId
        // Attention: courseId, photoId et tarifId peuvent contenir des tirets !
        // Exemple: dispo-course-123-admin-456-tarif-789
        // On doit trouver le courseId et photographeId depuis la course actuelle

        // Trouver la course correspondante
        const course = courses.find(c => c.id === courseId);
        if (course) {
          // Extraire le photographeId et tarifId en fonction de la structure de l'ID
          // Format attendu: dispo-{courseId}-{photographeId}-{tarifId}
          // où chaque partie peut contenir des tirets

          // On enlève le préfixe "dispo-"
          const idWithoutPrefix = disponibiliteId.substring(6); // Enlever "dispo-"

          // On cherche les photographes de la course
          // IMPORTANT: Trier par longueur d'ID décroissante pour matcher les plus longs en premier
          // (photographe-0225 avant photographe-022)
          const coursePhotographers = [...admins, ...photographers].sort((a, b) => b.id.length - a.id.length);
          let foundPhotoId = '';
          let foundTarifId = '';

          // Essayer de matcher avec les IDs connus
          for (const photo of coursePhotographers) {
            if (idWithoutPrefix.startsWith(courseId + '-' + photo.id)) {
              foundPhotoId = photo.id;
              // Le reste après courseId-photoId est le tarifId
              const afterPhotoId = idWithoutPrefix.substring((courseId + '-' + photo.id).length);
              if (afterPhotoId.startsWith('-')) {
                foundTarifId = afterPhotoId.substring(1); // Enlever le tiret du début
              }
              break;
            }
          }

          if (foundPhotoId) {
            tarifId = foundTarifId || undefined;
            dispo = {
              id: disponibiliteId,
              courseId: courseId,
              photographeId: foundPhotoId,
              statut: newStatus as Disponibilite['statut'],
              tarifId: tarifId
            };
          }
        }
      } else if (dispo) {
        tarifId = dispo.tarifId;
      }

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
          tarifId: tarifId, // Inclure le tarifId pour les courses avec deux tarifs
          dateModification: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        // Erreur API, rollback - rafraîchir seulement les disponibilités
        await refreshDisponibilites();
      } else {
        // Succès - rafraîchir seulement les disponibilités
        await refreshDisponibilites();
      }
    } catch (error) {
      // Erreur mise à jour statut - rafraîchir seulement les disponibilités
      console.error('❌ Erreur lors de la mise à jour:', error);
      await refreshDisponibilites();
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
            const isNonRemunere = user && (user.rem === 'non' || user.rem === 'non');

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

  const toggleValidation = async (courseId: string, field: 'hotelValid' | 'transportValid') => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;

    // Déterminer la nouvelle valeur (toggle)
    const currentValue = course[field];
    const isCurrentlyValid = currentValue === 'TRUE' || currentValue === true;
    const newValue = isCurrentlyValid ? 'FALSE' : 'TRUE';

    // Mise à jour optimiste
    const updatedCourses = courses.map((c) =>
      c.id === courseId ? { ...c, [field]: newValue } : c
    );
    setCourses(updatedCourses);

    try {
      // Envoyer la mise à jour au serveur
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      });

      if (!res.ok) {
        // En cas d'erreur, restaurer l'état précédent
        setCourses(courses);
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      // En cas d'erreur, restaurer l'état précédent
      setCourses(courses);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Filtrage par statut uniquement
  const filteredCourses = courses.filter((course) => {
    // Pour les courses archivées, inclure seulement celles du mois actuel
    if (course.archived === 'oui') {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const courseDate = new Date(course.dateDebut);
      const courseMonth = courseDate.getMonth();
      const courseYear = courseDate.getFullYear();

      // Garder uniquement si c'est le mois en cours
      if (courseYear !== currentYear || courseMonth !== currentMonth) {
        return false;
      }
    }

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement du calendrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden flex flex-col space-y-1.5 -mx-3 -my-4 md:-mx-6 md:-my-8 px-3 py-4 md:px-6 md:py-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Calendrier des courses</h1>
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

      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
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
          {/* Toggle vue liste/grille (mobile uniquement) */}
          <div className="md:hidden flex items-center gap-1 mr-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              title="Vue calendrier"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              title="Vue liste"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Contrôles de zoom (cachés en mobile si mode liste) */}
          <div className={cn("flex items-center gap-2", viewMode === 'list' && "hidden md:flex")}>
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

      {/* Vue liste (mobile en mode liste uniquement) */}
      {viewMode === 'list' && (
        <div className="md:hidden overflow-y-auto space-y-3 px-2" style={{ height: 'calc(100vh - 140px)' }}>
          {sortedMonths.map((monthData) => {
            const monthKey = `${monthData.year}-${monthData.month}`;

            return (
              <div key={monthKey} className="space-y-2">
                {/* En-tête du mois */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900 dark:to-orange-950 p-3 rounded-lg border-2 border-orange-300">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base capitalize">
                      {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
                    </h3>
                    <div className="text-xs text-muted-foreground">
                      {monthData.courses.length} course{monthData.courses.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Cartes des courses */}
                {monthData.courses.map((course) => {
                  // Vérifier si la course est passée
                  const now = new Date();
                  const courseEndDate = new Date(course.dateFin);
                  const isPastCourse = courseEndDate < now;

                  return (
                    <div
                      key={course.id}
                      className={cn(
                        "bg-white dark:bg-gray-950 p-3 rounded-lg border-2 shadow-sm",
                        isPastCourse && "opacity-40"
                      )}
                    >
                    <div className="space-y-2">
                      {/* Titre et icônes */}
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/admin/planning/${course.id}`}
                          className="font-semibold text-sm flex-1 hover:text-blue-600 transition-colors"
                        >
                          {course.nom}
                        </Link>
                        <div className="flex items-center gap-1">
                          {course.statutTraitement === 'done' ? (
                            <span className="text-[10px]">🟢</span>
                          ) : (
                            <span className="text-[10px]">🟠</span>
                          )}
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                toggleValidation(course.id, 'hotelValid');
                              }}
                              className={`text-[9px] font-bold px-1 py-0.5 rounded border cursor-pointer transition-colors ${course.hotelValid === 'TRUE' || course.hotelValid === true ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'}`}
                            >
                              H
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                toggleValidation(course.id, 'transportValid');
                              }}
                              className={`text-[9px] font-bold px-1 py-0.5 rounded border cursor-pointer transition-colors ${course.transportValid === 'TRUE' || course.transportValid === true ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'}`}
                            >
                              T
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Informations */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="font-medium">📍</span>
                          <span className="truncate">{course.ville}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="font-medium">📅</span>
                          <span>{format(new Date(course.dateDebut), 'dd/MM', { locale: fr })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">📷</span>
                          <span className="font-semibold text-foreground">{course.photographesValides}/{course.photographesDisponibles}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">💶</span>
                          <span className="font-semibold text-foreground">{course.coutTotal}€</span>
                        </div>
                      </div>

                      {/* Actions rapides */}
                      <div className="flex gap-2 pt-1">
                        <Link
                          href={`/admin/planning/${course.id}`}
                          className="flex-1 text-center text-xs py-1.5 px-2 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                        >
                          Voir détails
                        </Link>
                        <Link
                          href={`/admin/planning/${course.id}/edit`}
                          className="flex-1 text-center text-xs py-1.5 px-2 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          Modifier
                        </Link>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Tableau type Excel - NOUVELLE STRUCTURE (caché en mobile si mode liste) */}
      <div className={cn(
        "sticky top-[100px] rounded-lg border shadow-lg bg-white dark:bg-gray-950 overflow-hidden",
        viewMode === 'list' && "hidden md:block"
      )} style={{ height: 'calc(100vh - 140px)' }}>
        <div className="h-full overflow-x-auto overflow-y-auto" style={{ zoom: `${zoom}%` }}>
          {/* En-tête du tableau - STICKY TOP */}
          <div className="sticky top-0 z-40 bg-white dark:bg-gray-950 shadow-sm">
            {/* Ligne 1: En-têtes de région */}
            <div
              className="grid gap-0 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 border-b border-gray-400/30"
              style={{
                gridTemplateColumns: `200px 120px repeat(${[...admins, ...photographers].filter((u) => u.actif).length}, 70px)`,
                minWidth: 'max-content'
              }}
            >
              {/* Colonnes fixes */}
              <div className="sticky left-0 z-50 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}></div>
              <div className="sticky z-50 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}></div>

              {/* Admins - pas de région */}
              {admins.filter((a) => a.actif).map(admin => (
                <div key={admin.id}></div>
              ))}

              {/* Photographes - regroupés par région */}
              {(() => {
                const regionGroups = groupPhotographersByRegion(photographers.filter((p) => p.actif));
                return regionGroups.map(group => (
                  <React.Fragment key={group.region}>
                    <div
                      className={`p-1 text-center font-bold text-[10px] uppercase tracking-wider ${getRegionBackgroundColor(group.photographers[0]?.region)} border-l border-gray-400/40`}
                      style={{ gridColumn: `span ${group.photographers.length}` }}
                    >
                      {group.region}
                    </div>
                  </React.Fragment>
                ));
              })()}
            </div>

            {/* Ligne 2: Noms des photographes */}
            <div
              className="grid gap-0 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-b-2 border-gray-400/30"
              style={{
                gridTemplateColumns: `200px 120px repeat(${[...admins, ...photographers].filter((u) => u.actif).length}, 70px)`,
                minWidth: 'max-content'
              }}
            >
              {/* Colonne Course - STICKY */}
              <div
                className="sticky left-0 z-50 p-2 pr-1.5 border-r-2 border-gray-400/40 font-semibold text-sm bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
                style={{ position: 'sticky', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Course
              </div>

              {/* Colonne Date - STICKY */}
              <div
                className="sticky z-50 p-2 pr-1.5 border-r-2 border-gray-400/40 font-semibold text-sm bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
                style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
              >
                Date
              </div>
              {/* Colonnes Admins */}
              {admins.filter((a) => a.actif).map(admin => (
                <div key={admin.id} className="p-2 text-center">
                  <Link
                    href={`/admin/admins/${admin.id}/profile`}
                    className="hover:text-gray-700 hover:underline transition-colors font-bold text-xs flex flex-col items-center"
                    title={`${admin.prenom} ${admin.nom}`}
                  >
                    <div className="truncate w-full">{admin.prenom}</div>
                    <div className="text-[9px] truncate w-full">{admin.nom}</div>
                  </Link>
                </div>
              ))}

              {/* Colonnes Photographes */}
              {photographers.filter((p) => p.actif).map(photographer => (
                <div key={photographer.id} className={`p-2 text-center ${getRegionBackgroundColor(photographer.region)}`}>
                  <Link
                    href={`/admin/photographers/${photographer.id}/profile`}
                    className="hover:text-gray-700 hover:underline transition-colors text-xs flex flex-col items-center"
                    title={`${photographer.prenom} ${photographer.nom}${photographer.region ? ` - ${photographer.region}` : ''}`}
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
                      <div className="text-xs mt-1 text-gray-700 dark:text-gray-300">
                        {(() => {
                          // Calculer le coût total du mois (en excluant les admins non rémunérés)
                          let monthTotal = 0;

                          monthData.courses.forEach((course) => {
                            course.disponibilites.forEach((dispo) => {
                              if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
                                // Vérifier si c'est un admin non rémunéré
                                const admin = admins.find((a) => a.id === dispo.photographeId);
                                const isNonPaidAdmin = admin && (
                                  admin.rem === true ||
                                  admin.rem === 'TRUE' ||
                                  admin.rem === 'true' ||
                                  String(admin.rem).toLowerCase() === 'true'
                                );

                                // Ne compter que si ce n'est pas un admin non rémunéré
                                if (!isNonPaidAdmin) {
                                  const courseTarif = dispo.tarifId
                                    ? tarifs.find((t) => t.id === dispo.tarifId)
                                    : tarifs.find((t) => t.courseId === course.id);

                                  if (courseTarif) {
                                    const amount = dispo.statut === 'teamLeader'
                                      ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                                      : Number(courseTarif.tarifPhotographe);
                                    monthTotal += amount;
                                  }
                                }
                              }
                            });
                          });

                          return `${monthTotal.toLocaleString('fr-FR')} €`;
                        })()}
                      </div>
                    </div>
                    <div className="sticky z-10 p-3 border-r-2 border-orange-300 dark:border-orange-700 bg-orange-100 dark:bg-orange-900" style={{ left: '200px' }}>
                      <div className="text-xs">{monthData.courses.length} course{monthData.courses.length > 1 ? 's' : ''}</div>
                    </div>
                    {admins.filter((a) => a.actif).map(admin => {
                      // Calculer le nombre de fois où cet admin est validé ou chef dans ce mois + montant total
                      let userCount = 0;
                      let userTotal = 0;
                      const isNonPaidAdmin = admin.rem === true ||
                                            admin.rem === 'TRUE' ||
                                            admin.rem === 'true' ||
                                            String(admin.rem).toLowerCase() === 'true';

                      monthData.courses.forEach((course) => {
                        const dispo = course.disponibilites.find(d => d.photographeId === admin.id);
                        if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                          userCount += 1;

                          // Trouver le tarif correspondant
                          const courseTarif = dispo.tarifId
                            ? tarifs.find((t) => t.id === dispo.tarifId)
                            : tarifs.find((t) => t.courseId === course.id);

                          if (courseTarif) {
                            // Pour les admins non rémunérés : uniquement le tarif de base (pas de bonus chef)
                            // Pour voir la "valeur photographe"
                            const amount = isNonPaidAdmin
                              ? Number(courseTarif.tarifPhotographe)
                              : (dispo.statut === 'teamLeader'
                                ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                                : Number(courseTarif.tarifPhotographe));
                            userTotal += amount;
                          }
                        }
                      });

                      return (
                        <div key={admin.id} className="p-3 flex flex-col items-center justify-center text-xs font-semibold">
                          <div>{userCount > 0 ? userCount : '-'}</div>
                          {userCount > 0 && (
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                              {isNonPaidAdmin ? '(' : ''}{userTotal.toLocaleString('fr-FR')} €{isNonPaidAdmin ? ')' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {photographers.filter((p) => p.actif).map(photographer => {
                      // Calculer le nombre de fois où ce photographe est validé ou chef dans ce mois + montant total
                      let userCount = 0;
                      let userTotal = 0;

                      monthData.courses.forEach((course) => {
                        const dispo = course.disponibilites.find(d => d.photographeId === photographer.id);
                        if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
                          userCount += 1;

                          // Trouver le tarif correspondant
                          const courseTarif = dispo.tarifId
                            ? tarifs.find((t) => t.id === dispo.tarifId)
                            : tarifs.find((t) => t.courseId === course.id);

                          if (courseTarif) {
                            const amount = dispo.statut === 'teamLeader'
                              ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
                              : Number(courseTarif.tarifPhotographe);
                            userTotal += amount;
                          }
                        }
                      });

                      return (
                        <div key={photographer.id} className="p-3 flex flex-col items-center justify-center text-xs font-semibold">
                          <div>{userCount > 0 ? userCount : '-'}</div>
                          {userCount > 0 && (
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                              {userTotal.toLocaleString('fr-FR')} €
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Courses du mois */}
                  {monthData.courses.map((course, courseIdx) => {
                    const validatedCount = course.photographesValides;
                    const availableCount = course.photographesDisponibles;
                    const bgColor = courseIdx % 2 === 0
                      ? "bg-gray-50 dark:bg-gray-950"
                      : "bg-gray-100 dark:bg-gray-900";

                    // Vérifier si la course est passée
                    const now = new Date();
                    const courseEndDate = new Date(course.dateFin);
                    const isPastCourse = courseEndDate < now;

                    // Vérifier si c'est le début d'un nouveau week-end
                    const currentWeekend = getWeekendKey(course.dateDebut);
                    const previousWeekend = courseIdx > 0
                      ? getWeekendKey(monthData.courses[courseIdx - 1].dateDebut)
                      : null;
                    const isNewWeekend = previousWeekend && currentWeekend !== previousWeekend;
                    const hasTwoTarifs = course.tarifs && course.tarifs.length > 1;

                    return (
                      <div
                        key={course.id}
                        className={cn(
                          "group grid gap-0 transition-colors relative border-b border-gray-200/50",
                          bgColor,
                          isNewWeekend && "border-t-4 border-t-blue-400 dark:border-t-blue-500 shadow-[0_-2px_8px_rgba(59,130,246,0.3)]",
                          isPastCourse && "opacity-40"
                        )}
                        style={{
                          gridTemplateColumns: `200px 120px repeat(${[...admins, ...photographers].filter((u) => u.actif).length}, 70px)`,
                          minWidth: 'max-content'
                        }}
                      >
                        {/* Colonne infos course - STICKY */}
                        <div
                          className={cn(
                            "sticky left-0 z-30 p-2 pr-1.5 border-r-2 border-gray-400/40 transition-colors group-hover:bg-gray-200 dark:group-hover:bg-gray-800/30",
                            bgColor
                          )}
                          style={{
                            position: 'sticky',
                            boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                          }}
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
                              {/* Badges Hotel et Transport */}
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleValidation(course.id, 'hotelValid');
                                  }}
                                  className={`text-[9px] font-bold px-1 py-0.5 rounded border cursor-pointer transition-colors ${course.hotelValid === 'TRUE' || course.hotelValid === true ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'}`}
                                  title={course.hotelValid === 'TRUE' || course.hotelValid === true ? 'Hôtel validé - Cliquer pour invalider' : 'Hôtel non validé - Cliquer pour valider'}
                                >
                                  H
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleValidation(course.id, 'transportValid');
                                  }}
                                  className={`text-[9px] font-bold px-1 py-0.5 rounded border cursor-pointer transition-colors ${course.transportValid === 'TRUE' || course.transportValid === true ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'}`}
                                  title={course.transportValid === 'TRUE' || course.transportValid === true ? 'Transport validé - Cliquer pour invalider' : 'Transport non validé - Cliquer pour valider'}
                                >
                                  T
                                </button>
                              </div>
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

                          {/* Ligne 3: Stats + Prix - Split si deux tarifs */}
                          {(() => {
                            const hasTwoTarifs = (course.twoPrices === 'TRUE' || course.twoPrices === true) &&
                                                course.tarifs && course.tarifs.length > 1;

                            if (hasTwoTarifs && course.tarifs) {
                              // Affichage avec deux tarifs (split vertical)
                              return (
                                <div className="flex flex-col gap-1 border-t border-gray-300 pt-1">
                                  {course.tarifs.map((tarif, idx) => {
                                    // Calculer les stats spécifiques pour ce tarif
                                    const tarifValidatedCount = course.disponibilites.filter(
                                      d => d.tarifId === tarif.id && (d.statut === 'validated' || d.statut === 'teamLeader')
                                    ).length;
                                    const tarifAvailableCount = course.disponibilites.filter(
                                      d => d.tarifId === tarif.id && d.statut === 'available'
                                    ).length;

                                    return (
                                      <div key={tarif.id} className="flex items-center gap-1.5">
                                        <div className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                                          {tarifValidatedCount}
                                        </div>
                                        <span className="text-[9px] text-muted-foreground">
                                          {tarifAvailableCount}-{course.numberAttended || 0}
                                        </span>
                                        <div className="flex flex-col text-[9px] font-medium">
                                          <span className="text-blue-700 font-semibold">
                                            {idx === 0
                                              ? (tarif.firstTarifName || 'Tarif 1')
                                              : (tarif.secondTarifName || 'Tarif 2')}
                                          </span>
                                          <span className="text-muted-foreground">
                                            💰 {tarif.tarifPhotographe}€
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } else {
                              // Affichage normal avec un seul tarif
                              return (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                                    {validatedCount}
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">
                                    {availableCount}-{course.numberAttended || 0}
                                  </span>
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    💰 {course.tarif ? course.tarif.tarifPhotographe : 0}€
                                  </span>
                                </div>
                              );
                            }
                          })()}
                        </div>

                        {/* Colonne Date - STICKY */}
                        <div
                          className={cn(
                            "sticky z-30 p-2 pr-1.5 flex flex-col justify-start items-start gap-0.5 border-r-2 border-green-600/40 group-hover:bg-gray-200 dark:group-hover:bg-gray-800/30 transition-colors",
                            bgColor
                          )}
                          style={{ position: 'sticky', left: '200px', boxShadow: '2px 0 5px rgba(0,0,0,0.1)' }}
                        >
                          {(() => {
                            const dateDebut = new Date(course.dateDebut);
                            const dateFin = new Date(course.dateFin);
                            const dateDebutNormalized = new Date(dateDebut.getFullYear(), dateDebut.getMonth(), dateDebut.getDate());
                            const dateFinNormalized = new Date(dateFin.getFullYear(), dateFin.getMonth(), dateFin.getDate());
                            const nbJours = Math.round((dateFinNormalized.getTime() - dateDebutNormalized.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                            return (
                              <>
                                <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                  {format(dateDebut, "dd/MM/yy", { locale: fr })}
                                  {nbJours > 1 && (
                                    <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded">
                                      {nbJours}j
                                    </span>
                                  )}
                                </div>
                                {nbJours > 1 && (
                                  <div className="text-xs text-gray-700">
                                    au {format(dateFin, "dd/MM/yy", { locale: fr })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Colonnes admins */}
                        {admins.filter((a) => a.actif).map(admin => {
                          const hasTwoTarifs = (course.twoPrices === 'TRUE' || course.twoPrices === true) &&
                                              course.tarifs && course.tarifs.length > 1;

                          if (hasTwoTarifs && course.tarifs) {
                            // Affichage avec deux sélecteurs (un par tarif)
                            return (
                              <div key={admin.id} className="px-2 pb-2 pt-14 flex flex-col items-start justify-start gap-1 group-hover:bg-gray-200 dark:group-hover:bg-gray-800/30 transition-colors border-t border-gray-300">
                                {course.tarifs.map((tarif, idx) => {
                                  // Trouver ou créer la disponibilité pour ce tarif
                                  const dispo = course.disponibilites.find(
                                    (d) => d.photographeId === admin.id && d.tarifId === tarif.id
                                  ) || {
                                    id: `dispo-${course.id}-${admin.id}-${tarif.id}`,
                                    photographeId: admin.id,
                                    courseId: course.id,
                                    statut: 'pending' as const,
                                    tarifId: tarif.id
                                  };

                                  return (
                                    <div key={tarif.id} className="w-full">
                                      <Select
                                        value={dispo.statut}
                                        onValueChange={(value) => handleStatusChange(dispo.id, value, course.id)}
                                      >
                                        <SelectTrigger className={`h-7 text-[9px] w-full border transition-all focus:border-gray-600 px-0.5 font-medium ${getStatusColorClass(dispo.statut)}`}>
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
                                              <span className="text-xs">Ref</span>
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
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } else {
                            // Affichage normal avec un seul sélecteur (crée une dispo temporaire si inexistante)
                            const dispo = course.disponibilites.find((d) => d.photographeId === admin.id) || {
                              id: `dispo-${course.id}-${admin.id}`,
                              photographeId: admin.id,
                              courseId: course.id,
                              statut: 'pending' as const,
                            };

                            return (
                              <div key={admin.id} className="p-2 flex flex-col items-start justify-start gap-0.5 group-hover:bg-gray-200 dark:group-hover:bg-gray-800/30 transition-colors">
                                <Select
                                  value={dispo.statut}
                                  onValueChange={(value) => handleStatusChange(dispo.id, value, course.id)}
                                >
                                  <SelectTrigger className={`h-7 text-[9px] w-full border transition-all focus:border-gray-600 px-0.5 font-medium ${getStatusColorClass(dispo.statut)}`}>
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
                                        <span className="text-xs">Ref</span>
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
                              </div>
                            );
                          }
                        })}

                        {/* Colonnes photographes */}
                        {photographers.filter((p) => p.actif).map(photographer => {
                          const hasTwoTarifs = (course.twoPrices === 'TRUE' || course.twoPrices === true) &&
                                              course.tarifs && course.tarifs.length > 1;

                          if (hasTwoTarifs && course.tarifs) {
                            // Affichage avec deux sélecteurs (un par tarif)
                            return (
                              <div key={photographer.id} className={`px-2 pb-2 pt-14 flex flex-col items-start justify-start gap-1 group-hover:bg-gray-200 dark:group-hover:bg-gray-800/30 transition-colors border-t border-gray-300 ${getRegionBackgroundColor(photographer.region)}`}>
                                {course.tarifs.map((tarif, idx) => {
                                  // Trouver ou créer la disponibilité pour ce tarif
                                  const dispo = course.disponibilites.find(
                                    (d) => d.photographeId === photographer.id && d.tarifId === tarif.id
                                  ) || {
                                    id: `dispo-${course.id}-${photographer.id}-${tarif.id}`,
                                    photographeId: photographer.id,
                                    courseId: course.id,
                                    statut: 'pending' as const,
                                    tarifId: tarif.id
                                  };

                                  return (
                                    <div key={tarif.id} className="w-full">
                                      <Select
                                        value={dispo.statut}
                                        onValueChange={(value) => handleStatusChange(dispo.id, value, course.id)}
                                      >
                                        <SelectTrigger className={`h-7 text-[9px] w-full border transition-all focus:border-gray-600 px-0.5 font-medium ${getStatusColorClass(dispo.statut)}`}>
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
                                              <span className="text-xs">Ref</span>
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
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } else {
                            // Affichage normal avec un seul sélecteur
                            const dispo = course.disponibilites.find((d) => d.photographeId === photographer.id) || {
                              id: `dispo-${course.id}-${photographer.id}`,
                              photographeId: photographer.id,
                              courseId: course.id,
                              statut: 'pending' as const,
                            };

                            return (
                              <div key={photographer.id} className={`p-2 flex flex-col items-start justify-start gap-0.5 group-hover:bg-gray-200 dark:group-hover:bg-gray-800/30 transition-colors ${getRegionBackgroundColor(photographer.region)}`}>
                                <Select
                                  value={dispo.statut}
                                  onValueChange={(value) => handleStatusChange(dispo.id, value, course.id)}
                                >
                                  <SelectTrigger className={`h-7 text-[9px] w-full border transition-all focus:border-gray-600 px-0.5 font-medium ${getStatusColorClass(dispo.statut)}`}>
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
                                        <span className="text-xs">Ref</span>
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
                              </div>
                            );
                          }
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
              Cette course sera retirée du calendrier principal et déplacée dans la section Archives. Vous pourrez la désarchiver à tout moment.
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
