'use client';

import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { CourseJson } from '@/components/planning/types';

const tarifSchema = z.object({
  id: z.string().optional(),
  nom: z.string(),
  tarifPhotographe: z.string().min(1, 'Montant requis'),
  bonusChefEquipe: z.string().min(1, 'Bonus requis'),
});

const schema = z
  .object({
    nom: z.string().min(3, 'Le nom doit contenir au moins 3 caractères'),
    localisation: z.string().min(1, 'La localisation est requise'),
    description: z.string(),
    dateDebut: z.string().min(1, 'La date de début est requise'),
    dateFin: z.string().min(1, 'La date de fin est requise'),
    coureursAttendus: z.string(),
    numberAttended: z.string(),
    tarifs: z.array(tarifSchema).min(1, 'Au moins un créneau').max(4, 'Quatre créneaux maximum'),
    hotel: z.string(),
    transport: z.string(),
    supplementaire: z.string(),
    hotelValid: z.boolean(),
    transportValid: z.boolean(),
    hotelPrice: z.string(),
    transportPrice: z.string(),
    foodPrice: z.string(),
    comOrga: z.string(),
  })
  .refine((v) => new Date(v.dateFin) >= new Date(v.dateDebut), { message: 'La date de fin est avant la date de début', path: ['dateFin'] })
  .refine((v) => v.tarifs.length === 1 || v.tarifs.every((t) => t.nom.trim() !== ''), {
    message: 'Donnez un nom à chaque jour / créneau (ex. Samedi, Dimanche)',
    path: ['tarifs'],
  });

export type CourseFormValues = z.infer<typeof schema>;

const toLocalInput = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const numOrEmpty = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export function defaultsFromCourse(course?: CourseJson): CourseFormValues {
  if (!course) {
    return {
      nom: '', localisation: '', description: '', dateDebut: '', dateFin: '', coureursAttendus: '', numberAttended: '',
      tarifs: [{ nom: '', tarifPhotographe: '450', bonusChefEquipe: '100' }],
      hotel: '', transport: '', supplementaire: '', hotelValid: false, transportValid: false,
      hotelPrice: '', transportPrice: '', foodPrice: '', comOrga: '',
    };
  }
  return {
    nom: course.nom,
    localisation: course.localisation || course.ville,
    description: course.description,
    dateDebut: toLocalInput(course.dateDebut),
    dateFin: toLocalInput(course.dateFin),
    coureursAttendus: course.coureursAttendus ? String(course.coureursAttendus) : '',
    numberAttended: course.numberAttended ? String(course.numberAttended) : '',
    tarifs: course.tarifs.length > 0
      ? course.tarifs.map((t) => ({ id: t.id, nom: t.nom, tarifPhotographe: String(t.tarifPhotographe), bonusChefEquipe: String(t.bonusChefEquipe) }))
      : [{ nom: '', tarifPhotographe: '450', bonusChefEquipe: '100' }],
    hotel: course.hotel,
    transport: course.transport,
    supplementaire: course.supplementaire,
    hotelValid: course.hotelValid,
    transportValid: course.transportValid,
    hotelPrice: numOrEmpty(course.hotelPrice),
    transportPrice: numOrEmpty(course.transportPrice),
    foodPrice: numOrEmpty(course.foodPrice),
    comOrga: numOrEmpty(course.comOrga),
  };
}

/** Corps envoyé à l'API (POST /api/courses ou PATCH /api/courses/[id]). */
export function payloadFromValues(v: CourseFormValues) {
  return {
    nom: v.nom.trim(),
    localisation: v.localisation.trim(),
    ville: v.localisation.trim(),
    description: v.description,
    dateDebut: new Date(v.dateDebut).toISOString(),
    dateFin: new Date(v.dateFin).toISOString(),
    coureursAttendus: v.coureursAttendus || null,
    numberAttended: v.numberAttended || null,
    hotel: v.hotel,
    transport: v.transport,
    supplementaire: v.supplementaire,
    hotelValid: v.hotelValid,
    transportValid: v.transportValid,
    hotelPrice: v.hotelPrice || null,
    transportPrice: v.transportPrice || null,
    foodPrice: v.foodPrice || null,
    comOrga: v.comOrga || null,
    tarifs: v.tarifs.map((t) => ({
      id: t.id,
      nom: v.tarifs.length > 1 ? t.nom.trim() : '',
      tarifPhotographe: Number(t.tarifPhotographe.replace(',', '.')) || 0,
      bonusChefEquipe: Number(t.bonusChefEquipe.replace(',', '.')) || 0,
    })),
  };
}

interface CourseFormProps {
  course?: CourseJson;
  submitLabel: string;
  onSubmit: (values: CourseFormValues) => Promise<void>;
  onCancel: () => void;
}

