'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Photographer {
  id: string;
  nom: string;
  prenom: string;
  accord?: string | boolean;
}

const ACCORD_CONTENT = `ACCORD DE SOUS-TRAITANCE – MISSION PHOTOGRAPHIQUE
Entre :
PhotoRunning, société SAS RCLDC, dont le siège est situé à 21 rue Viète 75017 Paris, représentée par Richard Chauland-Lottet, en qualité de Président,
ci-après dénommée le Responsable de Traitement,
Et :
[NOM_PHOTOGRAPHE],
ci-après dénommé le Sous-traitant,
ensemble dénommés les Parties.

1. Objet de l'accord
Le présent accord a pour objet de définir les conditions dans lesquelles le Sous-traitant intervient pour le compte du Responsable de Traitement dans le cadre des prestations de prise de vue photographique lors d'événements sportifs, pour le service PhotoRunning.
Il s'applique rétroactivement à toute mission photographique passée réalisée pour le compte du Responsable de Traitement.

2. Description du traitement sous-traité
• Finalité : Captation d'images des participants afin de leur permettre de retrouver leurs photos souvenirs.
• Type de données traitées : Photographies de personnes identifiables (potentiellement données biométriques au sens large).
• Personnes concernées : Participants à l'événement sportif.
• Durée de conservation par le photographe : 30 jours maximum après livraison.

3. Engagements du Sous-traitant
3.1 Conformité RGPD
• Ne traiter les données (photos) que sur instruction documentée du Responsable de Traitement.
• Ne pas réutiliser les données pour son propre compte.
• Ne pas transmettre les images à des tiers, sauf instruction expresse.
3.2 Confidentialité
• Traiter les photos dans la plus stricte confidentialité.
• Veiller à ce qu'aucune image ne soit diffusée publiquement (réseaux sociaux, portfolio, etc.) sans autorisation écrite préalable.
3.3 Sécurité des données
• Appliquer les mesures de sécurité définies dans la Politique de Sécurité des Systèmes d'Information (PSSI) du Responsable de Traitement, notamment :
o Sécurisation physique et logicielle des appareils de prise de vue (mot de passe, chiffrement, verrouillage automatique, etc.).
o Utilisation de supports de stockage chiffrés (disques durs ou clés USB sécurisées).
o Interdiction du stockage des images sur des supports non sécurisés ou accessibles à des tiers.
• Transmettre les images uniquement via des canaux sécurisés, selon les instructions communiquées par le Responsable de Traitement (ex : serveur FTP sécurisé, lien chiffré, carte mémoire propriétaire etc.).
• Supprimer définitivement toutes les photos à l'issue de la période de conservation (30 jours maximum) et en tout état de cause après confirmation de bonne réception par PhotoRunning.
3.4 Coopération
Coopérer avec le Responsable de Traitement en cas de demande d'exercice des droits par une personne concernée. Alerter sans délai PhotoRunning en cas de violation de données (perte, accès non autorisé, vol d'appareil, etc.).
3.5 Obligations administratives, fiscales et assurantielles
Le Sous-traitant déclare exercer son activité en parfaite conformité avec la réglementation applicable à son statut juridique, social et fiscal.
À ce titre, il s'engage à :
• Être régulièrement immatriculé auprès des organismes compétents et à maintenir cette immatriculation pendant toute la durée de sa collaboration avec PhotoRunning ;
• Respecter l'ensemble de ses obligations déclaratives, fiscales, sociales et comptables ;
• Acquitter l'intégralité des cotisations, contributions, taxes et impôts liés à son activité professionnelle ;
• Disposer de toutes les autorisations éventuellement requises pour l'exercice de son activité,
• Souscrire et maintenir en vigueur une assurance Responsabilité Civile Professionnelle couvrant les dommages pouvant être causés dans le cadre de ses prestations,
• Fournir à première demande de PhotoRunning tout document justifiant de sa situation administrative, fiscale, sociale ou assurantielle.
Le Sous-traitant agit en toute indépendance et demeure seul responsable de ses obligations légales, fiscales, sociales et assurantielles.
PhotoRunning ne pourra en aucun cas être tenue responsable d'un manquement du Sous-traitant à ses obligations administratives, fiscales, sociales ou d'assurance, ni des conséquences financières, juridiques ou pénales qui pourraient en résulter.


4. Droit à l'image et autorisations
Le Sous-traitant reconnaît que :
• Les photos réalisées n'ont aucune vocation artistique ou commerciale hors du service PhotoRunning.
• Toute réutilisation à titre personnel (portfolio, publication, réseaux sociaux) est strictement interdite sans autorisation écrite de PhotoRunning ET de la personne photographiée.

5. Durée de l'accord
Le présent accord est conclu pour la durée de la mission photographique, incluant le temps de traitement et de remise des images.
Il s'applique à chaque événement couvert, y compris ceux passés dans le cadre d'une collaboration antérieure non formalisée.
5 bis. Rémunération et modalités de facturation
Le Sous-traitant est rémunéré selon les tarifs convenus entre les Parties pour chaque événement couvert.
Les Parties conviennent que les prestations réalisées au cours d'un même mois civil feront l'objet d'une facturation récapitulative unique établie en fin de mois par le Sous-traitant.
Cette facture devra préciser, pour chaque événement réalisé :
• la date de l'événement ;
• le nom de l'événement ;
• le lieu de l'événement ;
• le nombre de jours ou d'heures de prestation, le cas échéant ;
• le tarif convenu pour la mission concernée ;
• le montant total dû au titre de l'événement.
La facture récapitulative sera adressée à PhotoRunning au plus tard le dernier jour ouvré du mois concerné.
Sauf accord particulier entre les Parties, les factures sont payables par virement bancaire à trente (30) jours fin de mois à compter de leur date d'émission.
Toute prestation complémentaire non prévue initialement (déplacements exceptionnels, nuitées, frais de stationnement, péages ou autres frais professionnels) devra faire l'objet d'un accord préalable de PhotoRunning et apparaître distinctement sur la facture, accompagnée des justificatifs correspondants.
Les tarifs applicables à chaque événement peuvent être définis par devis, bon de commande, courrier électronique ou tout autre support écrit validé par les Parties. Ces documents font partie intégrante du présent accord.

6. Sanctions – responsabilité
En cas de manquement aux obligations ci-dessus, le Sous-traitant engage sa responsabilité contractuelle et pénale, notamment en cas de diffusion non autorisée de données personnelles, de manquement à la sécurité, ou de non-suppression des données.

7. Loi applicable – juridiction compétente
Le présent accord est régi par le droit français. En cas de litige, compétence exclusive est donnée aux tribunaux du siège social du Responsable de Traitement.`;

