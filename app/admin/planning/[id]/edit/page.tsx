'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const courseSchema = z.object({
  nom: z.string().min(3, 'Le nom doit contenir au moins 3 caractères'),
  localisation: z.string().min(1, 'La localisation est requise'),
  description: z.string().optional(),
  dateDebut: z.string().min(1, 'La date de début est requise'),
  dateFin: z.string().min(1, 'La date de fin est requise'),
  tarifPhotographe: z.string().min(1, 'Le tarif est requis'),
  bonusChefEquipe: z.string().min(1, 'Le bonus est requis'),
  coureursAttendus: z.string().optional(),
  numberAttended: z.string().optional(),
  hotel: z.string().optional(),
  transport: z.string().optional(),
  supplementaire: z.string().optional(),
  hotelValid: z.boolean().optional(),
  transportValid: z.boolean().optional(),
  hotelPrice: z.string().optional(),
  transportPrice: z.string().optional(),
  foodPrice: z.string().optional(),
  comOrga: z.string().optional(),
});

type CourseFormValues = z.infer<typeof courseSchema>;

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      nom: '',
      localisation: '',
      description: '',
      dateDebut: '',
      dateFin: '',
      tarifPhotographe: '450',
      bonusChefEquipe: '100',
      coureursAttendus: '',
      numberAttended: '',
      hotel: '',
      transport: '',
      supplementaire: '',
      hotelValid: false,
      transportValid: false,
      hotelPrice: '',
      transportPrice: '',
      foodPrice: '',
      comOrga: '',
    },
  });

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);

      // Fetch course
      const courseRes = await fetch(`/api/courses/${courseId}`);
      if (!courseRes.ok) throw new Error('Course introuvable');

      const courseData = await courseRes.json();
      const course = courseData.course;

      // Fetch tarif
      const tarifRes = await fetch(`/api/tarifs?courseId=${courseId}`);
      let tarif = { tarifPhotographe: 450, bonusChefEquipe: 100 };
      if (tarifRes.ok) {
        const tarifData = await tarifRes.json();
        if (tarifData.tarifs && tarifData.tarifs.length > 0) {
          tarif = tarifData.tarifs[0];
        }
      }

      // Formater les dates pour input datetime-local
      const formatDateForInput = (isoDate: string) => {
        const date = new Date(isoDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      // Pré-remplir le formulaire
      form.reset({
        nom: course.nom || '',
        localisation: course.localisation || '',
        description: course.description || '',
        dateDebut: formatDateForInput(course.dateDebut),
        dateFin: formatDateForInput(course.dateFin),
        tarifPhotographe: String(tarif.tarifPhotographe),
        bonusChefEquipe: String(tarif.bonusChefEquipe),
        coureursAttendus: course.coureursAttendus ? String(course.coureursAttendus) : '',
        numberAttended: course.numberAttended ? String(course.numberAttended) : '',
        hotel: course.hotel || '',
        transport: course.transport || '',
        supplementaire: course.supplementaire || '',
        hotelValid: course.hotelValid === 'TRUE' || course.hotelValid === true,
        transportValid: course.transportValid === 'TRUE' || course.transportValid === true,
        hotelPrice: course.hotelPrice || '',
        transportPrice: course.transportPrice || '',
        foodPrice: course.foodPrice || '',
        comOrga: course.comOrga || '',
      });
    } catch (error) {
      console.error('Erreur chargement course:', error);
      toast.error('Impossible de charger la course');
      router.push('/admin/planning');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CourseFormValues) => {
    try {
      setSaving(true);

      // Mettre à jour la course
      const courseData = {
        nom: data.nom,
        localisation: data.localisation,
        ville: data.localisation,
        description: data.description || '',
        dateDebut: new Date(data.dateDebut).toISOString(),
        dateFin: new Date(data.dateFin).toISOString(),
        coureursAttendus: data.coureursAttendus ? parseInt(data.coureursAttendus) : 0,
        numberAttended: data.numberAttended ? parseInt(data.numberAttended) : 0,
        hotel: data.hotel || '',
        transport: data.transport || '',
        supplementaire: data.supplementaire || '',
        hotelValid: data.hotelValid ? 'TRUE' : 'FALSE',
        transportValid: data.transportValid ? 'TRUE' : 'FALSE',
        hotelPrice: data.hotelPrice || '',
        transportPrice: data.transportPrice || '',
        foodPrice: data.foodPrice || '',
        comOrga: data.comOrga || '',
      };

      const courseRes = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseData),
      });

      if (!courseRes.ok) {
        const errorData = await courseRes.json();
        throw new Error(errorData.error || 'Erreur mise à jour course');
      }

      // Mettre à jour le tarif
      const tarifData = {
        courseId: courseId,
        tarifPhotographe: parseFloat(data.tarifPhotographe),
        bonusChefEquipe: parseFloat(data.bonusChefEquipe),
      };

      const tarifRes = await fetch(`/api/tarifs/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarifData),
      });

      if (!tarifRes.ok) {
        const errorData = await tarifRes.json();
        throw new Error(errorData.error || 'Erreur mise à jour tarif');
      }

      toast.success('Course et tarif modifiés avec succès');

      // Redirection
      router.push(`/admin/planning/${courseId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur mise à jour course:', error);
      toast.error(`Une erreur est survenue: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <Link href={`/admin/planning/${courseId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier la course</h1>
            <p className="text-sm text-gray-600 mt-1">Modifiez les informations de la course</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 py-6 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Informations principales */}
            <Card>
              <CardHeader>
                <CardTitle>Informations principales</CardTitle>
                <CardDescription>Les informations de base de la course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de la course *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Marathon de Paris 2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="localisation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localisation *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Paris, France" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Description de la course..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coureursAttendus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de coureurs attendus</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ex: 5000" {...field} />
                      </FormControl>
                      <FormDescription>
                        Optionnel, affiché dans la ligne "👥" de l'événement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numberAttended"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de photographes attendus</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ex: 6" {...field} />
                      </FormControl>
                      <FormDescription>
                        Affiché dans le planning (ex: 6-8 = 6 disponibles sur 8 attendus)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Section 2: Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Dates</CardTitle>
                <CardDescription>Les dates de début et fin de la course</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateDebut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de début *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de fin *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Tarifs */}
            <Card>
              <CardHeader>
                <CardTitle>Tarifs</CardTitle>
                <CardDescription>Les tarifs pour les photographes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tarifPhotographe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarif photographe (€) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="450" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bonusChefEquipe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus chef d&apos;équipe (€) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Logistique */}
            <Card>
              <CardHeader>
                <CardTitle>Logistique</CardTitle>
                <CardDescription>Informations sur l&apos;hébergement, transport et autres détails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="hotel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hôtel</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informations sur l'hôtel (nom, adresse, réservation...)"
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hotelValid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Hôtel validé</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="transport"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transport</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informations sur le transport (covoiturage, train, lieu de RDV...)"
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transportValid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Transport validé</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="supplementaire"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Informations supplémentaires</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Autres informations importantes pour l'équipe..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Section 5: Coûts */}
            <Card>
              <CardHeader>
                <CardTitle>Coûts de la course</CardTitle>
                <CardDescription>Budget et dépenses liées à l&apos;événement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hotelPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix de l&apos;hôtel (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transportPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix des transports (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="foodPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix de la nourriture (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="comOrga"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commission organisateur (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Link href={`/admin/planning/${courseId}`}>
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
                  'Enregistrer les modifications'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
