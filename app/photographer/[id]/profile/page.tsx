'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Photographer {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  dateNaissance?: string;
  cameras?: string[];
  objectifs?: string[];
  cartesMemoire?: string[];
  flashs?: string[];
  flyingBlue?: string;
  flyingBlueExpiry?: string;
  sncf?: string;
  sncfExpiry?: string;
}

export default function ManagedPhotographerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [params.id]);

  const parseEquipment = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    if (!value || (typeof value === 'string' && value.trim() === '')) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        return [];
      } catch {
        return [value.trim()];
      }
    }
    return [];
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/photographers/${params.id}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        if (res.status === 403) {
          setError('Acces refuse : ' + (errorData.error || 'Vous ne pouvez pas voir ce profil'));
          return;
        }
        if (res.status === 404) {
          setError('Photographe non trouve');
          return;
        }
        setError(errorData.error || 'Erreur lors de la recuperation du profil');
        return;
      }
      const data = await res.json();
      const photographerData = {
        ...data.photographer,
        cameras: parseEquipment(data.photographer.cameras),
        objectifs: parseEquipment(data.photographer.objectifs),
        cartesMemoire: parseEquipment(data.photographer.cartesMemoire),
        flashs: parseEquipment(data.photographer.flashs),
      };
      setPhotographer(photographerData);
    } catch (error: any) {
      setError(error?.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
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

  const getInitials = () => {
    if (!photographer) return '??';
    return `${photographer.prenom[0]}${photographer.nom[0]}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (error || !photographer) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error || 'Photographe non trouve'}</p>
          <Button variant="outline" onClick={() => router.push('/photographer/planning')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au planning
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/photographer/planning')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gray-100 text-gray-600 text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{photographer.prenom} {photographer.nom}</h1>
              <p className="text-sm text-gray-600">Photographe a votre charge</p>
            </div>
          </div>
          <Button onClick={() => router.push(`/photographer/${params.id}/edit`)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-6 max-w-4xl">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Nom</Label><p className="text-sm text-gray-900 mt-1">{photographer.nom}</p></div>
                <div><Label>Prenom</Label><p className="text-sm text-gray-900 mt-1">{photographer.prenom}</p></div>
              </div>
              <div><Label>Email</Label><p className="text-sm text-gray-900 mt-1">{photographer.email}</p></div>
              <div><Label>Telephone</Label><p className="text-sm text-gray-900 mt-1">{photographer.telephone}</p></div>
              <div><Label>Adresse</Label><p className="text-sm text-gray-900 mt-1">{photographer.adresse || '-'}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Ville</Label><p className="text-sm text-gray-900 mt-1">{photographer.ville || '-'}</p></div>
                <div><Label>Code postal</Label><p className="text-sm text-gray-900 mt-1">{photographer.codePostal || '-'}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Equipement</CardTitle><CardDescription>Materiel photographique</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Cameras</Label>
                <div className="space-y-2">
                  {(photographer.cameras || []).map((camera, index) => (<p key={index} className="text-sm text-gray-900">" {camera}</p>))}
                  {(photographer.cameras || []).length === 0 && (<p className="text-sm text-gray-500">Aucune camera renseignee</p>)}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="mb-3 block">Objectifs</Label>
                <div className="space-y-2">
                  {(photographer.objectifs || []).map((objectif, index) => (<p key={index} className="text-sm text-gray-900">" {objectif}</p>))}
                  {(photographer.objectifs || []).length === 0 && (<p className="text-sm text-gray-500">Aucun objectif renseigne</p>)}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="mb-3 block">Cartes memoire</Label>
                <div className="space-y-2">
                  {(photographer.cartesMemoire || []).map((carte, index) => (<p key={index} className="text-sm text-gray-900">" {carte}</p>))}
                  {(photographer.cartesMemoire || []).length === 0 && (<p className="text-sm text-gray-500">Aucune carte memoire renseignee</p>)}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="mb-3 block">Flashs</Label>
                <div className="space-y-2">
                  {(photographer.flashs || []).map((flash, index) => (<p key={index} className="text-sm text-gray-900">" {flash}</p>))}
                  {(photographer.flashs || []).length === 0 && (<p className="text-sm text-gray-500">Aucun flash renseigne</p>)}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Cartes de fidelite</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Flying Blue</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div><p className="text-sm text-gray-900">{photographer.flyingBlue || '-'}</p></div>
                  <div>
                    {photographer.flyingBlueExpiry ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-900">Expire le: {new Date(photographer.flyingBlueExpiry).toLocaleDateString('fr-FR')}</p>
                        {isExpired(photographer.flyingBlueExpiry) ? (<Badge className="bg-orange-100 text-orange-800 border-orange-300">Expire</Badge>) : isExpiringSoon(photographer.flyingBlueExpiry) ? (<Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Expire bientot</Badge>) : (<Badge className="bg-gray-100 text-gray-800 border-gray-300">Valide</Badge>)}
                      </div>
                    ) : (<p className="text-sm text-gray-500">-</p>)}
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <Label>Carte SNCF</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div><p className="text-sm text-gray-900">{photographer.sncf || '-'}</p></div>
                  <div>
                    {photographer.sncfExpiry ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-900">Expire le: {new Date(photographer.sncfExpiry).toLocaleDateString('fr-FR')}</p>
                        {isExpired(photographer.sncfExpiry) ? (<Badge className="bg-orange-100 text-orange-800 border-orange-300">Expire</Badge>) : isExpiringSoon(photographer.sncfExpiry) ? (<Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Expire bientot</Badge>) : (<Badge className="bg-gray-100 text-gray-800 border-gray-300">Valide</Badge>)}
                      </div>
                    ) : (<p className="text-sm text-gray-500">-</p>)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