export default function PhotographerAccordPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        window.location.href = '/login';
        return;
      }

      const userData = await userRes.json();
      const userId = userData.user.id;

      const res = await fetch(`/api/photographers/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setPhotographer(data.photographer);
        const isSigned = data.photographer.accord === 'TRUE' || data.photographer.accord === true;
        setSigned(isSigned);
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignature = async (checked: boolean) => {
    if (!photographer) return;

    try {
      setSaving(true);

      const res = await fetch(`/api/photographers/${photographer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accord: checked ? 'TRUE' : 'FALSE',
        }),
      });

      if (res.ok) {
        setSigned(checked);
        alert(checked ? 'Accord signé avec succès!' : 'Signature retirée');
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la sauvegarde');
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
          <p className="text-lg font-medium text-gray-900">Erreur de chargement</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => (window.location.href = '/photographer/profil')}
          >
            Retour au profil
          </Button>
        </div>
      </div>
    );
  }

  const accordText = ACCORD_CONTENT.replace(
    '[NOM_PHOTOGRAPHE]',
    `${photographer.prenom} ${photographer.nom}`
  );

  return (
    <div className="h-full overflow-auto">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = '/photographer/profil')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Accord de sous-traitance</h1>
            <p className="text-sm text-gray-600 mt-1">Mission photographique PhotoRunning</p>
          </div>
          {signed && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Signé</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Accord de sous-traitance – Mission photographique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
                  {accordText}
                </pre>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="signature"
                    checked={signed}
                    onCheckedChange={handleSignature}
                    disabled={saving}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="signature"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Je certifie avoir lu et accepté les termes de cet accord de sous-traitance
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      En cochant cette case, vous signez électroniquement cet accord
                    </p>
                  </div>
                </div>
                {saving && (
                  <p className="text-sm text-blue-600 mt-4">Enregistrement en cours...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
