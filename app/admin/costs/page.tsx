'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Euro } from 'lucide-react';

interface Course {
  id: string;
  nom: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  hotelPrice?: string;
  transportPrice?: string;
  foodPrice?: string;
  comOrga?: string;
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
  statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected';
}

interface Admin {
  id: string;
  nom: string;
  prenom: string;
  nonRemunere?: boolean | string;
}

export default function CostsRecapPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [coursesRes, tarifsRes, disponibilitesRes, adminsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/tarifs'),
        fetch('/api/disponibilites'),
        fetch('/api/admins'),
      ]);

      const [coursesData, tarifsData, disponibilitesData, adminsData] = await Promise.all([
        coursesRes.json(),
        tarifsRes.json(),
        disponibilitesRes.json(),
        adminsRes.json(),
      ]);

      setCourses(coursesData.courses || []);
      setTarifs(tarifsData.tarifs || []);
      setDisponibilites(disponibilitesData.disponibilites || []);
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

  // Filtrer les courses non archivées
  const activeCourses = courses.filter(c => c.archived !== 'oui');

  // Regrouper par mois
  const coursesByMonth = activeCourses.reduce((acc, course) => {
    const date = new Date(course.dateDebut);
    const monthKey = format(date, 'MMMM yyyy', { locale: fr });

    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(course);
    return acc;
  }, {} as Record<string, Course[]>);

  // Calculer le coût photographes pour une course
  const calculatePhotoCost = (courseId: string) => {
    const courseTarif = tarifs.find(t => t.courseId === courseId);
    if (!courseTarif) return 0;

    const courseDispos = disponibilites.filter(d => d.courseId === courseId);

    let total = 0;
    courseDispos.forEach(dispo => {
      if (dispo.statut === 'validated' || dispo.statut === 'teamLeader') {
        // Vérifier si c'est un admin non rémunéré
        const user = admins.find(a => a.id === dispo.photographeId);
        const isNonRemunere = user && (user.nonRemunere === 'TRUE' || user.nonRemunere === true);

        if (!isNonRemunere) {
          if (dispo.statut === 'teamLeader') {
            total += Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe);
          } else {
            total += Number(courseTarif.tarifPhotographe);
          }
        }
      }
    });

    return total;
  };

  // Calculer le total général
  const calculateGrandTotal = () => {
    let hotelTotal = 0;
    let transportTotal = 0;
    let foodTotal = 0;
    let comOrgaTotal = 0;
    let photosTotal = 0;

    activeCourses.forEach(course => {
      hotelTotal += Number(course.hotelPrice) || 0;
      transportTotal += Number(course.transportPrice) || 0;
      foodTotal += Number(course.foodPrice) || 0;
      comOrgaTotal += Number(course.comOrga) || 0;
      photosTotal += calculatePhotoCost(course.id);
    });

    return {
      hotelTotal,
      transportTotal,
      foodTotal,
      comOrgaTotal,
      photosTotal,
      grandTotal: hotelTotal + transportTotal + foodTotal + comOrgaTotal + photosTotal,
    };
  };

  const totals = calculateGrandTotal();

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Récapitulatif des coûts</h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble des coûts par course
        </p>
      </div>

      {/* Totaux généraux */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hôtels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.hotelTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.transportTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nourriture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.foodTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com. Orga</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.comOrgaTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Photographes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.photosTotal)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Euro className="h-4 w-4" />
              TOTAL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.grandTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau par mois */}
      <div className="space-y-6">
        {Object.entries(coursesByMonth)
          .sort((a, b) => {
            const dateA = new Date(a[1][0].dateDebut);
            const dateB = new Date(b[1][0].dateDebut);
            return dateA.getTime() - dateB.getTime();
          })
          .map(([monthKey, monthCourses]) => {
            // Calculer les totaux du mois
            const hotel = monthCourses.reduce((sum, c) => sum + (Number(c.hotelPrice) || 0), 0);
            const transport = monthCourses.reduce((sum, c) => sum + (Number(c.transportPrice) || 0), 0);
            const food = monthCourses.reduce((sum, c) => sum + (Number(c.foodPrice) || 0), 0);
            const comOrga = monthCourses.reduce((sum, c) => sum + (Number(c.comOrga) || 0), 0);
            const photos = monthCourses.reduce((sum, c) => sum + calculatePhotoCost(c.id), 0);
            const total = hotel + transport + food + comOrga + photos;

            const monthTotals = { hotel, transport, food, comOrga, photos, total };

            return (
              <Card key={monthKey}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">{monthKey}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-semibold">Course</th>
                          <th className="text-left p-2 font-semibold">Ville</th>
                          <th className="text-left p-2 font-semibold">Date</th>
                          <th className="text-right p-2 font-semibold">Hôtel</th>
                          <th className="text-right p-2 font-semibold">Transport</th>
                          <th className="text-right p-2 font-semibold">Nourriture</th>
                          <th className="text-right p-2 font-semibold">Com. Orga</th>
                          <th className="text-right p-2 font-semibold">Photographes</th>
                          <th className="text-right p-2 font-semibold bg-gray-50">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthCourses.map(course => {
                          const photoCost = calculatePhotoCost(course.id);
                          const hotelPrice = Number(course.hotelPrice) || 0;
                          const transportPrice = Number(course.transportPrice) || 0;
                          const foodPrice = Number(course.foodPrice) || 0;
                          const comOrga = Number(course.comOrga) || 0;
                          const totalCost = hotelPrice + transportPrice + foodPrice + comOrga + photoCost;

                          return (
                            <tr key={course.id} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{course.nom}</td>
                              <td className="p-2 text-muted-foreground">{course.ville}</td>
                              <td className="p-2 text-muted-foreground">
                                {format(new Date(course.dateDebut), 'dd/MM/yyyy')}
                              </td>
                              <td className="p-2 text-right">{formatCurrency(hotelPrice)}</td>
                              <td className="p-2 text-right">{formatCurrency(transportPrice)}</td>
                              <td className="p-2 text-right">{formatCurrency(foodPrice)}</td>
                              <td className="p-2 text-right">{formatCurrency(comOrga)}</td>
                              <td className="p-2 text-right">{formatCurrency(photoCost)}</td>
                              <td className="p-2 text-right font-bold bg-gray-50">{formatCurrency(totalCost)}</td>
                            </tr>
                          );
                        })}
                        {/* Ligne de total du mois */}
                        <tr className="bg-gray-100 font-bold">
                          <td colSpan={3} className="p-2">Total {monthKey}</td>
                          <td className="p-2 text-right">{formatCurrency(monthTotals.hotel)}</td>
                          <td className="p-2 text-right">{formatCurrency(monthTotals.transport)}</td>
                          <td className="p-2 text-right">{formatCurrency(monthTotals.food)}</td>
                          <td className="p-2 text-right">{formatCurrency(monthTotals.comOrga)}</td>
                          <td className="p-2 text-right">{formatCurrency(monthTotals.photos)}</td>
                          <td className="p-2 text-right bg-gray-200">{formatCurrency(monthTotals.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
