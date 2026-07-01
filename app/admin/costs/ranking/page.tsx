'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Trophy, Medal, Award } from 'lucide-react';

interface Course {
  id: string;
  nom: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  archived?: string;
}

interface Tarif {
  id: string;
  courseId: string;
  tarifPhotographe: number;
  bonusChefEquipe: number;
}

interface Disponibilite {
  id: string;
  photographeId: string;
  courseId: string;
  statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected' | 'nonPris';
}

interface Photographer {
  id: string;
  nom: string;
  prenom: string;
  nonRemunere?: boolean | string;
}

interface Admin {
  id: string;
  nom: string;
  prenom: string;
  nonRemunere?: boolean | string;
}

interface PhotographerEarnings {
  photographerId: string;
  photographerName: string;
  totalEarnings: number;
  coursesCount: number;
  teamLeaderCount: number;
  isFictif: boolean;
}

export default function PhotographerRankingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [coursesRes, tarifsRes, disponibilitesRes, photographersRes, adminsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/tarifs'),
        fetch('/api/disponibilites'),
        fetch('/api/photographers'),
        fetch('/api/admins'),
      ]);

      const [coursesData, tarifsData, disponibilitesData, photographersData, adminsData] = await Promise.all([
        coursesRes.json(),
        tarifsRes.json(),
        disponibilitesRes.json(),
        photographersRes.json(),
        adminsRes.json(),
      ]);

      setCourses(coursesData.courses || []);
      setTarifs(tarifsData.tarifs || []);
      setDisponibilites(disponibilitesData.disponibilites || []);
      setPhotographers(photographersData.photographers || []);
      setAdmins(adminsData.admins || []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculer les gains de chaque photographe pour l'année sélectionnée
  const calculateRankings = (): PhotographerEarnings[] => {
    const earnings: Record<string, PhotographerEarnings> = {};

    // Filtrer les courses pour l'année sélectionnée
    const yearCourses = courses.filter(c => {
      const courseYear = new Date(c.dateDebut).getFullYear();
      return courseYear === selectedYear;
    });

    yearCourses.forEach(course => {
      const courseTarif = tarifs.find(t => t.courseId === course.id);
      if (!courseTarif) return;

      const courseDispos = disponibilites.filter(d => d.courseId === course.id);

      courseDispos.forEach(dispo => {
        if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
          const photographer = photographers.find(p => p.id === dispo.photographeId);
          if (!photographer) return;

          // Vérifier si c'est un photographe non rémunéré
          const isNonRemunere = photographer.nonRemunere === 'TRUE' || photographer.nonRemunere === true;
          if (isNonRemunere) return;

          const photographerName = `${photographer.prenom} ${photographer.nom}`;

          if (!earnings[dispo.photographeId]) {
            earnings[dispo.photographeId] = {
              photographerId: dispo.photographeId,
              photographerName,
              totalEarnings: 0,
              coursesCount: 0,
              teamLeaderCount: 0,
              isFictif: false,
            };
          }

          let amount = Number(courseTarif.tarifPhotographe);
          if (dispo.statut === 'teamLeader') {
            amount += Number(courseTarif.bonusChefEquipe);
            earnings[dispo.photographeId].teamLeaderCount += 1;
          }

          earnings[dispo.photographeId].totalEarnings += amount;
          earnings[dispo.photographeId].coursesCount += 1;
        }
      });
    });

    // Ajouter les admins qui participent aux courses
    admins.forEach(admin => {
      // Vérifier si c'est un admin non rémunéré (fictif)
      const isNonRemunere = admin.nonRemunere === 'TRUE' || admin.nonRemunere === true;

      let adminTotalEarnings = 0;
      let adminCoursesCount = 0;
      let adminTeamLeaderCount = 0;

      yearCourses.forEach(course => {
        const courseTarif = tarifs.find(t => t.courseId === course.id);
        if (!courseTarif) return;

        const courseDispos = disponibilites.filter(d => d.courseId === course.id);
        const adminDispo = courseDispos.find(d => d.photographeId === admin.id);

        if (adminDispo && (adminDispo.statut === 'validated' || adminDispo.statut === 'teamLeader')) {
          let amount = Number(courseTarif.tarifPhotographe);

          // Pour les admins non rémunérés, ne pas compter le bonus référent
          if (adminDispo.statut === 'teamLeader') {
            if (!isNonRemunere) {
              amount += Number(courseTarif.bonusChefEquipe);
            }
            adminTeamLeaderCount += 1;
          }

          adminTotalEarnings += amount;
          adminCoursesCount += 1;
        }
      });

      // Ajouter l'admin s'il a participé à au moins une course
      if (adminCoursesCount > 0) {
        earnings[admin.id] = {
          photographerId: admin.id,
          photographerName: `${admin.prenom} ${admin.nom}`,
          totalEarnings: adminTotalEarnings,
          coursesCount: adminCoursesCount,
          teamLeaderCount: adminTeamLeaderCount,
          isFictif: isNonRemunere,
        };
      }
    });

    // Convertir en tableau et trier par gains décroissants
    return Object.values(earnings).sort((a, b) => b.totalEarnings - a.totalEarnings);
  };

  const rankings = calculateRankings();

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />;
    return null;
  };

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
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/admin/costs')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              Classement des photographes
            </h1>
            <p className="text-sm text-muted-foreground">
              Gains des photographes pour l&apos;année {selectedYear}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(selectedYear - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-xl font-bold px-4">{selectedYear}</div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear(selectedYear + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total versé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(rankings.filter(r => !r.isFictif).reduce((sum, r) => sum + r.totalEarnings, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Photographes actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rankings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gain moyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rankings.filter(r => !r.isFictif).length > 0
                ? formatCurrency(rankings.filter(r => !r.isFictif).reduce((sum, r) => sum + r.totalEarnings, 0) / rankings.filter(r => !r.isFictif).length)
                : formatCurrency(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau de classement */}
      <Card>
        <CardHeader>
          <CardTitle>Classement complet</CardTitle>
        </CardHeader>
        <CardContent>
          {rankings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun photographe n&apos;a été payé en {selectedYear}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-center p-3 font-semibold w-20">Rang</th>
                    <th className="text-left p-3 font-semibold">Photographe</th>
                    <th className="text-center p-3 font-semibold">Courses</th>
                    <th className="text-center p-3 font-semibold">Référent</th>
                    <th className="text-right p-3 font-semibold bg-gray-100">Total gagné</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((photographer, index) => {
                    const rank = index + 1;
                    const rankIcon = getRankIcon(rank);

                    return (
                      <tr
                        key={photographer.photographerId}
                        className={`border-b hover:bg-gray-50 ${
                          rank <= 3 ? 'bg-gradient-to-r from-yellow-50/30 to-transparent' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {rankIcon || <span className="text-lg font-bold text-gray-600">#{rank}</span>}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">
                            {photographer.photographerName}
                            {photographer.isFictif && (
                              <span className="ml-2 text-xs text-muted-foreground italic">(Fictif)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="font-medium">{photographer.coursesCount}</div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="font-medium">
                            {photographer.teamLeaderCount > 0 ? photographer.teamLeaderCount : '-'}
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold bg-gray-50">
                          {formatCurrency(photographer.totalEarnings)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Total */}
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2">
                    <td colSpan={2} className="p-3">TOTAL {selectedYear}</td>
                    <td className="p-3 text-center">
                      {rankings.filter(r => !r.isFictif).reduce((sum, r) => sum + r.coursesCount, 0)}
                    </td>
                    <td className="p-3 text-center">
                      {rankings.filter(r => !r.isFictif).reduce((sum, r) => sum + r.teamLeaderCount, 0)}
                    </td>
                    <td className="p-3 text-right bg-gray-200">
                      {formatCurrency(rankings.filter(r => !r.isFictif).reduce((sum, r) => sum + r.totalEarnings, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
