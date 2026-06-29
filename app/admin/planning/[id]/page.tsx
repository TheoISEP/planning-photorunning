"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, Users, Euro, FileText, Edit, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/calendrier";
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
	statutTraitement: 'inProgress' | 'validated' | 'done';
	coureursAttendus?: number;
	hotel?: string;
	transport?: string;
	supplementaire?: string;
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
	nonRemunere?: boolean | string;
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
	statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected' | 'nonPris';
	tarifId?: string;
}

export default function AdminCalendrierEventDetailPage() {
	const params = useParams();
	const router = useRouter();
	const eventId = params.id as string;

	const [loading, setLoading] = React.useState(true);
	const [course, setCourse] = React.useState<Course | null>(null);
	const [tarif, setTarif] = React.useState<Tarif | null>(null);
	const [disponibilites, setDisponibilites] = React.useState<Disponibilite[]>([]);
	const [photographers, setPhotographers] = React.useState<Photographer[]>([]);
	const [admins, setAdmins] = React.useState<Admin[]>([]);
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
			setAdmins(adminsData.admins || []);

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

		// Si on passe à "validated" (à valider) ou "done" (fait), montrer le Dialog
		if ((course.statutTraitement === 'inProgress' && (newStatus === 'validated' || newStatus === 'done'))) {
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

		// 1. Capture immédiate des disponibilités à rejeter/marquer comme non pris AVANT toute mise à jour d'état
		const disponibilitesToUpdate = shouldRejectOthers
			? disponibilites.filter((d) => !['validated', 'teamLeader'].includes(d.statut))
			: [];

		// 2. Mise à jour INSTANTANÉE de l'UI (optimiste)
		setCourse({ ...course, statutTraitement: newStatus as Course['statutTraitement'] });

		// Si on doit refuser/marquer les autres, mettre à jour l'UI immédiatement aussi
		if (shouldRejectOthers) {
			setDisponibilites((prev) =>
				prev.map((d) => {
					if (['validated', 'teamLeader'].includes(d.statut)) {
						return d;
					}
					// Refusé pour ceux qui étaient disponibles, non pris pour les autres
					const newStatut = d.statut === 'available' ? 'rejected' : 'nonPris';
					return { ...d, statut: newStatut as Disponibilite['statut'] };
				})
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

		// 4. Mettre à jour le statut de tous les photographes non validés/chef en arrière-plan
		if (disponibilitesToUpdate.length > 0) {
			console.log(`🔄 Mise à jour en masse de ${disponibilitesToUpdate.length} personnes...`);

			// Séparer en deux groupes : ceux à refuser (disponibles) et ceux marqués comme non pris (autres)
			const toReject = disponibilitesToUpdate.filter(d => d.statut === 'available');
			const toMarkNonTaken = disponibilitesToUpdate.filter(d => d.statut !== 'available');

			console.log(`- ${toReject.length} personnes disponibles → Refusé`);
			console.log(`- ${toMarkNonTaken.length} personnes (en attente/pas dispo) → Non pris`);

			// Mettre à jour chaque disponibilité individuellement avec le bon statut
			const updatePromises = [
				...toReject.map(d =>
					fetch('/api/disponibilites', {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							id: d.id,
							statut: 'rejected',
							dateModification: new Date().toISOString(),
						}),
					})
				),
				...toMarkNonTaken.map(d =>
					fetch('/api/disponibilites', {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							id: d.id,
							statut: 'nonPris',
							dateModification: new Date().toISOString(),
						}),
					})
				)
			];

			Promise.all(updatePromises)
				.then(() => {
					console.log(`✅ ${disponibilitesToUpdate.length} personnes mises à jour avec succès`);
				})
				.catch((error) => {
					console.error('❌ Erreur lors de la mise à jour des personnes:', error);
				});
		} else {
			console.log('ℹ️ Aucune personne à mettre à jour (toutes validées ou chef d\'équipe)');
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

	// Filtrer les chefs d'équipe en excluant les admins non rémunérés
	const teamLeaderCount = disponibilites.filter(d => {
		if (d.statut !== "teamLeader") return false;

		// Vérifier si c'est un admin non rémunéré
		const user = admins.find((a) => a.id === d.photographeId);
		const isNonRemunere = user && (user.nonRemunere === 'TRUE' || user.nonRemunere === true);

		return !isNonRemunere;
	}).length;

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
					Retour au calendrier
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

					{(course.hotel || course.transport || course.supplementaire) && (
						<Card>
							<CardHeader>
								<CardTitle>Logistique</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{course.hotel && (
									<div className="flex items-start gap-3">
										<div className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5">🏨</div>
										<div>
											<div className="font-medium">Hôtel</div>
											<div className="text-sm text-muted-foreground whitespace-pre-wrap">{course.hotel}</div>
										</div>
									</div>
								)}

								{course.transport && (
									<div className="flex items-start gap-3">
										<div className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5">🚗</div>
										<div>
											<div className="font-medium">Transport</div>
											<div className="text-sm text-muted-foreground whitespace-pre-wrap">{course.transport}</div>
										</div>
									</div>
								)}

								{course.supplementaire && (
									<div className="flex items-start gap-3">
										<div className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5">ℹ️</div>
										<div>
											<div className="font-medium">Informations supplémentaires</div>
											<div className="text-sm text-muted-foreground whitespace-pre-wrap">{course.supplementaire}</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					)}

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
									<div className="font-medium">Rémunération référent</div>
									<div className="text-sm text-muted-foreground space-y-1">
										<div>Tarif de base: {tarif?.tarifPhotographe}€</div>
										<div>Bonus référent: +{tarif?.bonusChefEquipe}€</div>
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
								<span className="text-muted-foreground">Référents</span>
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
									<SelectItem value="validated">
										<StatusBadge variant="validated" />
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

			{/* Liste des photographes validés - visible si course validée ou terminée */}
			{(course.statutTraitement === 'validated' || course.statutTraitement === 'done') && (
				<Card>
					<CardHeader>
						<CardTitle>Équipe assignée</CardTitle>
						<CardDescription>
							Liste des photographes validés pour cette course
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{disponibilites
								.filter(d => d.statut === 'validated' || d.statut === 'teamLeader')
								.map(dispo => {
									// Chercher dans photographes ET admins
									const person = photographers.find(p => p.id === dispo.photographeId) || admins.find(a => a.id === dispo.photographeId);
									if (!person) return null;

									const isTeamLeader = dispo.statut === 'teamLeader';

									// Vérifier si c'est un admin non rémunéré
									const isAdmin = admins.find(a => a.id === dispo.photographeId);
									const isNonRemunere = isAdmin && (isAdmin.nonRemunere === 'TRUE' || isAdmin.nonRemunere === true);

									const salary = isNonRemunere ? 0 : (isTeamLeader
										? (tarif ? Number(tarif.tarifPhotographe) + Number(tarif.bonusChefEquipe) : 0)
										: (tarif ? Number(tarif.tarifPhotographe) : 0));

									return (
										<div
											key={dispo.id}
											className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
										>
											<div className="flex items-center gap-3">
												<Avatar>
													<AvatarFallback className={isTeamLeader ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}>
														{person.prenom[0]}{person.nom[0]}
													</AvatarFallback>
												</Avatar>
												<div>
													<div className="font-medium">
														{person.prenom} {person.nom}
													</div>
													<div className="text-sm text-muted-foreground">
														{isTeamLeader ? (
															<span className="flex items-center gap-1">
																<Star className="h-3 w-3 text-purple-500" />
																Référent
															</span>
														) : (
															'Photographe'
														)}
													</div>
												</div>
											</div>
											<div className="text-right">
												<div className="font-semibold text-gray-600">
													{salary.toLocaleString("fr-FR")} €
												</div>
												{isTeamLeader && tarif && !isNonRemunere && (
													<div className="text-xs text-muted-foreground">
													  {Number(tarif.tarifPhotographe)}€ + {Number(tarif.bonusChefEquipe)}€ bonus
													</div>
												)}
												{isNonRemunere && (
													<div className="text-xs text-muted-foreground">
													  Non rémunéré
													</div>
												)}
											</div>
										</div>
									);
								})}

							{disponibilites.filter(d => d.statut === 'validated' || d.statut === 'teamLeader').length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									<Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
									<p>Aucun photographe validé pour cette course</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Dialog de confirmation pour passer en "Fait" */}
			<Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<span className="text-2xl">{pendingStatusChange === 'done' ? '🟢' : '✅'}</span>
							Passer la course en "{pendingStatusChange === 'done' ? 'Fait' : 'À valider'}"
						</DialogTitle>
						<DialogDescription className="pt-2">
							{pendingStatusChange === 'done'
								? "Êtes-vous sûr de vouloir marquer cette course comme terminée ?"
								: "Êtes-vous sûr de vouloir marquer cette course comme à valider ?"}
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
										Mettre à jour automatiquement les photographes non validés
									</Label>
									<p className="text-xs text-muted-foreground mt-2">
										Les photographes "Disponible" seront passés en "Refusé", et ceux "En attente" ou "Pas dispo" seront passés en "Non pris". Seuls les photographes "Validé" et "Référent" conserveront leur statut.
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
						<Button onClick={confirmStatusChange} className="bg-gray-600 hover:bg-gray-700">
							Confirmer
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