export function CourseForm({ course, submitLabel, onSubmit, onCancel }: CourseFormProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm<CourseFormValues>({ resolver: zodResolver(schema), defaultValues: defaultsFromCourse(course) });
  const tarifs = useFieldArray({ control: form.control, name: 'tarifs' });
  const multi = tarifs.fields.length > 1;
  const isDone = course?.statutTraitement === 'done';
  const originalCount = course?.tarifs.length ?? 1;

  const submit = async (values: CourseFormValues) => {
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  const addDay = () => {
    const n = tarifs.fields.length;
    const suggestion = n === 1 ? 'Dimanche' : `Jour ${n + 1}`;
    if (n === 1 && !form.getValues('tarifs.0.nom')) form.setValue('tarifs.0.nom', 'Samedi');
    const first = form.getValues('tarifs.0');
    tarifs.append({ nom: suggestion, tarifPhotographe: first?.tarifPhotographe ?? '450', bonusChefEquipe: first?.bonusChefEquipe ?? '100' });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations principales</CardTitle>
            <CardDescription>Nom, lieu et description de la course</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="nom" render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de la course *</FormLabel>
                <FormControl><Input placeholder="Ex : Marathon de Paris 2027" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="localisation" render={({ field }) => (
              <FormItem>
                <FormLabel>Localisation *</FormLabel>
                <FormControl><Input placeholder="Ex : Paris" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Site de l’événement, consignes…" className="min-h-[90px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={form.control} name="coureursAttendus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Coureurs attendus</FormLabel>
                  <FormControl><Input type="number" inputMode="numeric" placeholder="Ex : 5000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="numberAttended" render={({ field }) => (
                <FormItem>
                  <FormLabel>Photographes attendus</FormLabel>
                  <FormControl><Input type="number" inputMode="numeric" placeholder="Ex : 6" {...field} /></FormControl>
                  <FormDescription>Objectif affiché dans le planning</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
            <CardDescription>Début et fin de la course (heure de Paris)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={form.control} name="dateDebut" render={({ field }) => (
                <FormItem>
                  <FormLabel>Début *</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dateFin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fin *</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Jours et tarifs</CardTitle>
            <CardDescription>
              Un créneau par jour travaillé (ou par tarif). Chaque photographe est placé <b>par créneau</b> : il peut être validé sur le samedi seulement, le dimanche seulement, ou les deux.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tarifs.fields.map((f, index) => (
              <div key={f.id} className="rounded-lg border p-4 dark:border-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {multi ? `Créneau ${index + 1}` : 'Tarif unique'}
                    {f.id && form.getValues(`tarifs.${index}.id`) && <span className="ml-2 text-xs font-normal text-muted-foreground">(existant)</span>}
                  </div>
                  {multi && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => tarifs.remove(index)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Retirer
                    </Button>
                  )}
                </div>
                <div className={`grid grid-cols-1 gap-3 ${multi ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {multi && (
                    <FormField control={form.control} name={`tarifs.${index}.nom`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du créneau *</FormLabel>
                        <FormControl><Input placeholder={index === 0 ? 'Samedi' : 'Dimanche'} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name={`tarifs.${index}.tarifPhotographe`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant photographe (€) *</FormLabel>
                      <FormControl><Input type="number" step="0.01" inputMode="decimal" placeholder="450" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`tarifs.${index}.bonusChefEquipe`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bonus référent (€) *</FormLabel>
                      <FormControl><Input type="number" step="0.01" inputMode="decimal" placeholder="100" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            ))}
            {form.formState.errors.tarifs?.root?.message && (
              <p className="text-sm text-rose-600">{form.formState.errors.tarifs.root.message}</p>
            )}
            {typeof form.formState.errors.tarifs?.message === 'string' && (
              <p className="text-sm text-rose-600">{form.formState.errors.tarifs.message}</p>
            )}
            {tarifs.fields.length < 4 && (
              <Button type="button" variant="outline" size="sm" onClick={addDay}>
                <Plus className="mr-1 h-4 w-4" /> {multi ? 'Ajouter un créneau' : 'Découper en plusieurs jours / tarifs'}
              </Button>
            )}
            {isDone && tarifs.fields.length > originalCount && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Cette course est « Fait ». En ajoutant un créneau, elle repasse <b>En cours</b> : les photographes déjà validés le restent sur leur jour, le nouveau jour est mis en attente pour tout le monde, et vous repasserez la course en Fait une fois le nouveau jour validé.
              </div>
            )}
            {course && tarifs.fields.length < originalCount && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
                Un créneau retiré supprime les disponibilités et validations qui lui étaient rattachées.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logistique</CardTitle>
            <CardDescription>Hébergement, transport et informations pour l’équipe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormField control={form.control} name="hotel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hôtel</FormLabel>
                  <FormControl><Textarea placeholder="Nom, adresse, réservation…" className="min-h-[70px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hotelValid" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} /></FormControl>
                  <FormLabel className="font-normal">Hôtel validé</FormLabel>
                </FormItem>
              )} />
            </div>
            <div className="space-y-2">
              <FormField control={form.control} name="transport" render={({ field }) => (
                <FormItem>
                  <FormLabel>Transport</FormLabel>
                  <FormControl><Textarea placeholder="Covoiturage, train, lieu de rendez-vous…" className="min-h-[70px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="transportValid" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} /></FormControl>
                  <FormLabel className="font-normal">Transport validé</FormLabel>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="supplementaire" render={({ field }) => (
              <FormItem>
                <FormLabel>Informations supplémentaires</FormLabel>
                <FormControl><Textarea placeholder="Autres informations importantes…" className="min-h-[70px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coûts de la course</CardTitle>
            <CardDescription>Budget et dépenses liées à l’événement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {([
                ['hotelPrice', 'Prix de l’hôtel (€)'],
                ['transportPrice', 'Prix des transports (€)'],
                ['foodPrice', 'Prix de la nourriture (€)'],
                ['comOrga', 'Commission organisateur (€)'],
              ] as const).map(([name, label]) => (
                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input type="number" step="0.01" inputMode="decimal" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="submit" disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>) : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
