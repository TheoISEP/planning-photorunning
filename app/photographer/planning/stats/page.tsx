'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { Calendar, TrendingUp, TrendingDown, ArrowLeft, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MonthStats {
  month: string;
  nombreCourses: number;
  nombrePrestations: number;
  montantTotal: number;
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

export default function PhotographerStatsPage() {
  const [loading, setLoading] = useState(true);
  const [currentMonthStats, setCurrentMonthStats] = useState<MonthStats | null>(null);
  const [previousMonthStats, setPreviousMonthStats] = useState<MonthStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState({
    nombreCourses: 0,
    nombrePrestations: 0,
    montantTotal: 0,
  });
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<MonthStats[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);

      // Récupérer les statistiques du photographe connecté depuis Google Sheets
      const res = await fetch('/api/statistics/photographer');
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
        nombreCourses: parseInt(currentMonthData?.nombreCourses || '0'),
        nombrePrestations: parseInt(currentMonthData?.nombrePrestations || '0'),
        montantTotal: parseFloat(currentMonthData?.montantTotal || '0'),
      });

      // Statistiques du mois précédent
      const previousMonthData = statistics.find(
        (stat: any) => parseInt(stat.mois) === previousMonthNum && parseInt(stat.annee) === previousYear
      );

      const previousDate = new Date(previousYear, previousMonthNum - 1, 1);
      const previousMonth = format(previousDate, 'MMMM yyyy', { locale: fr });
      setPreviousMonthStats({
        month: previousMonth,
        nombreCourses: parseInt(previousMonthData?.nombreCourses || '0'),
        nombrePrestations: parseInt(previousMonthData?.nombrePrestations || '0'),
        montantTotal: parseFloat(previousMonthData?.montantTotal || '0'),
      });

      // Statistiques annuelles
      const yearStats = statistics.filter((stat: any) => parseInt(stat.annee) === currentYear);
      const nombreCourses = yearStats.reduce((sum: number, stat: any) => sum + parseInt(stat.nombreCourses || '0'), 0);
      const nombrePrestations = yearStats.reduce((sum: number, stat: any) => sum + parseInt(stat.nombrePrestations || '0'), 0);
      const montantTotal = yearStats.reduce((sum: number, stat: any) => sum + parseFloat(stat.montantTotal || '0'), 0);

      setYearlyStats({
        nombreCourses,
        nombrePrestations,
        montantTotal,
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
          nombreCourses: parseInt(monthData?.nombreCourses || '0'),
          nombrePrestations: parseInt(monthData?.nombrePrestations || '0'),
          montantTotal: parseFloat(monthData?.montantTotal || '0'),
        });
      }
      setMonthlyBreakdown(months);
    } catch (error) {
      // Erreur chargement stats
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

  const monthAmountChange = currentMonthStats && previousMonthStats
    ? calculatePercentChange(currentMonthStats.montantTotal, previousMonthStats.montantTotal)
    : 0;
  const monthCoursesChange = currentMonthStats && previousMonthStats
    ? calculatePercentChange(currentMonthStats.nombreCourses, previousMonthStats.nombreCourses)
    : 0;
  const monthPrestationsChange = currentMonthStats && previousMonthStats
    ? calculatePercentChange(currentMonthStats.nombrePrestations, previousMonthStats.nombrePrestations)
    : 0;

  return (
    <div className="h-full overflow-y-auto space-y-6 pb-6">
      {/* En-tête */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/photographer/planning">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au calendrier
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Mes statistiques</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Récapitulatif de mes prestations et revenus
        </p>
      </div>

      {/* Récapitulatif mensuel */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Mois en cours vs mois dernier</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Courses</CardDescription>
              <CardTitle className="text-2xl">{currentMonthStats?.nombreCourses || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {previousMonthStats?.nombreCourses || 0} le mois dernier
                <PercentBadge value={monthCoursesChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Prestations</CardDescription>
              <CardTitle className="text-2xl">{currentMonthStats?.nombrePrestations || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {previousMonthStats?.nombrePrestations || 0} le mois dernier
                <PercentBadge value={monthPrestationsChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Revenus</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(currentMonthStats?.montantTotal || 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {formatCurrency(previousMonthStats?.montantTotal || 0)} le mois dernier
                <PercentBadge value={monthAmountChange} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Récapitulatif annuel */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Performance {new Date().getFullYear()}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-gray-500/10 to-gray-600/20 dark:from-gray-500/20 dark:to-gray-600/30 border-gray-500/30">
            <CardHeader className="pb-3">
              <CardDescription>Revenus totaux {new Date().getFullYear()}</CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(yearlyStats.montantTotal)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Moyenne mensuelle : {formatCurrency(Math.round(yearlyStats.montantTotal / 12))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/20 dark:from-purple-500/20 dark:to-purple-600/30 border-purple-500/30">
            <CardHeader className="pb-3">
              <CardDescription>Prestations totales</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Award className="h-8 w-8 text-purple-600" />
                {yearlyStats.nombrePrestations}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {yearlyStats.nombreCourses} courses
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
                  <span className="font-medium">{month.nombreCourses}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prestations</span>
                  <span className="font-medium">{month.nombrePrestations}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-muted-foreground">Revenus</span>
                  <span className="font-bold text-gray-600">{formatCurrency(month.montantTotal)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
