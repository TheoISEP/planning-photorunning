'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUT_META, type Statut } from './statuts';

interface StatutSelectProps {
  value: Statut;
  options: Statut[];
  onChange: (value: Statut) => void;
  /** libellé du créneau (« Samedi »…) affiché au-dessus */
  label?: string;
  /** décision prise mais pas encore visible du photographe */
  hidden?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Sélecteur de statut compact, coloré selon la valeur. Utilisé dans la grille
 * admin (7 options) et dans le planning photographe (3 options).
 */
export function StatutSelect({ value, options, onChange, label, hidden, disabled, loading, size = 'sm', className }: StatutSelectProps) {
  const meta = STATUT_META[value] ?? STATUT_META.pending;
  return (
    <div className={cn('w-full', className)}>
      {label && <div className="mb-0.5 truncate text-[10px] font-medium text-muted-foreground">{label}</div>}
      <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v as Statut)} disabled={disabled || loading}>
        <SelectPrimitive.Trigger
          title={hidden ? `${meta.label} — pas encore visible du photographe (course en cours)` : meta.label}
          className={cn(
            'flex w-full items-center justify-between gap-1 rounded-md border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400/40 disabled:cursor-not-allowed disabled:opacity-60',
            size === 'sm' ? 'h-7 px-1.5 text-[11px]' : 'h-9 px-3 text-sm',
            meta.chip
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
            <span className="truncate">{size === 'sm' ? meta.short : meta.label}</span>
          </span>
          {loading ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-70" />
          ) : hidden ? (
            <EyeOff className="h-3 w-3 shrink-0 opacity-60" aria-label="Non publié" />
          ) : null}
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-[100] min-w-[9rem] overflow-hidden rounded-lg border bg-white p-1 shadow-xl dark:bg-gray-950"
          >
            <SelectPrimitive.Viewport>
              {options.map((opt) => {
                const m = STATUT_META[opt];
                return (
                  <SelectPrimitive.Item
                    key={opt}
                    value={opt}
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-7 text-xs outline-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-800"
                  >
                    <span className={cn('h-2 w-2 rounded-full', m.dot)} />
                    <SelectPrimitive.ItemText>{m.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2">
                      <Check className="h-3.5 w-3.5" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
