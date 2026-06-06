'use client';

import { useEffect, useState } from 'react';
import { Edit2, Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

export default function PhotographerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [formData, setFormData] = useState<Photographer | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  // Helper pour parser les équipements de manière sûre
  const parseEquipment = (value: any): string[] => {
    // Si c'est déjà un tableau (parsé par l'API), le retourner
    if (Array.isArray(value)) return value;

    // Si c'est vide ou undefined
    if (!value || (typeof value === 'string' && value.trim() === '')) return [];

    // Si c'est un string, essayer de parser comme JSON
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        return [];
      } catch {
        // Si ce n'est pas du JSON valide, c'est probablement du texte simple
        // On le retourne comme un tableau avec un seul élément
        return [value.trim()];
      }
    }

    return [];
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);

      // Récupérer l'utilisateur connecté
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        // Pas authentifié, rediriger vers login
        window.location.href = '/login';
        return;
      }

      const userData = await userRes.json();
      const userId = userData.user.id;

      // Récupérer le profil du photographe
      const res = await fetch(`/api/photographers/${userId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 404) {
          throw new Error('Profil non trouvé. Veuillez contacter l\'administrateur.');
        }
        throw new Error(errorData.error || 'Erreur lors de la récupération du profil');
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
      // Afficher une erreur à l'utilisateur
      const errorMessage = error?.message || 'Erreur inconnue';
      alert(`Erreur lors du chargement du profil: ${errorMessage}\n\nVeuillez contacter l'administrateur si le problème persiste.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!photographer || !formData) return;

    try {
      const res = await fetch(`/api/photographers/${photographer.id}`, {
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

      if (res.ok) {
        setPhotographer(formData);
        setEditMode(false);
      }
    } catch (error) {
      // Erreur sauvegarde profil
    }
  };

  const handleCancel = () => {
    setFormData(photographer);
    setEditMode(false);
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

  if (loading || !photographer || !formData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gray-100 text-gray-600 text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
              <p className="text-sm text-gray-600">Gérez vos informations personnelles</p>
            </div>
          </div>
          {!editMode ? (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/photographer/profil/accord'}
                className="w-full sm:w-auto"
              >
                Accord de sous-traitance
              </Button>
              <Button
                onClick={() => setEditMode(true)}
                className="w-full sm:w-auto"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6 max-w-4xl">
        <div className="space-y-6">
          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nom</Label>
                  {editMode ? (
                    <Input
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm text-gray-900 mt-1">{photographer.nom}</p>
                  )}
                </div>
                <div>
                  <Label>Prénom</Label>
                  {editMode ? (
                    <Input
                      value={formData.prenom}
                      onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm text-gray-900 mt-1">{photographer.prenom}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Email</Label>
                <p className="text-sm text-gray-600 mt-1">{photographer.email}</p>
                <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié</p>
              </div>

              <div>
                <Label>Téléphone</Label>
                {editMode ? (
                  <Input
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-gray-900 mt-1">{photographer.telephone}</p>
                )}
              </div>

              <div>
                <Label>Adresse</Label>
                {editMode ? (
                  <Input
                    value={formData.adresse || ''}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-gray-900 mt-1">{photographer.adresse || '-'}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Ville</Label>
                  {editMode ? (
                    <Input
                      value={formData.ville || ''}
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm text-gray-900 mt-1">{photographer.ville || '-'}</p>
                  )}
                </div>
                <div>
                  <Label>Code postal</Label>
                  {editMode ? (
                    <Input
                      value={formData.codePostal || ''}
                      onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm text-gray-900 mt-1">{photographer.codePostal || '-'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Équipement */}
          <Card>
            <CardHeader>
              <CardTitle>Équipement</CardTitle>
              <CardDescription>Votre matériel photographique</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Caméras */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Caméras</Label>
                  {editMode && (
                    <Button size="sm" variant="outline" onClick={() => addEquipment('cameras')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {(formData.cameras || []).map((camera, index) => (
                    <div key={index} className="flex gap-2">
                      {editMode ? (
                        <>
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
                        </>
                      ) : (
                        <p className="text-sm text-gray-900">• {camera}</p>
                      )}
                    </div>
                  ))}
                  {(formData.cameras || []).length === 0 && !editMode && (
                    <p className="text-sm text-gray-500">Aucune caméra renseignée</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Objectifs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Objectifs</Label>
                  {editMode && (
                    <Button size="sm" variant="outline" onClick={() => addEquipment('objectifs')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {(formData.objectifs || []).map((objectif, index) => (
                    <div key={index} className="flex gap-2">
                      {editMode ? (
                        <>
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
                        </>
                      ) : (
                        <p className="text-sm text-gray-900">• {objectif}</p>
                      )}
                    </div>
                  ))}
                  {(formData.objectifs || []).length === 0 && !editMode && (
                    <p className="text-sm text-gray-500">Aucun objectif renseigné</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Cartes mémoire */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Cartes mémoire</Label>
                  {editMode && (
                    <Button size="sm" variant="outline" onClick={() => addEquipment('cartesMemoire')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {(formData.cartesMemoire || []).map((carte, index) => (
                    <div key={index} className="flex gap-2">
                      {editMode ? (
                        <>
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
                        </>
                      ) : (
                        <p className="text-sm text-gray-900">• {carte}</p>
                      )}
                    </div>
                  ))}
                  {(formData.cartesMemoire || []).length === 0 && !editMode && (
                    <p className="text-sm text-gray-500">Aucune carte mémoire renseignée</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Flashs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Flashs</Label>
                  {editMode && (
                    <Button size="sm" variant="outline" onClick={() => addEquipment('flashs')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {(formData.flashs || []).map((flash, index) => (
                    <div key={index} className="flex gap-2">
                      {editMode ? (
                        <>
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
                        </>
                      ) : (
                        <p className="text-sm text-gray-900">• {flash}</p>
                      )}
                    </div>
                  ))}
                  {(formData.flashs || []).length === 0 && !editMode && (
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
                    {editMode ? (
                      <Input
                        value={formData.flyingBlue || ''}
                        onChange={(e) => setFormData({ ...formData, flyingBlue: e.target.value })}
                        placeholder="Numéro Flying Blue"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{photographer.flyingBlue || '-'}</p>
                    )}
                  </div>
                  <div>
                    {editMode ? (
                      <Input
                        type="date"
                        value={formData.flyingBlueExpiry || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, flyingBlueExpiry: e.target.value })
                        }
                      />
                    ) : photographer.flyingBlueExpiry ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-900">
                          Expire le: {new Date(photographer.flyingBlueExpiry).toLocaleDateString('fr-FR')}
                        </p>
                        {isExpired(photographer.flyingBlueExpiry) ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300">Expiré</Badge>
                        ) : isExpiringSoon(photographer.flyingBlueExpiry) ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            Expire bientôt
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                            Valide
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">-</p>
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
                    {editMode ? (
                      <Input
                        value={formData.sncf || ''}
                        onChange={(e) => setFormData({ ...formData, sncf: e.target.value })}
                        placeholder="Numéro carte SNCF"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{photographer.sncf || '-'}</p>
                    )}
                  </div>
                  <div>
                    {editMode ? (
                      <Input
                        type="date"
                        value={formData.sncfExpiry || ''}
                        onChange={(e) => setFormData({ ...formData, sncfExpiry: e.target.value })}
                      />
                    ) : photographer.sncfExpiry ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-900">
                          Expire le: {new Date(photographer.sncfExpiry).toLocaleDateString('fr-FR')}
                        </p>
                        {isExpired(photographer.sncfExpiry) ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300">Expiré</Badge>
                        ) : isExpiringSoon(photographer.sncfExpiry) ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            Expire bientôt
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                            Valide
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">-</p>
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
