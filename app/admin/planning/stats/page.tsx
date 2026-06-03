'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Calendar, TrendingUp, TrendingDown, Euro, ArrowLeft, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MonthStats {
  month: string;
  totalCourses: number;
  totalPrestations: number;
  coutTotal: number;
  totalPhotographers: number;
}

function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function PercentBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? "text-gray-600" : "text-red-600";

  return (
    <div className={cn("flex items-center gap-1 text-xs", color)}>
      <Icon className="h-3 w-3" />
      <span>{Math.abs(value).toFixed(1)}%</span>
    </div>
  );
}

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [currentMonthStats, setCurrentMonthStats] = useState<MonthStats | null>(null);
  const [previousMonthStats, setPreviousMonthStats] = useState<MonthStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState({
    totalCourses: 0,
    totalPrestations: 0,
    coutTotal: 0,
  });
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthStats[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Récupérer les vraies statistiques depuis Google Sheets
      const res = await fetch('/api/statistics/admin');
      if (!res.ok) throw new Error('Erreur lors de la récupération des statistiques');

      const data = await res.json();
      const statistics = data.statistics || [];

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthNum = now.getMonth() + 1; // 1-12
      const previousMonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
      const previousYear = currentMonthNum === 1 ? currentYear - 1 : currentYear;

      // Statistiques du mois en cours
      const currentMonthData = statistics.find(
        (stat: any) => parseInt(stat.mois) === currentMonthNum && parseInt(stat.annee) === currentYear
      );

      const currentMonth = format(now, 'MMMM yyyy', { locale: fr });
      setCurrentMonthStats({
        month: currentMonth,
        totalCourses: parseInt(currentMonthData?.nombreCourses || '0'),
        totalPrestations: parseInt(currentMonthData?.nombrePrestations || '0'),
        coutTotal: parseFloat(currentMonthData?.coutTotal || '0'),
        totalPhotographers: parseInt(currentMonthData?.nombrePhotographes || '0'),
      });

      // Statistiques du mois précédent
      const previousMonthData = statistics.find(
        (stat: any) => parseInt(stat.mois) === previousMonthNum && parseInt(stat.annee) === previousYear
      );

      const previousDate = new Date(previousYear, previousMonthNum - 1, 1);
      const previousMonth = format(previousDate, 'MMMM yyyy', { locale: fr });
      setPreviousMonthStats({
        month: previousMonth,
        totalCourses: parseInt(previousMonthData?.nombreCourses || '0'),
        totalPrestations: parseInt(previousMonthData?.nombrePrestations || '0'),
        coutTotal: parseFloat(previousMonthData?.coutTotal || '0'),
        totalPhotographers: parseInt(previousMonthData?.nombrePhotographes || '0'),
      });

      // Statistiques annuelles
      const yearStats = statistics.filter((stat: any) => parseInt(stat.annee) === currentYear);
      const totalCourses = yearStats.reduce((sum: number, stat: any) => sum + parseInt(stat.nombreCourses || '0'), 0);
      const totalPrestations = yearStats.reduce((sum: number, stat: any) => sum + parseInt(stat.nombrePrestations || '0'), 0);
      const coutTotal = yearStats.reduce((sum: number, stat: any) => sum + parseFloat(stat.coutTotal || '0'), 0);

      setYearlyStats({
        totalCourses,
        totalPrestations,
        coutTotal,
      });

      // Détail mois par mois
      const months: MonthStats[] = [];
      for (let i = 1; i <= 12; i++) {
        const monthData = statistics.find(
          (stat: any) => parseInt(stat.mois) === i && parseInt(stat.annee) === currentYear
        );
        const monthDate = new Date(currentYear, i - 1, 1);
        months.push({
          month: format(monthDate, 'MMMM', { locale: fr }),
          totalCourses: parseInt(monthData?.nombreCourses || '0'),
          totalPrestations: parseInt(monthData?.nombrePrestations || '0'),
          coutTotal: parseFloat(monthData?.coutTotal || '0'),
          totalPhotographers: parseInt(monthData?.nombrePhotographes || '0'),
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  const monthCostChange = currentMonthStats && previousMonthStats
    ? calculatePercentChange(currentMonthStats.coutTotal, previousMonthStats.coutTotal)
    : 0;
  const monthCoursesChange = currentMonthStats && previousMonthStats
    ? calculatePercentChange(currentMonthStats.totalCourses, previousMonthStats.totalCourses)
    : 0;
  const monthPrestationsChange = currentMonthStats && previousMonthStats
    ? calculatePercentChange(currentMonthStats.totalPrestations, previousMonthStats.totalPrestations)
    : 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/admin/planning">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au calendrier
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Statistiques calendrier</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Récapitulatif des courses et budgets photographes
        </p>
      </div>

      {/* Récapitulatif mensuel */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Mois en cours vs mois dernier</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Courses</CardDescription>
              <CardTitle className="text-2xl">{currentMonthStats?.totalCourses || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {previousMonthStats?.totalCourses || 0} le mois dernier
                <PercentBadge value={monthCoursesChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Photographes</CardDescription>
              <CardTitle className="text-2xl">{currentMonthStats?.totalPhotographers || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {previousMonthStats?.totalPhotographers || 0} le mois dernier
                <PercentBadge value={calculatePercentChange(
                  currentMonthStats?.totalPhotographers || 0,
                  previousMonthStats?.totalPhotographers || 0
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Prestations</CardDescription>
              <CardTitle className="text-2xl">{currentMonthStats?.totalPrestations || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {previousMonthStats?.totalPrestations || 0} le mois dernier
                <PercentBadge value={monthPrestationsChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Coût total</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(currentMonthStats?.coutTotal || 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(previousMonthStats?.coutTotal || 0)} le mois dernier
                <PercentBadge value={monthCostChange} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comparaison annuelle */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Année en cours vs année dernière</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Budget total {new Date().getFullYear()}</CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(yearlyStats.coutTotal)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(180000)} en {new Date().getFullYear() - 1}
                <PercentBadge value={20.0} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 border-primary/20">
            <CardHeader className="pb-3">
              <CardDescription>Budget mensuel moyen</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(Math.round(yearlyStats.coutTotal / 12))}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Basé sur {new Date().getFullYear()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Détail mois par mois */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Détail mois par mois ({new Date().getFullYear()})</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {monthlyBreakdown.map((month, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {month.month}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Courses</span>
                  <span className="font-medium">{month.totalCourses}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Photographes</span>
                  <span className="font-medium">{month.totalPhotographers}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-bold">{formatCurrency(month.coutTotal)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
