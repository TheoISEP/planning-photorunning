'use client';

// Costs management page with monthly software cost tracking
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Euro, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';

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

interface MonthlySoftCost {
  month: string; // Format: "YYYY-MM"
  softCost: number;
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

interface Admin {
  id: string;
  nom: string;
  prenom: string;
  nonRemunere?: boolean | string;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function CostsRecapPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [disponibilites, setDisponibilites] = useState<Disponibilite[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    hotelPrice: string;
    transportPrice: string;
    foodPrice: string;
    comOrga: string;
  }>({
    hotelPrice: '',
    transportPrice: '',
    foodPrice: '',
    comOrga: '',
  });
  const [monthlySoftCosts, setMonthlySoftCosts] = useState<Record<string, number>>({});
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editingSoftCost, setEditingSoftCost] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [coursesRes, tarifsRes, disponibilitesRes, adminsRes, statsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/tarifs'),
        fetch('/api/disponibilites'),
        fetch('/api/admins'),
        fetch('/api/admin-stats'),
      ]);

      const [coursesData, tarifsData, disponibilitesData, adminsData, statsData] = await Promise.all([
        coursesRes.json(),
        tarifsRes.json(),
        disponibilitesRes.json(),
        adminsRes.json(),
        statsRes.json(),
      ]);

      setCourses(coursesData.courses || []);
      setTarifs(tarifsData.tarifs || []);
      setDisponibilites(disponibilitesData.disponibilites || []);
      setAdmins(adminsData.admins || []);

      // Charger les coûts logiciels mensuels
      const softCosts: Record<string, number> = {};
      if (statsData.stats) {
        statsData.stats.forEach((stat: any) => {
          if (stat.month && stat.softCost) {
            softCosts[stat.month] = Number(stat.softCost) || 0;
          }
        });
      }
      setMonthlySoftCosts(softCosts);
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

  const startEditing = (course: Course) => {
    setEditingCourse(course.id);
    setEditValues({
      hotelPrice: course.hotelPrice || '0',
      transportPrice: course.transportPrice || '0',
      foodPrice: course.foodPrice || '0',
      comOrga: course.comOrga || '0',
    });
  };

  const cancelEditing = () => {
    setEditingCourse(null);
    setEditValues({
      hotelPrice: '',
      transportPrice: '',
      foodPrice: '',
      comOrga: '',
    });
  };

  const startEditingSoftCost = (monthIndex: number) => {
    const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    setEditingMonth(monthIndex);
    setEditingSoftCost(String(monthlySoftCosts[monthKey] || 0));
  };

  const cancelEditingSoftCost = () => {
    setEditingMonth(null);
    setEditingSoftCost('');
  };

  const saveSoftCost = async (monthIndex: number) => {
    try {
      const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;

      const res = await fetch('/api/admin-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: monthKey,
          softCost: editingSoftCost,
        }),
      });

      if (res.ok) {
        // Mettre à jour l'état local
        setMonthlySoftCosts({
          ...monthlySoftCosts,
          [monthKey]: Number(editingSoftCost) || 0,
        });
        cancelEditingSoftCost();
      } else {
        console.error('Erreur sauvegarde coût logiciel');
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const saveCosts = async (courseId: string) => {
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelPrice: editValues.hotelPrice,
          transportPrice: editValues.transportPrice,
          foodPrice: editValues.foodPrice,
          comOrga: editValues.comOrga,
        }),
      });

      if (res.ok) {
        // Mettre à jour l'état local
        setCourses(courses.map(c =>
          c.id === courseId
            ? { ...c, ...editValues }
            : c
        ));
        cancelEditing();
      } else {
        console.error('Erreur sauvegarde coûts');
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  // Filtrer les courses pour l'année sélectionnée (y compris archivées)
  const yearCourses = courses.filter(c => {
    const courseYear = new Date(c.dateDebut).getFullYear();
    return courseYear === selectedYear;
  });

  // Regrouper par mois (0-11)
  const coursesByMonth = yearCourses.reduce((acc, course) => {
    const date = new Date(course.dateDebut);
    const month = date.getMonth(); // 0-11

    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(course);
    return acc;
  }, {} as Record<number, Course[]>);

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

  // Calculer les totaux pour un mois
  const calculateMonthTotals = (monthCourses: Course[], monthIndex: number) => {
    const hotel = monthCourses.reduce((sum, c) => sum + (Number(c.hotelPrice) || 0), 0);
    const transport = monthCourses.reduce((sum, c) => sum + (Number(c.transportPrice) || 0), 0);
    const food = monthCourses.reduce((sum, c) => sum + (Number(c.foodPrice) || 0), 0);
    const comOrga = monthCourses.reduce((sum, c) => sum + (Number(c.comOrga) || 0), 0);
    const photos = monthCourses.reduce((sum, c) => sum + calculatePhotoCost(c.id), 0);

    // Récupérer le coût logiciel mensuel
    const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    const softCost = monthlySoftCosts[monthKey] || 0;

    const total = hotel + transport + food + comOrga + softCost + photos;

    return { hotel, transport, food, comOrga, softCost, photos, total };
  };

  // Calculer le total annuel
  const calculateYearTotal = () => {
    let hotelTotal = 0;
    let transportTotal = 0;
    let foodTotal = 0;
    let comOrgaTotal = 0;
    let softCostTotal = 0;
    let photosTotal = 0;

    yearCourses.forEach(course => {
      hotelTotal += Number(course.hotelPrice) || 0;
      transportTotal += Number(course.transportPrice) || 0;
      foodTotal += Number(course.foodPrice) || 0;
      comOrgaTotal += Number(course.comOrga) || 0;
      photosTotal += calculatePhotoCost(course.id);
    });

    // Calculer le total des coûts logiciels pour l'année
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
      softCostTotal += monthlySoftCosts[monthKey] || 0;
    }

    return {
      hotelTotal,
      transportTotal,
      foodTotal,
      comOrgaTotal,
      softCostTotal,
      photosTotal,
      grandTotal: hotelTotal + transportTotal + foodTotal + comOrgaTotal + softCostTotal + photosTotal,
    };
  };

  const yearTotals = calculateYearTotal();

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
      {/* En-tête avec navigation années */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Récapitulatif des coûts</h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble des coûts par mois pour l&apos;année {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/costs/ranking')}
            className="gap-2"
          >
            <Trophy className="h-4 w-4" />
            Classement photographes
          </Button>
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
      </div>

      {/* Totaux annuels */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hôtels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(yearTotals.hotelTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(yearTotals.transportTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nourriture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(yearTotals.foodTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com. Orga</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(yearTotals.comOrgaTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Logiciel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(yearTotals.softCostTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Photographes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(yearTotals.photosTotal)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Euro className="h-4 w-4" />
              TOTAL {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(yearTotals.grandTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau mensuel */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Détail mensuel</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 font-semibold">Mois</th>
                <th className="text-center p-3 font-semibold">Nb Courses</th>
                <th className="text-right p-3 font-semibold">Hôtel</th>
                <th className="text-right p-3 font-semibold">Transport</th>
                <th className="text-right p-3 font-semibold">Nourriture</th>
                <th className="text-right p-3 font-semibold">Com. Orga</th>
                <th className="text-right p-3 font-semibold">Logiciel</th>
                <th className="text-right p-3 font-semibold">Photographes</th>
                <th className="text-right p-3 font-semibold bg-gray-100">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {MONTH_NAMES.map((monthName, monthIndex) => {
                const monthCourses = coursesByMonth[monthIndex] || [];
                const totals = calculateMonthTotals(monthCourses, monthIndex);
                const archivedCount = monthCourses.filter(c => c.archived === 'oui').length;
                const activeCount = monthCourses.length - archivedCount;
                const isEditingThisMonth = editingMonth === monthIndex;
                const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;

                return (
                  <tr
                    key={monthIndex}
                    className={`border-b hover:bg-gray-50 ${monthCourses.length === 0 ? 'text-gray-400' : ''}`}
                  >
                    <td className="p-3 font-medium">{monthName}</td>
                    <td className="p-3 text-center">
                      {monthCourses.length > 0 ? (
                        <div>
                          <div className="font-semibold">{monthCourses.length}</div>
                          {archivedCount > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              ({activeCount} actives + {archivedCount} archivées)
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {totals.hotel > 0 ? formatCurrency(totals.hotel) : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {totals.transport > 0 ? formatCurrency(totals.transport) : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {totals.food > 0 ? formatCurrency(totals.food) : '-'}
                    </td>
                    <td className="p-3 text-right">
                      {totals.comOrga > 0 ? formatCurrency(totals.comOrga) : '-'}
                    </td>
                    <td className="p-3 text-right cursor-pointer hover:bg-blue-50" onClick={() => !isEditingThisMonth && startEditingSoftCost(monthIndex)}>
                      {isEditingThisMonth ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            value={editingSoftCost}
                            onChange={(e) => setEditingSoftCost(e.target.value)}
                            className="w-20 px-2 py-1 text-right border rounded"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveSoftCost(monthIndex);
                            }}
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditingSoftCost();
                            }}
                            className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {totals.softCost > 0 ? formatCurrency(totals.softCost) : '-'}
                          <span className="text-xs text-gray-400">✎</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {totals.photos > 0 ? formatCurrency(totals.photos) : '-'}
                    </td>
                    <td className="p-3 text-right font-bold bg-gray-50">
                      {totals.total > 0 ? formatCurrency(totals.total) : '-'}
                    </td>
                  </tr>
                );
              })}
              {/* Ligne de total annuel */}
              <tr className="bg-gray-100 font-bold border-t-2">
                <td className="p-3">TOTAL {selectedYear}</td>
                <td className="p-3 text-center">
                  <div>
                    <div>{yearCourses.length}</div>
                    {(() => {
                      const archivedTotal = yearCourses.filter(c => c.archived === 'oui').length;
                      const activeTotal = yearCourses.length - archivedTotal;
                      if (archivedTotal > 0) {
                        return (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            ({activeTotal} actives + {archivedTotal} archivées)
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </td>
                <td className="p-3 text-right">{formatCurrency(yearTotals.hotelTotal)}</td>
                <td className="p-3 text-right">{formatCurrency(yearTotals.transportTotal)}</td>
                <td className="p-3 text-right">{formatCurrency(yearTotals.foodTotal)}</td>
                <td className="p-3 text-right">{formatCurrency(yearTotals.comOrgaTotal)}</td>
                <td className="p-3 text-right">{formatCurrency(yearTotals.softCostTotal)}</td>
                <td className="p-3 text-right">{formatCurrency(yearTotals.photosTotal)}</td>
                <td className="p-3 text-right bg-gray-200">{formatCurrency(yearTotals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Détail par mois (expandable) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Détail des courses par mois</h2>
        {MONTH_NAMES.map((monthName, monthIndex) => {
          const monthCourses = coursesByMonth[monthIndex] || [];

          if (monthCourses.length === 0) return null;

          const totals = calculateMonthTotals(monthCourses, monthIndex);

          return (
            <Card key={monthIndex}>
              <CardHeader>
                <CardTitle className="text-lg">{monthName} {selectedYear}</CardTitle>
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
                        <th className="text-center p-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthCourses.map(course => {
                        const photoCost = calculatePhotoCost(course.id);
                        const isEditing = editingCourse === course.id;
                        const hotelPrice = Number(isEditing ? editValues.hotelPrice : course.hotelPrice) || 0;
                        const transportPrice = Number(isEditing ? editValues.transportPrice : course.transportPrice) || 0;
                        const foodPrice = Number(isEditing ? editValues.foodPrice : course.foodPrice) || 0;
                        const comOrga = Number(isEditing ? editValues.comOrga : course.comOrga) || 0;
                        const totalCost = hotelPrice + transportPrice + foodPrice + comOrga + photoCost;

                        return (
                          <tr key={course.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium">{course.nom}</td>
                            <td className="p-2 text-muted-foreground">{course.ville}</td>
                            <td className="p-2 text-muted-foreground">
                              {format(new Date(course.dateDebut), 'dd/MM/yyyy')}
                            </td>
                            <td className="p-2 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editValues.hotelPrice}
                                  onChange={(e) => setEditValues({ ...editValues, hotelPrice: e.target.value })}
                                  className="w-20 px-2 py-1 text-right border rounded"
                                />
                              ) : (
                                formatCurrency(hotelPrice)
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editValues.transportPrice}
                                  onChange={(e) => setEditValues({ ...editValues, transportPrice: e.target.value })}
                                  className="w-20 px-2 py-1 text-right border rounded"
                                />
                              ) : (
                                formatCurrency(transportPrice)
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editValues.foodPrice}
                                  onChange={(e) => setEditValues({ ...editValues, foodPrice: e.target.value })}
                                  className="w-20 px-2 py-1 text-right border rounded"
                                />
                              ) : (
                                formatCurrency(foodPrice)
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editValues.comOrga}
                                  onChange={(e) => setEditValues({ ...editValues, comOrga: e.target.value })}
                                  className="w-20 px-2 py-1 text-right border rounded"
                                />
                              ) : (
                                formatCurrency(comOrga)
                              )}
                            </td>
                            <td className="p-2 text-right">{formatCurrency(photoCost)}</td>
                            <td className="p-2 text-right font-bold bg-gray-50">{formatCurrency(totalCost)}</td>
                            <td className="p-2 text-center">
                              {isEditing ? (
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => saveCosts(course.id)}
                                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                  >
                                    Sauv.
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditing(course)}
                                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  Éditer
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Ligne de total du mois */}
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan={3} className="p-2">Total {monthName}</td>
                        <td className="p-2 text-right">{formatCurrency(totals.hotel)}</td>
                        <td className="p-2 text-right">{formatCurrency(totals.transport)}</td>
                        <td className="p-2 text-right">{formatCurrency(totals.food)}</td>
                        <td className="p-2 text-right">{formatCurrency(totals.comOrga)}</td>
                        <td className="p-2 text-right">{formatCurrency(totals.photos)}</td>
                        <td className="p-2 text-right bg-gray-200">{formatCurrency(totals.total)}</td>
                        <td className="p-2"></td>
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
