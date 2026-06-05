'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, X, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

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

export default function EditManagedPhotographerPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [formData, setFormData] = useState<Photographer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [params.id]);

  // Helper pour parser les équipements de manière sûre
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

      // Récupérer le profil du photographe géré
      const res = await fetch(`/api/photographers/${params.id}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError('Vous n\'avez pas accès à ce profil');
          return;
        }
        if (res.status === 404) {
          setError('Photographe non trouvé');
          return;
        }
        throw new Error('Erreur lors de la récupération du profil');
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
      setFormData(photographerData);
    } catch (error: any) {
      setError(error?.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!photographer || !formData) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/photographers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cameras: JSON.stringify(formData.cameras || []),
          objectifs: JSON.stringify(formData.objectifs || []),
          cartesMemoire: JSON.stringify(formData.cartesMemoire || []),
          flashs: JSON.stringify(formData.flashs || []),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
      }

      toast.success('Profil mis à jour avec succès');
      router.push(`/photographer/${params.id}/profile`);
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/photographer/${params.id}/profile`);
  };

  const addEquipment = (type: 'cameras' | 'objectifs' | 'cartesMemoire' | 'flashs') => {
    if (!formData) return;
    setFormData({
      ...formData,
      [type]: [...(formData[type] || []), ''],
    });
  };

  const removeEquipment = (type: 'cameras' | 'objectifs' | 'cartesMemoire' | 'flashs', index: number) => {
    if (!formData) return;
    const newList = [...(formData[type] || [])];
    newList.splice(index, 1);
    setFormData({
      ...formData,
      [type]: newList,
    });
  };

  const updateEquipment = (
    type: 'cameras' | 'objectifs' | 'cartesMemoire' | 'flashs',
    index: number,
    value: string
  ) => {
    if (!formData) return;
    const newList = [...(formData[type] || [])];
    newList[index] = value;
    setFormData({
      ...formData,
      [type]: newList,
    });
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

  if (error || !photographer || !formData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error || 'Photographe non trouvé'}</p>
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gray-100 text-gray-600 text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Modifier - {photographer.prenom} {photographer.nom}
              </h1>
              <p className="text-sm text-gray-600">Photographe à votre charge</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6 max-w-4xl">
        <div className="space-y-6">
          {/* Note sur les restrictions */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-800">
                En tant que référent, vous pouvez modifier les informations personnelles et l'équipement de ce photographe.
                Vous ne pouvez pas modifier son email, son mot de passe ou son statut actif.
              </p>
            </CardContent>
          </Card>

          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Prénom</Label>
                  <Input
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Email</Label>
                <p className="text-sm text-gray-600 mt-1">{photographer.email}</p>
                <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié par un référent</p>
              </div>

              <div>
                <Label>Téléphone</Label>
                <Input
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                />
              </div>

              <div>
                <Label>Adresse</Label>
                <Input
                  value={formData.adresse || ''}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Ville</Label>
                  <Input
                    value={formData.ville || ''}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Code postal</Label>
                  <Input
                    value={formData.codePostal || ''}
                    onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Équipement */}
          <Card>
            <CardHeader>
              <CardTitle>Équipement</CardTitle>
              <CardDescription>Matériel photographique</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Caméras */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Caméras</Label>
                  <Button size="sm" variant="outline" onClick={() => addEquipment('cameras')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {(formData.cameras || []).map((camera, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={camera}
                        onChange={(e) => updateEquipment('cameras', index, e.target.value)}
                        placeholder="Ex: Canon EOS R5"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEquipment('cameras', index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {(formData.cameras || []).length === 0 && (
                    <p className="text-sm text-gray-500">Aucune caméra renseignée</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Objectifs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Objectifs</Label>
                  <Button size="sm" variant="outline" onClick={() => addEquipment('objectifs')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {(formData.objectifs || []).map((objectif, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={objectif}
                        onChange={(e) => updateEquipment('objectifs', index, e.target.value)}
                        placeholder="Ex: Canon RF 24-70mm f/2.8"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEquipment('objectifs', index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {(formData.objectifs || []).length === 0 && (
                    <p className="text-sm text-gray-500">Aucun objectif renseigné</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Cartes mémoire */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Cartes mémoire</Label>
                  <Button size="sm" variant="outline" onClick={() => addEquipment('cartesMemoire')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {(formData.cartesMemoire || []).map((carte, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={carte}
                        onChange={(e) => updateEquipment('cartesMemoire', index, e.target.value)}
                        placeholder="Ex: SanDisk 128GB"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEquipment('cartesMemoire', index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {(formData.cartesMemoire || []).length === 0 && (
                    <p className="text-sm text-gray-500">Aucune carte mémoire renseignée</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Flashs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Flashs</Label>
                  <Button size="sm" variant="outline" onClick={() => addEquipment('flashs')}>
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {(formData.flashs || []).map((flash, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={flash}
                        onChange={(e) => updateEquipment('flashs', index, e.target.value)}
                        placeholder="Ex: Canon Speedlite 600EX"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEquipment('flashs', index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {(formData.flashs || []).length === 0 && (
                    <p className="text-sm text-gray-500">Aucun flash renseigné</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cartes de fidélité */}
          <Card>
            <CardHeader>
              <CardTitle>Cartes de fidélité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Flying Blue */}
              <div>
                <Label>Flying Blue</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Input
                      value={formData.flyingBlue || ''}
                      onChange={(e) => setFormData({ ...formData, flyingBlue: e.target.value })}
                      placeholder="Numéro Flying Blue"
                    />
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={formData.flyingBlueExpiry || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, flyingBlueExpiry: e.target.value })
                      }
                    />
                    {formData.flyingBlueExpiry && (
                      <div className="flex items-center gap-2 mt-2">
                        {isExpired(formData.flyingBlueExpiry) ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300">Expiré</Badge>
                        ) : isExpiringSoon(formData.flyingBlueExpiry) ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
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
                </div>
              </div>

              <Separator />

              {/* SNCF */}
              <div>
                <Label>Carte SNCF</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Input
                      value={formData.sncf || ''}
                      onChange={(e) => setFormData({ ...formData, sncf: e.target.value })}
                      placeholder="Numéro carte SNCF"
                    />
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={formData.sncfExpiry || ''}
                      onChange={(e) => setFormData({ ...formData, sncfExpiry: e.target.value })}
                    />
                    {formData.sncfExpiry && (
                      <div className="flex items-center gap-2 mt-2">
                        {isExpired(formData.sncfExpiry) ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300">Expiré</Badge>
                        ) : isExpiringSoon(formData.sncfExpiry) ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
