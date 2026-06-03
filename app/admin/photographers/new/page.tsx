'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const photographerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  nom: z.string().min(1, 'Le nom est requis'),
  prenom: z.string().min(1, 'Le prénom est requis'),
  telephone: z.string().min(1, 'Le téléphone est requis'),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  codePostal: z.string().optional(),
  dateNaissance: z.string().optional(),
});

type PhotographerFormValues = z.infer<typeof photographerSchema>;

export default function NewPhotographerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const form = useForm<PhotographerFormValues>({
    resolver: zodResolver(photographerSchema),
    defaultValues: {
      email: '',
      password: '',
      nom: '',
      prenom: '',
      telephone: '',
      adresse: '',
      ville: '',
      codePostal: '',
      dateNaissance: '',
    },
  });

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    form.setValue('password', password);
  };

  const onSubmit = async (data: PhotographerFormValues) => {
    try {
      setLoading(true);

      // Générer un ID unique
      const photographerId = `photographe-${Date.now()}`;

      // Créer le photographe
      const photographerData = {
        id: photographerId,
        email: data.email,
        password: data.password, // Sera hashé côté serveur
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        adresse: data.adresse || '',
        ville: data.ville || '',
        codePostal: data.codePostal || '',
        dateNaissance: data.dateNaissance || '',
        dateInscription: new Date().toISOString(),
        actif: true,
        cameras: JSON.stringify([]),
        objectifs: JSON.stringify([]),
        cartesMemoire: JSON.stringify([]),
        flashs: JSON.stringify([]),
        flyingBlue: '',
        flyingBlueExpiry: '',
        sncf: '',
        sncfExpiry: '',
      };

      const res = await fetch('/api/photographers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photographerData),
      });

      if (!res.ok) throw new Error('Erreur création photographe');

      // Afficher les identifiants créés
      setCreatedCredentials({
        email: data.email,
        password: data.password,
      });

      // Rediriger après 3 secondes
      setTimeout(() => {
        router.push(`/admin/photographers/${photographerId}/profile`);
      }, 3000);
    } catch (error) {
      console.error('Erreur création photographe:', error);
      toast.error('Une erreur est survenue lors de la création du photographe');
    } finally {
      setLoading(false);
    }
  };

  // Si les identifiants ont été créés, afficher le message
  if (createdCredentials) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-gray-600">Photographe créé avec succès !</CardTitle>
            <CardDescription>
              Voici les identifiants à communiquer au photographe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-base font-mono bg-gray-100 px-3 py-2 rounded-md mt-1">
                {createdCredentials.email}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Mot de passe</p>
              <p className="text-base font-mono bg-gray-100 px-3 py-2 rounded-md mt-1">
                {createdCredentials.password}
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                Notez ces identifiants avant de quitter cette page. Le mot de passe ne sera plus accessible.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => router.push('/admin/photographers')}
            >
              Continuer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/photographers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Créer un photographe</h1>
            <p className="text-sm text-gray-600 mt-1">Nouveau compte photographe</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 py-6 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Identifiants */}
            <Card>
              <CardHeader>
                <CardTitle>Identifiants de connexion</CardTitle>
                <CardDescription>Email et mot de passe pour l'accès au compte</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="photographe@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Adresse email unique pour la connexion</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe *</FormLabel>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <FormControl>
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Mot de passe sécurisé"
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button type="button" variant="outline" onClick={generatePassword}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Générer
                        </Button>
                      </div>
                      <FormDescription>Minimum 8 caractères</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Section 2: Informations personnelles */}
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>Coordonnées du photographe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input placeholder="Martin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="prenom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom *</FormLabel>
                        <FormControl>
                          <Input placeholder="Sophie" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="telephone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone *</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+33612345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adresse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Rue de la Photo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ville"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input placeholder="Paris" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="codePostal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code postal</FormLabel>
                        <FormControl>
                          <Input placeholder="75001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="dateNaissance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de naissance</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <Link href="/admin/photographers">
                <Button type="button" variant="outline">
                  Annuler
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer le compte'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
