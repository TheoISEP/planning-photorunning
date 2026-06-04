'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Calendar, MapPin, FileText, Users, Euro, Star, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/calendrier/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Course {
  id: string;
  nom: string;
  description?: string;
  localisation: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  coureursAttendus?: number;
  briefPdfUrl?: string;
  statutTraitement?: 'inProgress' | 'done';
}

interface Tarif {
  tarifPhotographe: number;
  bonusChefEquipe: number;
}

interface Disponibilite {
  id: string;
  statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected';
  dateDeclaration?: string;
}

interface TeamMember {
  id: string;
  photographeId: string;
  prenom: string;
  nom: string;
  statut: string;
}

interface Photographer {
  id: string;
  prenom: string;
  nom: string;
}

export default function PhotographerCourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [tarif, setTarif] = useState<Tarif | null>(null);
  const [disponibilite, setDisponibilite] = useState<Disponibilite | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [photographers, setPhotographers] = useState<Photographer[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Récupérer l'utilisateur connecté
      const userRes = await fetch('/api/auth/me');
      let userId: string | null = null;
      if (userRes.ok) {
        const userData = await userRes.json();
        userId = userData.user.id;
        setCurrentUserId(userId);
      }

      // Récupérer tous les photographes et admins pour les noms
      const [photographersRes, adminsRes] = await Promise.all([
        fetch('/api/photographers'),
        fetch('/api/admins'),
      ]);

      const photographersData = await photographersRes.json();
      const adminsData = await adminsRes.json();

      const allPhotographers = photographersData.photographers || [];
      const allAdmins = adminsData.admins || [];
      const allPeople = [...allPhotographers, ...allAdmins];

      setPhotographers(allPeople);

      // Récupérer la course
      const courseRes = await fetch(`/api/courses/${courseId}`);
      if (courseRes.ok) {
        const courseData = await courseRes.json();
        setCourse(courseData.course);
      }

      // Récupérer le tarif de la course
      const tarifRes = await fetch(`/api/tarifs?courseId=${courseId}`);
      if (tarifRes.ok) {
        const tarifData = await tarifRes.json();
        if (tarifData.tarifs && tarifData.tarifs.length > 0) {
          setTarif({
            tarifPhotographe: Number(tarifData.tarifs[0].tarifPhotographe) || 0,
            bonusChefEquipe: Number(tarifData.tarifs[0].bonusChefEquipe) || 0,
          });
        }
      }

      // Récupérer les disponibilités
      const dispoRes = await fetch(`/api/disponibilites?courseId=${courseId}`);
      if (dispoRes.ok) {
        const dispoData = await dispoRes.json();
        if (dispoData.disponibilites && userId) {
          // Trouver MA disponibilité (celle du photographe connecté)
          const myDispo = dispoData.disponibilites.find(
            (d: any) => d.photographeId === userId
          );
          if (myDispo) {
            setDisponibilite(myDispo);
          }

          // Récupérer l'équipe (tous les photographes validés ou chefs)
          const validatedMembers = dispoData.disponibilites.filter(
            (d: any) => d.statut === 'validated' || d.statut === 'teamLeader'
          );

          // Mapper et filtrer seulement les membres dont on trouve les données
          // Utiliser un Set pour éviter les doublons basés sur photographeId
          const seenIds = new Set<string>();
          const teamWithNames: TeamMember[] = [];

          validatedMembers.forEach((d: any) => {
            // Éviter les doublons
            if (seenIds.has(d.photographeId)) return;
            seenIds.add(d.photographeId);

            const person = allPeople.find((p: any) => p.id === d.photographeId);

            // Si la personne est trouvée, l'ajouter à l'équipe
            if (person) {
              teamWithNames.push({
                id: d.id,
                photographeId: d.photographeId,
                prenom: person.prenom,
                nom: person.nom,
                statut: d.statut,
              });
            }
          });

          setTeam(teamWithNames);
        }
      }
    } catch (error) {
      // Erreur silencieuse en production
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeclareAvailability = async (newStatus: 'available' | 'unavailable') => {
    if (!disponibilite) return;

    try {
      const res = await fetch('/api/disponibilites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: disponibilite.id,
          statut: newStatus,
          dateModification: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setDisponibilite({ ...disponibilite, statut: newStatus });
      }
    } catch (error) {
      // Erreur silencieuse
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

  const getInitials = (prenom: string, nom: string) => {
    if (!prenom || !nom) return '?';
    return `${prenom[0] || '?'}${nom[0] || '?'}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!course || !disponibilite || !tarif) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Course introuvable</p>
          <Link href="/photographer/planning" className="mt-4 inline-block">
            <Button variant="outline">Retour au planning</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isValidated = disponibilite.statut === 'validated' || disponibilite.statut === 'teamLeader';

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <Link href="/photographer/planning">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <StatusBadge variant={disponibilite.statut} />
            </div>
            <h1 className="text-2xl font-bold">{course.nom}</h1>
            <p className="text-sm text-muted-foreground mt-1">{course.localisation}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Détails de la course */}
            <Card>
              <CardHeader>
                <CardTitle>Détails de la course</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Dates</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(course.dateDebut), 'd MMMM yyyy à HH:mm', { locale: fr })} -{' '}
                      {format(new Date(course.dateFin), 'd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Localisation</p>
                    {course.localisation && course.ville && course.localisation !== course.ville ? (
                      <>
                        <p className="text-sm text-muted-foreground">{course.localisation}</p>
                        <p className="text-sm text-muted-foreground">{course.ville}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{course.localisation || course.ville}</p>
                    )}
                  </div>
                </div>

                {course.description && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Description</p>
                      <p className="text-sm text-muted-foreground">{course.description}</p>
                    </div>
                  </div>
                )}

                {course.coureursAttendus && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Coureurs attendus</p>
                      <p className="text-sm text-muted-foreground">
                        {course.coureursAttendus.toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Équipe assignée */}
            {team.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Équipe assignée ({team.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {team.map((member) => {
                      const isCurrentUser = member.photographeId === currentUserId;
                      return (
                        <div
                          key={member.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                            isCurrentUser
                              ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20"
                              : "bg-card hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className={member.statut === 'teamLeader' ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}>
                                {getInitials(member.prenom, member.nom)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {member.prenom} {member.nom}
                                {isCurrentUser && <span className="text-xs text-blue-600 ml-2 font-semibold">(Vous)</span>}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {member.statut === 'teamLeader' ? (
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3 text-purple-500" />
                                    Chef d'équipe
                                  </span>
                                ) : (
                                  'Photographe'
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Colonne droite (1/3) */}
          <div className="space-y-6">
            {/* Récapitulatif */}
            <Card>
              <CardHeader>
                <CardTitle>Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut actuel</span>
                  <StatusBadge variant={disponibilite.statut} showIcon={false} />
                </div>
                {disponibilite.dateDeclaration && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date de déclaration</span>
                    <span className="font-medium">
                      {format(new Date(disponibilite.dateDeclaration), 'd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disponibilité */}
            <Card>
              <CardHeader>
                <CardTitle>Ma disponibilité</CardTitle>
              </CardHeader>
              <CardContent>
                {disponibilite.statut === 'pending' && (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handleDeclareAvailability('available')}
                    >
                      Je suis disponible
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleDeclareAvailability('unavailable')}
                    >
                      Pas disponible
                    </Button>
                  </div>
                )}

                {disponibilite.statut === 'available' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 font-medium">Disponibilité déclarée</p>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleDeclareAvailability('unavailable')}
                    >
                      Annuler ma disponibilité
                    </Button>
                  </div>
                )}

                {disponibilite.statut === 'unavailable' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Non disponible</p>
                    <Button
                      className="w-full"
                      onClick={() => handleDeclareAvailability('available')}
                    >
                      Je suis finalement disponible
                    </Button>
                  </div>
                )}

                {disponibilite.statut === 'validated' && (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <p className="text-sm text-gray-800 font-medium">
                      ✓ Vous êtes affecté à cette course
                    </p>
                  </div>
                )}

                {disponibilite.statut === 'teamLeader' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                    <p className="text-sm text-purple-800 font-medium">
                      👑 Vous êtes chef d'équipe
                    </p>
                  </div>
                )}

                {disponibilite.statut === 'rejected' && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-800">
                      Vous n'avez pas été retenu pour cette course
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Brief de course (seulement si validé ET qu'il y a un brief) */}
            {isValidated && course.briefPdfUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Brief de course</CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href={course.briefPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Voir le brief PDF
                    </Button>
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
