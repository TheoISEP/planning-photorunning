'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface AvailabilityCellProps {
  disponibilite: {
    id: string;
    statut: 'pending' | 'available' | 'unavailable' | 'validated' | 'teamLeader' | 'rejected';
    photographeId: string;
    tarifId?: string;
  } | null;
  course: {
    id: string;
    statutTraitement: 'inProgress' | 'done';
  };
  photographerId: string;
  onStatusChange: (disponibiliteId: string, newStatus: string, courseId: string, photographerId: string) => void;
  tarifDescription?: string;
  tarifAmount?: number;
  bonusChefEquipe?: number;
  isUpdating?: boolean;
}

export function AvailabilityCell({
  disponibilite,
  course,
  photographerId,
  onStatusChange,
  tarifDescription,
  tarifAmount,
  bonusChefEquipe,
  isUpdating = false,
}: AvailabilityCellProps) {
  // Fonction pour obtenir le label d'un statut
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Attente',
      available: 'Dispo',
      unavailable: 'Pas dispo',
      validated: 'Validé',
      teamLeader: 'Ref',
      rejected: 'Refusé',
    };
    return labels[status] || status;
  };

  // Fonction pour obtenir la classe CSS selon le statut
  const getStatusColorClass = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 border-yellow-300 text-yellow-900 hover:bg-yellow-200',
      available: 'bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200',
      unavailable: 'bg-gray-200 border-gray-400 text-gray-900 hover:bg-gray-300',
      validated: 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200',
      teamLeader: 'bg-purple-100 border-purple-300 text-purple-900 hover:bg-purple-200',
      rejected: 'bg-red-100 border-red-300 text-red-900 hover:bg-red-200',
    };
    return colors[status] || 'bg-white border-gray-300';
  };

  // Déterminer si la modification est autorisée
  // Règle : course.statutTraitement === 'inProgress' ET (pas de disponibilité OU statut dans ['pending', 'available', 'unavailable'])
  const canModify = course.statutTraitement === 'inProgress' &&
                     (!disponibilite || ['pending', 'available', 'unavailable'].includes(disponibilite.statut));

  // Si pas de disponibilité, créer une disponibilité temporaire en "pending"
  const currentStatut = disponibilite?.statut || 'pending';
  // Inclure le tarifId dans l'ID temporaire si présent
  const disponibiliteId = disponibilite?.id ||
    (disponibilite?.tarifId
      ? `dispo-${course.id}-${photographerId}-${disponibilite.tarifId}`
      : `dispo-${course.id}-${photographerId}`);

  // Si le photographe peut modifier
  if (canModify) {
    return (
      <>
        <Select
          value={currentStatut}
          onValueChange={(value) => onStatusChange(disponibiliteId, value, course.id, photographerId)}
          disabled={isUpdating}
        >
          <SelectTrigger
            className={cn(
              'h-10 md:h-9 text-sm w-full min-w-[110px] border transition-all focus:border-gray-600 px-3 font-medium touch-manipulation',
              getStatusColorClass(currentStatut),
              isUpdating && 'opacity-60 cursor-wait'
            )}
          >
            <SelectValue>
              {isUpdating ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Enregistrement...</span>
                </div>
              ) : (
                getStatusLabel(currentStatut)
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            <SelectItem value="pending" className="h-10 md:h-9">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                <span className="text-sm">Attente</span>
              </div>
            </SelectItem>
            <SelectItem value="available" className="h-10 md:h-9">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-sm">Dispo</span>
              </div>
            </SelectItem>
            <SelectItem value="unavailable" className="h-10 md:h-9">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                <span className="text-sm">Pas dispo</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {tarifDescription && (
          <div className="text-[9px] w-full text-center text-gray-600 mt-1">
            {tarifDescription}
          </div>
        )}
      </>
    );
  }

  // Sinon, afficher en lecture seule (statut validé, chef, refusé, ou course terminée)
  // Si pas de disponibilité, ne rien afficher
  if (!disponibilite) {
    return null;
  }

  // Calculer le tarif à afficher si validé
  const isValidated = currentStatut === 'validated' || currentStatut === 'teamLeader';
  const displayAmount = isValidated && tarifAmount
    ? (currentStatut === 'teamLeader' && bonusChefEquipe
        ? tarifAmount + bonusChefEquipe
        : tarifAmount)
    : null;

  return (
    <>
      <div
        className={cn(
          'h-10 md:h-9 text-sm w-full min-w-[110px] border px-3 font-medium flex flex-col items-center justify-center rounded-md',
          getStatusColorClass(currentStatut)
        )}
      >
        <div>{getStatusLabel(currentStatut)}</div>
        {displayAmount && (
          <div className="text-xs font-bold mt-0.5">
            💰 {displayAmount}€
          </div>
        )}
      </div>
      {tarifDescription && (
        <div className="text-[9px] w-full text-center text-gray-600 mt-1">
          {tarifDescription}
        </div>
      )}
    </>
  );
}
