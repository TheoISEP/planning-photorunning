'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Eye, EyeOff, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  actif: boolean;
  region?: string;
  personUrgency?: string;
  numberUrgency?: string;
  cameras?: string | string[];
  objectifs?: string | string[];
  cartesMemoire?: string | string[];
  flashs?: string | string[];
  flyingBlue?: string;
  flyingBlueExpiry?: string;
  sncf?: string;
  sncfExpiry?: string;
  inCharge?: boolean | string;
  chargeOne?: string;
  chargeTwo?: string;
  chargeThree?: string;
  chargeFour?: string;
  chargeFive?: string;
}

export default function EditPhotographerPage() {
  const router = useRouter();
  const params = useParams();
  const photographerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    codePostal: '',
    dateNaissance: '',
    actif: true,
    region: '',
    personUrgency: '',
    numberUrgency: '',
    cameras: [] as string[],
    objectifs: [] as string[],
    cartesMemoire: [] as string[],
    flashs: [] as string[],
    flyingBlue: '',
    flyingBlueExpiry: '',
    sncf: '',
    sncfExpiry: '',
    inCharge: false,
    chargeOne: '',
    chargeTwo: '',
    chargeThree: '',
    chargeFour: '',
    chargeFive: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [newCamera, setNewCamera] = useState('');
  const [newObjectif, setNewObjectif] = useState('');
  const [newCarte, setNewCarte] = useState('');
  const [newFlash, setNewFlash] = useState('');
  const [allPhotographers, setAllPhotographers] = useState<Photographer[]>([]);

  useEffect(() => {
    fetchPhotographer();
  }, [photographerId]);

  const fetchPhotographer = async () => {
    try {
      setLoading(true);

      // Charger le photographe et la liste complète des photographes en parallèle
      const [photographerRes, allPhotographersRes] = await Promise.all([
        fetch(`/api/photographers/${photographerId}`),
        fetch('/api/photographers')
      ]);

      if (photographerRes.ok) {
        const data = await photographerRes.json();
        setPhotographer(data.photographer);

        // Charger tous les photographes pour le sélecteur
        if (allPhotographersRes.ok) {
          const allPhotosData = await allPhotographersRes.json();
          setAllPhotographers(allPhotosData.photographers || []);
        }

        // Parser les arrays JSON
        const parseCameras = () => {
          if (Array.isArray(data.photographer.cameras)) return data.photographer.cameras;
          if (typeof data.photographer.cameras === 'string') {
            try { return JSON.parse(data.photographer.cameras); } catch { return []; }
          }
          return [];
        };

        const parseObjectifs = () => {
          if (Array.isArray(data.photographer.objectifs)) return data.photographer.objectifs;
          if (typeof data.photographer.objectifs === 'string') {
            try { return JSON.parse(data.photographer.objectifs); } catch { return []; }
          }
          return [];
        };

        const parseCartesMemoire = () => {
          if (Array.isArray(data.photographer.cartesMemoire)) return data.photographer.cartesMemoire;
          if (typeof data.photographer.cartesMemoire === 'string') {
            try { return JSON.parse(data.photographer.cartesMemoire); } catch { return []; }
          }
          return [];
        };

        const parseFlashs = () => {
          if (Array.isArray(data.photographer.flashs)) return data.photographer.flashs;
          if (typeof data.photographer.flashs === 'string') {
            try { return JSON.parse(data.photographer.flashs); } catch { return []; }
          }
          return [];
        };

        setFormData({
          nom: data.photographer.nom || '',
          prenom: data.photographer.prenom || '',
          email: data.photographer.email || '',
          telephone: data.photographer.telephone || '',
          adresse: data.photographer.adresse || '',
          ville: data.photographer.ville || '',
          codePostal: data.photographer.codePostal || '',
          dateNaissance: data.photographer.dateNaissance || '',
          actif: data.photographer.actif === 'TRUE' || data.photographer.actif === true,
          region: data.photographer.region || '',
          personUrgency: data.photographer.personUrgency || '',
          numberUrgency: data.photographer.numberUrgency || '',
          cameras: parseCameras(),
          objectifs: parseObjectifs(),
          cartesMemoire: parseCartesMemoire(),
          flashs: parseFlashs(),
          flyingBlue: data.photographer.flyingBlue || '',
          flyingBlueExpiry: data.photographer.flyingBlueExpiry || '',
          sncf: data.photographer.sncf || '',
          sncfExpiry: data.photographer.sncfExpiry || '',
          inCharge: data.photographer.inCharge === 'TRUE' || data.photographer.inCharge === true,
          chargeOne: data.photographer.chargeOne || '',
          chargeTwo: data.photographer.chargeTwo || '',
          chargeThree: data.photographer.chargeThree || '',
          chargeFour: data.photographer.chargeFour || '',
          chargeFive: data.photographer.chargeFive || '',
        });
      }
    } catch (error) {
      console.error('Erreur chargement photographe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      const updateData: any = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        telephone: formData.telephone,
        adresse: formData.adresse,
        ville: formData.ville,
        codePostal: formData.codePostal,
        dateNaissance: formData.dateNaissance,
        actif: formData.actif ? 'TRUE' : 'FALSE',
        region: formData.region,
        personUrgency: formData.personUrgency,
        numberUrgency: formData.numberUrgency,
        cameras: formData.cameras,
        objectifs: formData.objectifs,
        cartesMemoire: formData.cartesMemoire,
        flashs: formData.flashs,
        flyingBlue: formData.flyingBlue,
        flyingBlueExpiry: formData.flyingBlueExpiry,
        sncf: formData.sncf,
        sncfExpiry: formData.sncfExpiry,
        inCharge: formData.inCharge ? 'TRUE' : 'FALSE',
        chargeOne: formData.chargeOne,
        chargeTwo: formData.chargeTwo,
        chargeThree: formData.chargeThree,
        chargeFour: formData.chargeFour,
        chargeFive: formData.chargeFive,
      };

      // Si un nouveau mot de passe est fourni
      if (newPassword) {
        updateData.password = newPassword;
      }

      const res = await fetch(`/api/photographers/${photographerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        toast.success('Photographe modifié avec succès');
        router.push(`/admin/photographers/${photographerId}/profile`);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erreur lors de la modification');
      }
    } catch (error) {
      console.error('Erreur modification:', error);
      toast.error('Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
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

  if (!photographer) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Photographe introuvable</p>
          <Link href="/admin/photographers">
            <Button className="mt-4" variant="outline">
              Retour à la liste
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href={`/admin/photographers/${photographerId}/profile`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au profil
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations de base */}
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nom">Nom *</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="prenom">Prénom *</Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dateNaissance">Date de naissance</Label>
              <Input
                id="dateNaissance"
                type="date"
                value={formData.dateNaissance}
                onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="region">Région</Label>
              <Select
                value={formData.region}
                onValueChange={(value) => setFormData({ ...formData, region: value })}
              >
                <SelectTrigger id="region">
                  <SelectValue placeholder="Sélectionner une région" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ile-de-France">Île-de-France</SelectItem>
                  <SelectItem value="Sud-Est">Sud-Est</SelectItem>
                  <SelectItem value="Sud-Ouest">Sud-Ouest</SelectItem>
                  <SelectItem value="Nord">Nord</SelectItem>
                  <SelectItem value="Zone Centre">Zone Centre</SelectItem>
                  <SelectItem value="Zone Lyon">Zone Lyon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader>
            <CardTitle>Adresse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ville">Ville</Label>
                <Input
                  id="ville"
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="codePostal">Code postal</Label>
                <Input
                  id="codePostal"
                  value={formData.codePostal}
                  onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact d'urgence */}
        <Card>
          <CardHeader>
            <CardTitle>Contact d'urgence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="personUrgency">Personne à contacter</Label>
              <Input
                id="personUrgency"
                value={formData.personUrgency}
                onChange={(e) => setFormData({ ...formData, personUrgency: e.target.value })}
                placeholder="Nom du contact d'urgence"
              />
            </div>
            <div>
              <Label htmlFor="numberUrgency">Numéro d'urgence</Label>
              <Input
                id="numberUrgency"
                type="tel"
                value={formData.numberUrgency}
                onChange={(e) => setFormData({ ...formData, numberUrgency: e.target.value })}
                placeholder="+33612345678"
              />
            </div>
          </CardContent>
        </Card>

        {/* Équipement */}
        <Card>
          <CardHeader>
            <CardTitle>Équipement photo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Caméras */}
            <div>
              <Label>Boîtiers</Label>
              <div className="space-y-2 mt-2">
                {formData.cameras.map((camera, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={camera} readOnly className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newCameras = formData.cameras.filter((_, i) => i !== index);
                        setFormData({ ...formData, cameras: newCameras });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Ajouter un boîtier"
                    value={newCamera}
                    onChange={(e) => setNewCamera(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCamera.trim()) {
                          setFormData({ ...formData, cameras: [...formData.cameras, newCamera.trim()] });
                          setNewCamera('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newCamera.trim()) {
                        setFormData({ ...formData, cameras: [...formData.cameras, newCamera.trim()] });
                        setNewCamera('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Objectifs */}
            <div>
              <Label>Objectifs</Label>
              <div className="space-y-2 mt-2">
                {formData.objectifs.map((objectif, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={objectif} readOnly className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newObjectifs = formData.objectifs.filter((_, i) => i !== index);
                        setFormData({ ...formData, objectifs: newObjectifs });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Ajouter un objectif"
                    value={newObjectif}
                    onChange={(e) => setNewObjectif(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newObjectif.trim()) {
                          setFormData({ ...formData, objectifs: [...formData.objectifs, newObjectif.trim()] });
                          setNewObjectif('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newObjectif.trim()) {
                        setFormData({ ...formData, objectifs: [...formData.objectifs, newObjectif.trim()] });
                        setNewObjectif('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Cartes mémoire */}
            <div>
              <Label>Cartes mémoire</Label>
              <div className="space-y-2 mt-2">
                {formData.cartesMemoire.map((carte, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={carte} readOnly className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newCartes = formData.cartesMemoire.filter((_, i) => i !== index);
                        setFormData({ ...formData, cartesMemoire: newCartes });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Ajouter une carte mémoire"
                    value={newCarte}
                    onChange={(e) => setNewCarte(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCarte.trim()) {
                          setFormData({ ...formData, cartesMemoire: [...formData.cartesMemoire, newCarte.trim()] });
                          setNewCarte('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newCarte.trim()) {
                        setFormData({ ...formData, cartesMemoire: [...formData.cartesMemoire, newCarte.trim()] });
                        setNewCarte('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Flashs */}
            <div>
              <Label>Flashs</Label>
              <div className="space-y-2 mt-2">
                {formData.flashs.map((flash, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={flash} readOnly className="flex-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newFlashs = formData.flashs.filter((_, i) => i !== index);
                        setFormData({ ...formData, flashs: newFlashs });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Ajouter un flash"
                    value={newFlash}
                    onChange={(e) => setNewFlash(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newFlash.trim()) {
                          setFormData({ ...formData, flashs: [...formData.flashs, newFlash.trim()] });
                          setNewFlash('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newFlash.trim()) {
                        setFormData({ ...formData, flashs: [...formData.flashs, newFlash.trim()] });
                        setNewFlash('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cartes de fidélité */}
        <Card>
          <CardHeader>
            <CardTitle>Cartes de fidélité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="flyingBlue">Flying Blue</Label>
              <Input
                id="flyingBlue"
                placeholder="Numéro de carte"
                value={formData.flyingBlue}
                onChange={(e) => setFormData({ ...formData, flyingBlue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flyingBlueExpiry">Date d'expiration Flying Blue</Label>
              <Input
                id="flyingBlueExpiry"
                type="date"
                value={formData.flyingBlueExpiry}
                onChange={(e) => setFormData({ ...formData, flyingBlueExpiry: e.target.value })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="sncf">Carte SNCF</Label>
              <Input
                id="sncf"
                placeholder="Numéro de carte"
                value={formData.sncf}
                onChange={(e) => setFormData({ ...formData, sncf: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sncfExpiry">Date d'expiration SNCF</Label>
              <Input
                id="sncfExpiry"
                type="date"
                value={formData.sncfExpiry}
                onChange={(e) => setFormData({ ...formData, sncfExpiry: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Changement de mot de passe */}
        <Card>
          <CardHeader>
            <CardTitle>Changer le mot de passe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Label htmlFor="newPassword">Nouveau mot de passe (optionnel)</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Laisser vide pour ne pas modifier"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && (
                <p className="text-xs text-gray-500 mt-1">
                  Ce mot de passe remplacera l'ancien
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Photographes à charge */}
        <Card>
          <CardHeader>
            <CardTitle>Photographes à charge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="inCharge"
                checked={formData.inCharge}
                onChange={(e) => setFormData({ ...formData, inCharge: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="inCharge">Ce photographe a des photographes à charge</Label>
            </div>

            {formData.inCharge && (
              <div className="space-y-3 mt-4 pl-6 border-l-2 border-gray-200">
                <p className="text-sm text-gray-600 mb-3">
                  Sélectionnez jusqu'à 5 photographes que ce photographe référent pourra gérer
                </p>

                {/* Photographe 1 */}
                <div>
                  <Label htmlFor="chargeOne">Photographe 1</Label>
                  <Select
                    value={formData.chargeOne}
                    onValueChange={(value) => setFormData({ ...formData, chargeOne: value })}
                  >
                    <SelectTrigger id="chargeOne">
                      <SelectValue placeholder="Sélectionner un photographe" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPhotographers
                        .filter(p =>
                          p.id !== photographerId &&
                          p.id !== formData.chargeTwo &&
                          p.id !== formData.chargeThree &&
                          p.id !== formData.chargeFour &&
                          p.id !== formData.chargeFive
                        )
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prenom} {p.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Photographe 2 */}
                <div>
                  <Label htmlFor="chargeTwo">Photographe 2</Label>
                  <Select
                    value={formData.chargeTwo}
                    onValueChange={(value) => setFormData({ ...formData, chargeTwo: value })}
                  >
                    <SelectTrigger id="chargeTwo">
                      <SelectValue placeholder="Sélectionner un photographe" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPhotographers
                        .filter(p =>
                          p.id !== photographerId &&
                          p.id !== formData.chargeOne &&
                          p.id !== formData.chargeThree &&
                          p.id !== formData.chargeFour &&
                          p.id !== formData.chargeFive
                        )
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prenom} {p.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Photographe 3 */}
                <div>
                  <Label htmlFor="chargeThree">Photographe 3</Label>
                  <Select
                    value={formData.chargeThree}
                    onValueChange={(value) => setFormData({ ...formData, chargeThree: value })}
                  >
                    <SelectTrigger id="chargeThree">
                      <SelectValue placeholder="Sélectionner un photographe" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPhotographers
                        .filter(p =>
                          p.id !== photographerId &&
                          p.id !== formData.chargeOne &&
                          p.id !== formData.chargeTwo &&
                          p.id !== formData.chargeFour &&
                          p.id !== formData.chargeFive
                        )
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prenom} {p.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Photographe 4 */}
                <div>
                  <Label htmlFor="chargeFour">Photographe 4</Label>
                  <Select
                    value={formData.chargeFour}
                    onValueChange={(value) => setFormData({ ...formData, chargeFour: value })}
                  >
                    <SelectTrigger id="chargeFour">
                      <SelectValue placeholder="Sélectionner un photographe" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPhotographers
                        .filter(p =>
                          p.id !== photographerId &&
                          p.id !== formData.chargeOne &&
                          p.id !== formData.chargeTwo &&
                          p.id !== formData.chargeThree &&
                          p.id !== formData.chargeFive
                        )
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prenom} {p.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Photographe 5 */}
                <div>
                  <Label htmlFor="chargeFive">Photographe 5</Label>
                  <Select
                    value={formData.chargeFive}
                    onValueChange={(value) => setFormData({ ...formData, chargeFive: value })}
                  >
                    <SelectTrigger id="chargeFive">
                      <SelectValue placeholder="Sélectionner un photographe" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPhotographers
                        .filter(p =>
                          p.id !== photographerId &&
                          p.id !== formData.chargeOne &&
                          p.id !== formData.chargeTwo &&
                          p.id !== formData.chargeThree &&
                          p.id !== formData.chargeFour
                        )
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prenom} {p.nom}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statut */}
        <Card>
          <CardHeader>
            <CardTitle>Statut du compte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="actif"
                checked={formData.actif}
                onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="actif">Compte actif</Label>
            </div>
          </CardContent>
        </Card>

        {/* Boutons */}
        <div className="flex justify-end gap-4">
          <Link href={`/admin/photographers/${photographerId}/profile`}>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
