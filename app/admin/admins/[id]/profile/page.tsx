'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, CreditCard, Camera, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Admin {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  dateNaissance?: string;
  dateInscription: string;
  actif: boolean;
  nonRemunere?: boolean | string;
  cameras?: string;
  objectifs?: string;
  cartesMemoire?: string;
  flashs?: string;
  flyingBlue?: string;
  flyingBlueExpiry?: string;
  sncf?: string;
  sncfExpiry?: string;
}

export default function AdminProfilePage() {
  const router = useRouter();
  const params = useParams();
  const adminId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    fetchAdmin();
  }, [adminId]);

  const fetchAdmin = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admins/${adminId}`);
      if (res.ok) {
        const data = await res.json();
        setAdmin(data.admin);
      }
    } catch (error) {
      console.error('Erreur chargement admin:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseJsonOrEmpty = (data?: string | string[]): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const isExpired = (date?: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate < thirtyDaysFromNow && expiryDate >= new Date();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Admin introuvable</p>
          <Link href="/admin/admins" className="mt-4 inline-block">
            <Button variant="outline">Retour à la liste</Button>
          </Link>
        </div>
      </div>
    );
  }

  const cameras = parseJsonOrEmpty(admin.cameras);
  const objectifs = parseJsonOrEmpty(admin.objectifs);
  const cartesMemoire = parseJsonOrEmpty(admin.cartesMemoire);
  const flashs = parseJsonOrEmpty(admin.flashs);

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <Link href="/admin/admins">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
              {admin.actif ? (
                <Badge className="bg-gray-100 text-gray-800 border-gray-300">Actif</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 border-gray-300">Inactif</Badge>
              )}
              {admin.nonRemunere === 'TRUE' || admin.nonRemunere === true ? (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">Non rémunéré</Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-gray-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                {admin.prenom} {admin.nom}
              </h1>
            </div>
            <p className="text-sm text-gray-600 mt-1">Administrateur</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/admins/${adminId}/stats`}>
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Voir les coûts
              </Button>
            </Link>
            <Link href={`/admin/admins/${adminId}/edit`}>
              <Button variant="outline">Modifier</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="max-w-4xl space-y-6">
          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <p className="text-sm text-gray-600">{admin.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Téléphone</p>
                  <p className="text-sm text-gray-600">{admin.telephone}</p>
                </div>
              </div>

              {(admin.adresse || admin.ville) && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Adresse</p>
                    {admin.adresse && (
                      <p className="text-sm text-gray-600">{admin.adresse}</p>
                    )}
                    {admin.ville && (
                      <p className="text-sm text-gray-600">
                        {admin.codePostal} {admin.ville}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {admin.dateNaissance && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Date de naissance</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(admin.dateNaissance), 'd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              )}

              {admin.dateInscription && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Date d'inscription</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(admin.dateInscription), 'd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Équipement */}
          <Card>
            <CardHeader>
              <CardTitle>Équipement</CardTitle>
              <CardDescription>Matériel de l'administrateur</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Caméras */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="h-5 w-5 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900">Caméras</h3>
                </div>
                {cameras.length > 0 ? (
                  <ul className="space-y-2 pl-7">
                    {cameras.map((camera, index) => (
                      <li key={index} className="text-sm text-gray-600">
                        • {camera}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 pl-7">Aucune caméra renseignée</p>
                )}
              </div>

              <Separator />

              {/* Objectifs */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Objectifs</h3>
                {objectifs.length > 0 ? (
                  <ul className="space-y-2">
                    {objectifs.map((objectif, index) => (
                      <li key={index} className="text-sm text-gray-600">
                        • {objectif}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Aucun objectif renseigné</p>
                )}
              </div>

              <Separator />

              {/* Cartes mémoire */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Cartes mémoire</h3>
                {cartesMemoire.length > 0 ? (
                  <ul className="space-y-2">
                    {cartesMemoire.map((carte, index) => (
                      <li key={index} className="text-sm text-gray-600">
                        • {carte}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Aucune carte mémoire renseignée</p>
                )}
              </div>

              <Separator />

              {/* Flashs */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Flashs</h3>
                {flashs.length > 0 ? (
                  <ul className="space-y-2">
                    {flashs.map((flash, index) => (
                      <li key={index} className="text-sm text-gray-600">
                        • {flash}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Aucun flash renseigné</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cartes de fidélité */}
          <Card>
            <CardHeader>
              <CardTitle>Cartes de fidélité</CardTitle>
              <CardDescription>Programmes de fidélité</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Flying Blue */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900">Flying Blue</h3>
                </div>
                {admin.flyingBlue ? (
                  <div className="pl-7 space-y-2">
                    <p className="text-sm text-gray-600">Numéro : {admin.flyingBlue}</p>
                    {admin.flyingBlueExpiry && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-600">
                          Expire le :{' '}
                          {format(new Date(admin.flyingBlueExpiry), 'd MMMM yyyy', {
                            locale: fr,
                          })}
                        </p>
                        {isExpired(admin.flyingBlueExpiry) ? (
                          <Badge className="bg-red-100 text-red-800 border-red-300">Expiré</Badge>
                        ) : isExpiringSoon(admin.flyingBlueExpiry) ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                            Expire bientôt
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                            Valide
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 pl-7">Non renseigné</p>
                )}
              </div>

              <Separator />

              {/* SNCF */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900">Carte SNCF</h3>
                </div>
                {admin.sncf ? (
                  <div className="pl-7 space-y-2">
                    <p className="text-sm text-gray-600">Numéro : {admin.sncf}</p>
                    {admin.sncfExpiry && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-600">
                          Expire le :{' '}
                          {format(new Date(admin.sncfExpiry), 'd MMMM yyyy', {
                            locale: fr,
                          })}
                        </p>
                        {isExpired(admin.sncfExpiry) ? (
                          <Badge className="bg-red-100 text-red-800 border-red-300">Expiré</Badge>
                        ) : isExpiringSoon(admin.sncfExpiry) ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                            Expire bientôt
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                            Valide
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 pl-7">Non renseigné</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistiques */}
          <Card>
            <CardHeader>
              <CardTitle>Statistiques</CardTitle>
              <CardDescription>Activité de l'administrateur</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>Courses validées : 0</p>
              <p>CA total : 0 €</p>
              <p className="text-xs italic text-gray-500">
                Les statistiques seront calculées à partir des disponibilités
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
