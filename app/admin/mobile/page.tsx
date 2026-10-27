'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, Apple, CheckCircle2, Loader2, LogOut, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/components/planning/types';

/**
 * APP MOBILE — page d'administration (27/10/2026).
 *
 * Deux blocs : le réglage des versions (bandeau ou écran bloquant chez ceux
 * qui n'ont pas la bonne version), et la liste des téléphones connectés,
 * qu'on peut déconnecter à distance.
 */

interface Config {
  latestVersion: string;
  minVersion: string;
  message: string;
  iosUrl: string;
  androidUrl: string;
  updatedAt: string;
}

interface Appareil {
  id: string;
  user: { id: string; nom: string; email: string; role: 'admin' | 'photographer' };
  platform: string;
  deviceName: string;
  model: string;
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  updateId: string | null;
  createdAt: string;
  lastSeenAt: string;
  lastSyncAt: string | null;
  revokedAt: string | null;
  etat: 'ok' | 'recommandee' | 'obligatoire';
}

const depuis = (iso: string | null) =>
  iso ? formatDistanceToNowStrict(new Date(iso), { locale: fr, addSuffix: true }) : 'jamais';

export default function AppMobilePage() {
  const [chargement, setChargement] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [brouillon, setBrouillon] = useState<Config | null>(null);
  const [appareils, setAppareils] = useState<Appareil[]>([]);
  const [enregistrement, setEnregistrement] = useState(false);
  const [aDeconnecter, setADeconnecter] = useState<Appareil | null>(null);
  const [aRendreObligatoire, setARendreObligatoire] = useState(false);
  const [voirRevoques, setVoirRevoques] = useState(false);

  const charger = useCallback(async () => {
    try {
      const r = await fetchJson<{ config: Config; appareils: Appareil[] }>('/api/mobile/admin');
      setConfig(r.config);
      setBrouillon(r.config);
      setAppareils(r.appareils);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(t);
  }, [charger]);

  const actifs = useMemo(() => appareils.filter((a) => !a.revokedAt), [appareils]);
  const revoques = useMemo(() => appareils.filter((a) => a.revokedAt), [appareils]);
  const enRetard = actifs.filter((a) => a.etat !== 'ok').length;
  const modifie = !!config && !!brouillon && JSON.stringify(config) !== JSON.stringify(brouillon);

  const enregistrer = async (valeurs: Config) => {
    setEnregistrement(true);
    try {
      const r = await fetchJson<{ config: Config }>('/api/mobile/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valeurs),
      });
      setConfig(r.config);
      setBrouillon(r.config);
      toast.success('Réglage enregistré : il s’applique à la prochaine ouverture de l’app.');
      void charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setEnregistrement(false);
    }
  };

  const deconnecter = async (a: Appareil) => {
    setADeconnecter(null);
    try {
      await fetchJson(`/api/mobile/admin/appareils/${a.id}`, { method: 'DELETE' });
      toast.success(`${a.user.nom} est déconnecté de ce téléphone.`);
      void charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Déconnexion impossible');
    }
  };

  if (chargement || !brouillon || !config) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  const champ = (k: keyof Config) => ({
    value: brouillon[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setBrouillon({ ...brouillon, [k]: e.target.value }),
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tuile titre="Téléphones connectés" valeur={String(actifs.length)} detail={`${actifs.filter((a) => a.platform === 'ios').length} iPhone · ${actifs.filter((a) => a.platform === 'android').length} Android`} />
        <Tuile titre="Dernière version" valeur={config.latestVersion} detail={`Minimum exigé : ${config.minVersion}`} />
        <Tuile
          titre="Pas à jour"
          valeur={String(enRetard)}
          detail={enRetard ? 'verront le bandeau ou l’écran de mise à jour' : 'tout le monde est à jour'}
          alerte={enRetard > 0}
        />
      </div>

      {/* Versions */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold">Mises à jour de l’app</h2>
          <p className="text-sm text-muted-foreground">
            Quand une nouvelle version est publiée sur les stores, indique-la ici. Ceux qui ont une version plus ancienne voient un bandeau
            « Nouvelle version disponible ». Quand tu veux qu’ils la fassent, monte la version minimale : l’app se bloque sur un écran
            « Mets à jour pour continuer » jusqu’à la mise à jour. Les petites corrections arrivent seules, sans passer par les stores.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="latest">Dernière version publiée</Label>
            <Input id="latest" placeholder="1.0.0" {...champ('latestVersion')} />
            <p className="text-xs text-muted-foreground">En dessous : bandeau, l’app reste utilisable.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min">Version minimale exigée</Label>
            <Input id="min" placeholder="1.0.0" {...champ('minVersion')} />
            <p className="text-xs text-muted-foreground">En dessous : écran bloquant. Les données hors ligne restent consultables.</p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="message">Message affiché avec la mise à jour (facultatif)</Label>
            <Textarea id="message" rows={2} placeholder="Ex. : nouvelle version avec les plans de parcours hors ligne." {...champ('message')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ios" className="flex items-center gap-1.5"><Apple className="h-3.5 w-3.5" /> Lien App Store</Label>
            <Input id="ios" placeholder="https://apps.apple.com/…" {...champ('iosUrl')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="android" className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Lien Google Play</Label>
            <Input id="android" placeholder="https://play.google.com/…" {...champ('androidUrl')} />
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Modifié {depuis(config.updatedAt)}.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {config.minVersion !== config.latestVersion && !modifie && (
              <Button variant="outline" onClick={() => setARendreObligatoire(true)} disabled={enregistrement}>
                <AlertTriangle className="mr-2 h-4 w-4" /> Rendre la {config.latestVersion} obligatoire
              </Button>
            )}
            <Button variant="outline" onClick={() => setBrouillon(config)} disabled={!modifie || enregistrement}>Annuler</Button>
            <Button onClick={() => void enregistrer(brouillon)} disabled={!modifie || enregistrement}>
              {enregistrement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </div>
        </div>
      </section>

      {/* Appareils */}
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-base font-semibold">Téléphones connectés</h2>
            <p className="text-sm text-muted-foreground">Qui a l’app, sur quel téléphone, quelle version, et quand il a synchronisé pour la dernière fois.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void charger()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {actifs.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Personne n’est encore connecté à l’app.</p>
        ) : (
          <ul className="divide-y">
            {actifs.map((a) => (
              <LigneAppareil key={a.id} a={a} onDeconnecter={() => setADeconnecter(a)} />
            ))}
          </ul>
        )}
        {revoques.length > 0 && (
          <div className="border-t p-3">
            <Button variant="ghost" size="sm" onClick={() => setVoirRevoques((v) => !v)}>
              {voirRevoques ? 'Masquer' : 'Voir'} les {revoques.length} appareil{revoques.length > 1 ? 's' : ''} déconnecté{revoques.length > 1 ? 's' : ''}
            </Button>
            {voirRevoques && (
              <ul className="mt-2 divide-y opacity-60">
                {revoques.map((a) => <LigneAppareil key={a.id} a={a} />)}
              </ul>
            )}
          </div>
        )}
      </section>

      <Dialog open={!!aDeconnecter} onOpenChange={(o) => !o && setADeconnecter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnecter ce téléphone ?</DialogTitle>
            <DialogDescription>
              {aDeconnecter?.user.nom} sera déconnecté de « {aDeconnecter?.deviceName || aDeconnecter?.model || 'ce téléphone'} ». Dès que le
              téléphone retrouve du réseau, l’app efface le planning, les briefs et les contacts qu’elle gardait. Il pourra se reconnecter
              avec son mot de passe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setADeconnecter(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => aDeconnecter && void deconnecter(aDeconnecter)}>Déconnecter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aRendreObligatoire} onOpenChange={setARendreObligatoire}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rendre la {config.latestVersion} obligatoire ?</DialogTitle>
            <DialogDescription>
              Les {appareils.filter((a) => !a.revokedAt && a.etat !== 'ok').length} téléphone(s) qui ne l’ont pas encore verront l’écran
              « Mets à jour pour continuer » à la prochaine ouverture de l’app. Vérifie d’abord que la version est bien en ligne sur les deux stores.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setARendreObligatoire(false)}>Annuler</Button>
            <Button
              onClick={() => {
                setARendreObligatoire(false);
                void enregistrer({ ...config, minVersion: config.latestVersion });
              }}
            >
              Rendre obligatoire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tuile({ titre, valeur, detail, alerte }: { titre: string; valeur: string; detail: string; alerte?: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', alerte && 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30')}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titre}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{valeur}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function LigneAppareil({ a, onDeconnecter }: { a: Appareil; onDeconnecter?: () => void }) {
  const plateforme = a.platform === 'ios' ? 'iPhone' : a.platform === 'android' ? 'Android' : 'Téléphone';
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-muted p-2">{a.platform === 'ios' ? <Apple className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.user.nom}</span>
            {a.user.role === 'admin' && <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white dark:bg-gray-100 dark:text-gray-900">Admin</span>}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {plateforme} · {a.deviceName || a.model || 'modèle inconnu'}{a.osVersion ? ` · ${a.platform === 'ios' ? 'iOS' : 'Android'} ${a.osVersion}` : ''}
          </div>
          <div className="text-xs text-muted-foreground">
            Connecté le {format(new Date(a.createdAt), 'd MMM yyyy', { locale: fr })} · synchro {depuis(a.lastSyncAt)}
            {a.revokedAt && ` · déconnecté ${depuis(a.revokedAt)}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
            a.etat === 'ok' && 'border-emerald-300 bg-emerald-50 text-emerald-900',
            a.etat === 'recommandee' && 'border-amber-300 bg-amber-50 text-amber-900',
            a.etat === 'obligatoire' && 'border-rose-300 bg-rose-50 text-rose-900',
          )}
          title={a.etat === 'ok' ? 'À jour' : a.etat === 'recommandee' ? 'Voit le bandeau de mise à jour' : 'Bloqué sur l’écran de mise à jour'}
        >
          {a.etat === 'ok' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          v{a.appVersion || '?'}
        </span>
        {onDeconnecter && (
          <Button variant="outline" size="sm" onClick={onDeconnecter}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Déconnecter
          </Button>
        )}
      </div>
    </li>
  );
}
