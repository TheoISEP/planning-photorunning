'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, TrendingUp, Euro, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MonthStats {
  month: string;
  coursesValidees: number;
  CA: number;
  details?: Array<{
    courseName: string;
    date: string;
    montant: number;
    isTeamLeader: boolean;
  }>;
}

export default function PhotographerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentMonthStats, setCurrentMonthStats] = useState<MonthStats | null>(null);
  const [previousMonthStats, setPreviousMonthStats] = useState<MonthStats | null>(null);
  const [pendingStats, setPendingStats] = useState({ courses: 0, CA: 0 });
  const [yearlyStats, setYearlyStats] = useState({
    totalCourses: 0,
    CATotal: 0,
    moyenneMensuelle: 0,
  });
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthStats[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Récupérer les vraies statistiques depuis Google Sheets
      const res = await fetch('/api/statistics/photographer');
      if (!res.ok) throw new Error('Erreur lors de la récupération des statistiques');

      const data = await res.json();
      const statistics = data.statistics || [];

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthNum = now.getMonth() + 1; // 1-12
      const previousMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;

      // Statistiques du mois en cours
      const currentMonthData = statistics.find(
        (stat: any) => parseInt(stat.mois) === currentMonthNum && parseInt(stat.annee) === currentYear
      );

      const currentMonth = format(now, 'MMMM yyyy', { locale: fr });
      setCurrentMonthStats({
        month: currentMonth,
        coursesValidees: parseInt(currentMonthData?.nombreCourses || '0'),
        CA: parseFloat(currentMonthData?.montantTotal || '0'),
      });

      // Statistiques du mois précédent
      const previousMonthData = statistics.find(
        (stat: any) => parseInt(stat.mois) === previousMonthNum && parseInt(stat.annee) === currentYear
      );

      const previousDate = new Date(currentYear, previousMonthNum - 1, 1);
      const previousMonth = format(previousDate, 'MMMM yyyy', { locale: fr });
      setPreviousMonthStats({
        month: previousMonth,
        coursesValidees: parseInt(previousMonthData?.nombreCourses || '0'),
        CA: parseFloat(previousMonthData?.montantTotal || '0'),
      });

      // Calculer "En attente" depuis les disponibilités
      const dispoRes = await fetch('/api/disponibilites');
      if (dispoRes.ok) {
        const dispoData = await dispoRes.json();
        const disponibilites = dispoData.disponibilites || [];
        const pending = disponibilites.filter((d: any) => d.statut === 'available');

        let pendingCA = 0;
        pending.forEach((d: any) => {
          if (d.course) {
            pendingCA += d.course.tarifPhotographe || 0;
          }
        });

        setPendingStats({
          courses: pending.length,
          CA: pendingCA,
        });
      }

      // Statistiques annuelles
      const yearStats = statistics.filter((stat: any) => parseInt(stat.annee) === currentYear);
      const totalCourses = yearStats.reduce((sum: number, stat: any) => sum + parseInt(stat.nombreCourses || '0'), 0);
      const CATotal = yearStats.reduce((sum: number, stat: any) => sum + parseFloat(stat.montantTotal || '0'), 0);
      const moyenneMensuelle = yearStats.length > 0 ? CATotal / yearStats.length : 0;

      setYearlyStats({
        totalCourses,
        CATotal,
        moyenneMensuelle,
      });

      // Détail mois par mois
      const months: MonthStats[] = [];
      for (let i = 1; i <= 12; i++) {
        const monthData = statistics.find(
          (stat: any) => parseInt(stat.mois) === i && parseInt(stat.annee) === currentYear
        );
        const monthDate = new Date(currentYear, i - 1, 1);
        months.push({
          month: format(monthDate, 'MMMM yyyy', { locale: fr }),
          coursesValidees: parseInt(monthData?.nombreCourses || '0'),
          CA: parseFloat(monthData?.montantTotal || '0'),
        });
      }
      setMonthlyBreakdown(months);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Mes statistiques</h1>
        <p className="text-sm text-gray-600 mt-1">Suivez votre activité et vos revenus</p>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6 space-y-8">
        {/* Section 1: Évolution mensuelle */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Évolution mensuelle</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Mois en cours */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base capitalize">{currentMonthStats?.month}</CardTitle>
                <CardDescription>Mois en cours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Courses validées</span>
                  <span className="text-lg font-bold text-gray-900">
                    {currentMonthStats?.coursesValidees}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">CA du mois</span>
                  <span className="text-lg font-bold text-gray-600">
                    {formatCurrency(currentMonthStats?.CA || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Mois dernier */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base capitalize">{previousMonthStats?.month}</CardTitle>
                <CardDescription>Mois dernier</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Courses validées</span>
                  <span className="text-lg font-bold text-gray-900">
                    {previousMonthStats?.coursesValidees}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">CA du mois</span>
                  <span className="text-lg font-bold text-gray-600">
                    {formatCurrency(previousMonthStats?.CA || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* En attente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">En attente</CardTitle>
                <CardDescription>Courses en attente de validation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Courses</span>
                  <span className="text-lg font-bold text-gray-900">{pendingStats.courses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">CA potentiel</span>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(pendingStats.CA)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 2: Récapitulatif annuel */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Récapitulatif année {new Date().getFullYear()}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total courses</CardTitle>
                <Calendar className="h-5 w-5 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{yearlyStats.totalCourses}</div>
                <p className="text-xs text-gray-500 mt-1">Courses validées</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">CA annuel</CardTitle>
                <Euro className="h-5 w-5 text-gray-700" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {formatCurrency(yearlyStats.CATotal)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Revenus totaux</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Moyenne mensuelle
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-gray-800" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {formatCurrency(yearlyStats.moyenneMensuelle)}
                </div>
                <p className="text-xs text-gray-500 mt-1">CA moyen/mois</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 3: Détail mois par mois */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Détail mois par mois</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthlyBreakdown.map((month, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="text-base capitalize">{month.month}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Courses</span>
                    <span className="font-medium text-gray-900">{month.coursesValidees}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-600">CA</span>
                    <span className="font-bold text-gray-900">{formatCurrency(month.CA)}</span>
                  </div>

                  {/* Tooltip au survol - details */}
                  {month.details && month.details.length > 0 && (
                    <div className="hidden group-hover:block absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 -mt-2">
                      <p className="text-xs font-medium text-gray-900 mb-2">Détail des courses :</p>
                      <div className="space-y-1">
                        {month.details.map((detail, i) => (
                          <div key={i} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700">{detail.courseName}</span>
                              {detail.isTeamLeader && <Star className="h-3 w-3 text-purple-600" />}
                            </div>
                            <div className="flex justify-between text-gray-600">
                              <span>{format(new Date(detail.date), 'd MMM', { locale: fr })}</span>
                              <span className="font-medium">{formatCurrency(detail.montant)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
