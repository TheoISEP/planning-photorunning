"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, Users, Euro, FileText, Edit, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/planning";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Course {
	id: string;
	nom: string;
	localisation: string;
	description?: string;
	dateDebut: string;
	dateFin: string;
	statutTraitement: 'inProgress' | 'done';
	coureursAttendus?: number;
}

interface Photographer {
	id: string;
	nom: string;
	prenom: string;
}

interface Admin {
	id: string;
	nom: string;
	prenom: string;
}

interface Tarif {
	id: string;
	courseId: string;
	tarifPhotographe: number;
	bonusChefEquipe: number;
}

interface Disponibilite {
	id: string;
	photographeId: string;
	courseId: string;
	statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected';
}

export default function AdminPlanningEventDetailPage() {
	const params = useParams();
	const router = useRouter();
	const eventId = params.id as string;

	const [loading, setLoading] = React.useState(true);
	const [course, setCourse] = React.useState<Course | null>(null);
	const [tarif, setTarif] = React.useState<Tarif | null>(null);
	const [disponibilites, setDisponibilites] = React.useState<Disponibilite[]>([]);
	const [photographers, setPhotographers] = React.useState<Photographer[]>([]);
	const [showStatusDialog, setShowStatusDialog] = React.useState(false);
	const [rejectOthers, setRejectOthers] = React.useState(true);
	const [pendingStatusChange, setPendingStatusChange] = React.useState<string | null>(null);

	React.useEffect(() => {
		fetchCourseData();
	}, [eventId]);

	const fetchCourseData = async () => {
		try {
			setLoading(true);

			const [coursesRes, photographersRes, adminsRes, tarifsRes, disponibilitesRes] = await Promise.all([
				fetch('/api/courses'),
				fetch('/api/photographers'),
				fetch('/api/admins'),
				fetch(`/api/tarifs?courseId=${eventId}`),
				fetch(`/api/disponibilites?courseId=${eventId}`),
			]);

			const [coursesData, photographersData, adminsData, tarifsData, disponibilitesData] = await Promise.all([
				coursesRes.json(),
				photographersRes.json(),
				adminsRes.json(),
				tarifsRes.json(),
				disponibilitesRes.json(),
			]);

			const foundCourse = coursesData.courses?.find((c: Course) => c.id === eventId);
			if (!foundCourse) {
				router.push('/admin/planning');
				return;
			}

			setCourse(foundCourse);
			setPhotographers(photographersData.photographers || []);

			// Récupérer le premier tarif depuis l'API (ou créer un tarif par défaut)
			const courseTarifs = tarifsData.tarifs || [];
			const courseTarif = courseTarifs.length > 0 ? courseTarifs[0] : {
				id: `tarif-${eventId}`,
				courseId: eventId,
				tarifPhotographe: 450,
				bonusChefEquipe: 250,
			};
			setTarif(courseTarif);

			// Charger les vraies disponibilités depuis l'API
			const realDisponibilites = disponibilitesData.disponibilites || [];

			// Créer une map des disponibilités par photographeId pour accès rapide
			const dispoMap = new Map();
			realDisponibilites.forEach((dispo: Disponibilite) => {
				dispoMap.set(dispo.photographeId, dispo);
			});

			// Combiner photographes ET admins
			const allPeople = [
				...(photographersData.photographers || []),
				...(adminsData.admins || [])
			];

			console.log(`📋 Chargement de ${allPeople.length} personnes (photographes + admins) pour la course ${eventId}`);

			// Pour chaque personne (photographe ou admin), utiliser la disponibilité existante ou créer une mockée
			const allDisponibilites: Disponibilite[] = allPeople.map((person: Photographer | Admin) => {
				const existingDispo = dispoMap.get(person.id);
				if (existingDispo) {
					return existingDispo;
				}
				// Si aucune disponibilité n'existe, créer une mockée avec statut pending
				return {
					id: `dispo-${eventId}-${person.id}`,
					photographeId: person.id,
					courseId: eventId,
					statut: 'pending' as const,
				};
			});

			setDisponibilites(allDisponibilites);

		} catch (error) {
			console.error('Erreur chargement course:', error);
			router.push('/admin/planning');
		} finally {
			setLoading(false);
		}
	};

	const handleStatusChange = async (disponibiliteId: string, newStatus: string) => {
		try {
			const res = await fetch('/api/disponibilites', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: disponibiliteId,
					statut: newStatus,
					dateModification: new Date().toISOString(),
				}),
			});

			if (res.ok) {
				setDisponibilites((prev) =>
					prev.map((d) =>
						d.id === disponibiliteId
							? { ...d, statut: newStatus as Disponibilite['statut'] }
							: d
					)
				);
			}
		} catch (error) {
			console.error('Erreur mise à jour statut:', error);
		}
	};

	const handleProcessingStatusChange = async (newStatus: string) => {
		if (!course) return;

		// Si on passe de "inProgress" à "done", montrer le Dialog
		if (course.statutTraitement === 'inProgress' && newStatus === 'done') {
			setPendingStatusChange(newStatus);
			setShowStatusDialog(true);
			return;
		}

		// Sinon, mettre à jour directement
		await updateCourseStatus(newStatus, false);
	};

	const confirmStatusChange = async () => {
		if (!pendingStatusChange || !course) return;

		setShowStatusDialog(false);
		await updateCourseStatus(pendingStatusChange, rejectOthers);
		setPendingStatusChange(null);
	};

	const updateCourseStatus = async (newStatus: string, shouldRejectOthers: boolean) => {
		if (!course) return;

		// 1. Capture immédiate des disponibilités à rejeter AVANT toute mise à jour d'état
		const disponibilitesToReject = shouldRejectOthers
			? disponibilites.filter((d) => !['validated', 'teamLeader'].includes(d.statut))
			: [];

		// 2. Mise à jour INSTANTANÉE de l'UI (optimiste)
		setCourse({ ...course, statutTraitement: newStatus as Course['statutTraitement'] });

		// Si on doit refuser les autres, mettre à jour l'UI immédiatement aussi
		if (shouldRejectOthers) {
			setDisponibilites((prev) =>
				prev.map((d) =>
					!['validated', 'teamLeader'].includes(d.statut)
						? { ...d, statut: 'rejected' as Disponibilite['statut'] }
						: d
				)
			);
		}

		// 3. Mise à jour de la course en arrière-plan
		fetch('/api/courses', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: course.id,
				statutTraitement: newStatus,
				dateModification: new Date().toISOString(),
			}),
		}).catch((error) => {
			console.error('Erreur mise à jour statut traitement:', error);
		});

		// 4. Rejeter tous les photographes non validés/chef en arrière-plan (bulk update)
		if (disponibilitesToReject.length > 0) {
			console.log(`🔄 Rejet en masse de ${disponibilitesToReject.length} personnes...`);
			console.log('Personnes à rejeter:', disponibilitesToReject.map(d => ({
				id: d.photographeId,
				statut: d.statut
			})));

			// Utiliser le bulk update endpoint (1 seul appel API au lieu de N appels)
			// Envoyer à la fois l'ID et le photographeId pour permettre la création si nécessaire
			const disponibilitesData = disponibilitesToReject.map(d => ({
				id: d.id,
				photographeId: d.photographeId,
			}));

			fetch('/api/disponibilites', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					disponibilites: disponibilitesData,
					statut: 'rejected',
					courseId: course.id,
				}),
			})
				.then(async (res) => {
					if (res.ok) {
						const data = await res.json();
						if (data.created > 0) {
							console.log(`✅ ${data.updated} mises à jour + ${data.created} créées = ${data.count} personnes rejetées`);
						} else {
							console.log(`✅ ${data.count} personnes rejetées avec succès en une seule requête`);
						}
					} else {
						console.error('❌ Erreur lors du rejet en masse');
					}
				})
				.catch((error) => {
					console.error('❌ Erreur lors du rejet des personnes:', error);
				});
		} else {
			console.log('ℹ️ Aucune personne à rejeter (toutes validées ou chef d\'équipe)');
		}
	};

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-600 mx-auto"></div>
					<p className="mt-4 text-sm text-muted-foreground">Chargement de la course...</p>
				</div>
			</div>
		);
	}

	if (!course) return null;

	const validatedCount = disponibilites.filter(d => d.statut === "validated").length;
	const teamLeaderCount = disponibilites.filter(d => d.statut === "teamLeader").length;
	const totalCost = tarif
		? (validatedCount * Number(tarif.tarifPhotographe)) + (teamLeaderCount * (Number(tarif.tarifPhotographe) + Number(tarif.bonusChefEquipe)))
		: 0;

	return (
		<div className="max-w-5xl mx-auto space-y-6">
			<div>
				<Button
					variant="ghost"
					size="sm"
					className="mb-4"
					onClick={() => {
						// Force un rechargement complet de la page
						window.location.href = '/admin/planning';
					}}
				>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Retour au planning
				</Button>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex-1">
						<div className="flex items-center gap-3 flex-wrap">
							<h1 className="text-2xl font-bold tracking-tight">{course.nom}</h1>
							<Badge variant={course.statutTraitement === "done" ? "default" : "secondary"}>
								<StatusBadge variant={course.statutTraitement} showIcon className="text-[10px]" />
							</Badge>
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Gérez les détails et affectations de la course
						</p>
					</div>
					<Button size="sm" asChild className="w-full sm:w-auto">
						<Link href={`/admin/planning/${eventId}/edit`}>
							<Edit className="h-4 w-4 mr-2" />
							Modifier
						</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Détails de la course</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start gap-3">
								<Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
								<div>
									<div className="font-medium">Dates</div>
									<div className="text-sm text-muted-foreground">
										{format(new Date(course.dateDebut), "PPP 'à' HH:mm", { locale: fr })}
										{" - "}
										{format(new Date(course.dateFin), "PPP 'à' HH:mm", { locale: fr })}
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
								<div>
									<div className="font-medium">Localisation</div>
									<div className="text-sm text-muted-foreground">{course.localisation}</div>
								</div>
							</div>

							{course.description && (
								<div className="flex items-start gap-3">
									<FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
									<div>
										<div className="font-medium">Description</div>
										<div className="text-sm text-muted-foreground">{course.description}</div>
									</div>
								</div>
							)}

							{course.coureursAttendus && (
								<div className="flex items-start gap-3">
									<Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
									<div>
										<div className="font-medium">Coureurs attendus</div>
										<div className="text-sm text-muted-foreground">{course.coureursAttendus.toLocaleString("fr-FR")}</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Rémunération</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-start gap-3">
								<Euro className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
								<div className="flex-1">
									<div className="font-medium">Tarif photographe standard</div>
									<div className="text-sm text-muted-foreground">{tarif?.tarifPhotographe}€</div>
								</div>
							</div>

							<Separator />

							<div className="flex items-start gap-3">
								<Star className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
								<div className="flex-1">
									<div className="font-medium">Rémunération chef d&apos;équipe</div>
									<div className="text-sm text-muted-foreground space-y-1">
										<div>Tarif de base: {tarif?.tarifPhotographe}€</div>
										<div>Bonus chef d&apos;équipe: +{tarif?.bonusChefEquipe}€</div>
										<div className="font-medium text-foreground">
											Total: {tarif ? Number(tarif.tarifPhotographe) + Number(tarif.bonusChefEquipe) : 0}€
										</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Récapitulatif</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex justify-between items-center text-sm">
								<span className="text-muted-foreground">Photographes validés</span>
								<span className="font-medium">{validatedCount}</span>
							</div>
							<div className="flex justify-between items-center text-sm">
								<span className="text-muted-foreground">Chefs d&apos;équipe</span>
								<span className="font-medium">{teamLeaderCount}</span>
							</div>
							<Separator />
							<div className="flex justify-between items-center">
								<span className="font-medium">Coût total</span>
								<span className="text-lg font-bold">{totalCost.toLocaleString("fr-FR")} €</span>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Statut de traitement</CardTitle>
						</CardHeader>
						<CardContent>
							<Select
								key={`status-${course.statutTraitement}`}
								value={course.statutTraitement}
								onValueChange={handleProcessingStatusChange}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="inProgress">
										<StatusBadge variant="inProgress" />
									</SelectItem>
									<SelectItem value="done">
										<StatusBadge variant="done" />
									</SelectItem>
								</SelectContent>
							</Select>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Dialog de confirmation pour passer en "Fait" */}
			<Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<span className="text-2xl">🟢</span>
							Passer la course en "Fait"
						</DialogTitle>
						<DialogDescription className="pt-2">
							Êtes-vous sûr de vouloir marquer cette course comme terminée ?
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
							<div className="flex items-start gap-3">
								<Checkbox
									id="reject-others"
									checked={rejectOthers}
									onCheckedChange={(checked) => setRejectOthers(checked as boolean)}
									className="mt-1"
								/>
								<div className="flex-1">
									<Label
										htmlFor="reject-others"
										className="text-sm font-medium leading-none cursor-pointer"
									>
										Refuser automatiquement les photographes non validés
									</Label>
									<p className="text-xs text-muted-foreground mt-2">
										Tous les photographes avec les statuts "En attente", "Disponible" ou "Pas dispo" seront automatiquement passés en "Refusé". Seuls les photographes "Validé" et "Chef d&apos;équipe" seront conservés.
									</p>
								</div>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowStatusDialog(false);
								setPendingStatusChange(null);
							}}
						>
							Annuler
						</Button>
						<Button onClick={confirmStatusChange} className="bg-green-600 hover:bg-green-700">
							Confirmer
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
