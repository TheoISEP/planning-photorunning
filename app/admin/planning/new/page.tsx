"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";
import { toast } from "sonner";

const formSchema = z.object({
	name: z.string().min(1, "Le nom de la course est requis"),
	description: z.string().optional(),
	location: z.string().optional(),
	startDate: z.date({ message: "La date de début est requise" }),
	startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format invalide (HH:MM)"),
	endDate: z.date({ message: "La date de fin est requise" }),
	endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format invalide (HH:MM)"),
	photographerPrice: z.string().min(1, "Le tarif photographe est requis"),
	teamLeaderBonus: z.string().min(1, "Le bonus chef d'équipe est requis"),
	expectedRunners: z.string().optional(),
	hotelNotes: z.string().optional(),
	transportNotes: z.string().optional(),
	specialNotes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewCalendrierEventPage() {
	const router = useRouter();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
			location: "",
			startTime: "09:00",
			endTime: "18:00",
			photographerPrice: "350",
			teamLeaderBonus: "100",
			expectedRunners: "",
			hotelNotes: "",
			transportNotes: "",
			specialNotes: "",
		},
	});

	async function onSubmit(values: FormValues) {
		// Générer un ID unique
		const courseId = `course-${Date.now()}`;

		// Combiner date et heure pour créer les timestamps ISO
		const startDateTime = new Date(values.startDate);
		const [startHour, startMinute] = values.startTime.split(':');
		startDateTime.setHours(parseInt(startHour), parseInt(startMinute));

		const endDateTime = new Date(values.endDate);
		const [endHour, endMinute] = values.endTime.split(':');
		endDateTime.setHours(parseInt(endHour), parseInt(endMinute));

		// Créer la course
		const courseData = {
			id: courseId,
			nom: values.name,
			localisation: values.location || '',
			ville: values.location || '',
			description: values.description || '',
			dateDebut: startDateTime.toISOString(),
			dateFin: endDateTime.toISOString(),
			statutTraitement: 'inProgress' as const,
			coureursAttendus: values.expectedRunners ? parseInt(values.expectedRunners) : undefined,
			dateCreation: new Date().toISOString(),
			creePar: 'admin-001',
			visible: true,
			hotel: values.hotelNotes || '',
			transport: values.transportNotes || '',
			supplementaire: values.specialNotes || '',
		};

		// Créer le tarif
		const tarifData = {
			id: `tarif-${courseId}`,
			courseId: courseId,
			tarifPhotographe: parseFloat(values.photographerPrice),
			bonusChefEquipe: parseFloat(values.teamLeaderBonus),
			dateCreation: new Date().toISOString(),
			dateModification: new Date().toISOString(),
		};

		// Afficher le toast immédiatement
		toast.success('Course créée avec succès');

		// Redirection immédiate vers le calendrier
		window.location.href = '/admin/calendrier';

		// Créer en arrière-plan (ne bloque pas la navigation)
		Promise.all([
			fetch('/api/courses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(courseData),
			}),
			fetch('/api/tarifs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(tarifData),
			})
		]).then(([courseRes, tarifRes]) => {
			if (!courseRes.ok) {
				console.error('Erreur création course en arrière-plan');
			}
			if (!tarifRes.ok) {
				console.error('Erreur création tarif en arrière-plan');
			}
			console.log('✅ Course et tarif créés avec succès en arrière-plan');
		}).catch(error => {
			console.error('❌ Erreur création en arrière-plan:', error);
		});
	}

	return (
		<div className="max-w-4xl mx-auto space-y-6">
			{/* En-tête */}
			<div>
				<Button variant="ghost" size="sm" asChild className="mb-4">
					<Link href="/admin/calendrier">
						<ArrowLeft className="h-4 w-4 mr-2" />
						Retour au calendrier
					</Link>
				</Button>
				<h1 className="text-2xl font-bold tracking-tight">Créer une nouvelle course</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Remplissez les informations de la course
				</p>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					{/* Informations générales */}
					<Card>
						<CardHeader>
							<CardTitle>Informations générales</CardTitle>
							<CardDescription>Détails de la course visibles par les photographes</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Nom de la course *</FormLabel>
										<FormControl>
											<Input placeholder="Marathon de Paris" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="location"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Localisation *</FormLabel>
										<FormControl>
											<Input placeholder="Paris, France" {...field} />
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
								name="expectedRunners"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Nombre de coureurs attendus</FormLabel>
										<FormControl>
											<Input type="number" placeholder="5000" {...field} />
										</FormControl>
										<FormDescription>
											Optionnel, affiché discrètement dans le tableau
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</CardContent>
					</Card>

					{/* Dates et horaires */}
					<Card>
						<CardHeader>
							<CardTitle>Dates et horaires</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<FormField
									control={form.control}
									name="startDate"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>Date de début *</FormLabel>
											<Popover>
												<PopoverTrigger asChild>
													<FormControl>
														<Button
															variant="outline"
															className={cn(
																"w-full pl-3 text-left font-normal",
																!field.value && "text-muted-foreground"
															)}
														>
															{field.value ? (
																format(field.value, "PPP", { locale: fr })
															) : (
																<span>Sélectionner une date</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.value}
														onSelect={field.onChange}
														locale={fr}
													/>
												</PopoverContent>
											</Popover>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="startTime"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Heure de début *</FormLabel>
											<FormControl>
												<Input type="time" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<FormField
									control={form.control}
									name="endDate"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>Date de fin *</FormLabel>
											<Popover>
												<PopoverTrigger asChild>
													<FormControl>
														<Button
															variant="outline"
															className={cn(
																"w-full pl-3 text-left font-normal",
																!field.value && "text-muted-foreground"
															)}
														>
															{field.value ? (
																format(field.value, "PPP", { locale: fr })
															) : (
																<span>Sélectionner une date</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={field.value}
														onSelect={field.onChange}
														locale={fr}
													/>
												</PopoverContent>
											</Popover>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="endTime"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Heure de fin *</FormLabel>
											<FormControl>
												<Input type="time" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Tarifs */}
					<Card>
						<CardHeader>
							<CardTitle>Tarifs</CardTitle>
							<CardDescription>Rémunération des photographes</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<FormField
								control={form.control}
								name="photographerPrice"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Tarif photographe *</FormLabel>
										<FormControl>
											<div className="relative">
												<Input type="number" placeholder="450" {...field} className="pr-8" />
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
											</div>
										</FormControl>
										<FormDescription>Montant à payer au photographe standard</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="teamLeaderBonus"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Bonus chef d&apos;équipe *</FormLabel>
										<FormControl>
											<div className="relative">
												<Input type="number" placeholder="250" {...field} className="pr-8" />
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
											</div>
										</FormControl>
										<FormDescription>
											Montant additionnel pour le chef d&apos;équipe (pré-rempli avec la valeur par défaut)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</CardContent>
					</Card>

					{/* Notes administratives privées */}
					<Card>
						<CardHeader>
							<CardTitle>Notes administratives</CardTitle>
							<CardDescription>Informations privées visibles uniquement par les admins</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<FormField
								control={form.control}
								name="hotelNotes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Hôtel</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Informations sur l'hébergement..."
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
								name="transportNotes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Transport</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Informations sur le transport..."
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
								name="specialNotes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Informations particulières</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Notes diverses..."
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

					{/* Actions */}
					<div className="flex justify-end gap-4">
						<Button type="button" variant="outline" onClick={() => router.back()}>
							Annuler
						</Button>
						<Button type="submit">
							Créer la course
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
}
