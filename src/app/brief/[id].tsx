import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import { useEtat } from '@/lib/store';
import { desepinglerBrief, lienDePartage, lireBrief, preparerBriefHorsLigne } from '@/lib/synchro';
import { usePalette } from '@/lib/theme';
import type { BriefComplet } from '@/lib/types';
import { BriefView } from '@/components/brief/BriefView';
import { toast } from '@/components/Toast';
import { Bandeau, Bouton, Texte, Vide } from '@/components/ui';

/** Un brief, lu depuis le téléphone ; rechargé si le réseau le permet et qu'il manque quelque chose. */
export default function EcranBrief() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const local = useEtat((e) => e.briefsLocaux[id]);
  const index = useEtat((e) => e.planning?.briefs?.find((b) => b.id === id) ?? e.briefsParLien[id]);
  const moi = useEtat((e) => e.planning?.me);
  const admin = useEtat((e) => e.utilisateur?.role === 'admin');
  const enLigne = useEtat((e) => e.enLigne);
  const [brief, setBrief] = useState<BriefComplet | null>(null);
  const [charge, setCharge] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(async () => {
    setBrief(await lireBrief(id));
    setCharge(true);
  }, [id]);

  const telecharger = useCallback(
    async (epingler = false) => {
      setEnCours(true);
      setErreur(null);
      try {
        await preparerBriefHorsLigne(id, epingler);
        await relire();
      } catch (err) {
        setErreur(err instanceof Error ? err.message : 'Chargement impossible');
      } finally {
        setEnCours(false);
      }
    },
    [id, relire],
  );

  useEffect(() => {
    let vivant = true;
    void lireBrief(id).then((b) => {
      if (!vivant) return;
      setBrief(b);
      setCharge(true);
    });
    return () => {
      vivant = false;
    };
  }, [id, local?.updatedAt, local?.fichiers]);

  // Brief absent, périmé ou fichiers incomplets : on complète si on a du réseau.
  useEffect(() => {
    if (!charge || !enLigne || enCours) return;
    const perime = index && local && index.updatedAt !== local.updatedAt;
    if (!brief || perime || local?.fichiers === 'partiels' || (local?.fichiers === 'aucun' && !admin)) {
      void Promise.resolve().then(() => telecharger(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge, enLigne]);

  const partager = async () => {
    try {
      const url = admin ? await lienDePartage(id) : brief?.shareUrl ?? index?.shareUrl;
      if (!url) return toast('Pas de lien de partage pour ce brief');
      await Share.share({ message: `${brief?.title ?? 'Brief'} : ${url}`, url });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Partage impossible');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.fond }}>
      <Stack.Screen
        options={{
          title: brief?.title ?? index?.title ?? 'Brief',
          headerRight: () => (
            <Pressable onPress={() => void partager()} hitSlop={10} accessibilityLabel="Partager le lien du brief">
              <Ionicons name="share-outline" size={22} color={p.texte} />
            </Pressable>
          ),
        }}
      />
      {!charge ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : !brief ? (
        <Vide
          icone={enLigne ? 'cloud-download-outline' : 'cloud-offline-outline'}
          titre={enCours ? 'Chargement du brief…' : enLigne ? 'Brief pas encore sur le téléphone' : 'Brief pas disponible hors ligne'}
          texte={erreur ?? (enLigne ? undefined : 'Il sera téléchargé à la prochaine connexion.')}
          action={enLigne && !enCours ? <Bouton titre="Télécharger" icone="download-outline" onPress={() => void telecharger(admin)} /> : null}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={enCours} onRefresh={() => void telecharger(false)} enabled={enLigne} />}>
          {admin && local?.fichiers !== 'complets' ? (
            <Bandeau
              ton="info"
              icone="cloud-download-outline"
              texte="Les images et fichiers de ce brief ne sont pas tous sur le téléphone."
              action={<Bouton titre="Garder hors ligne" petit onPress={() => void telecharger(true)} chargement={enCours} desactive={!enLigne} />}
            />
          ) : null}
          {local?.fichiers === 'partiels' && !admin ? <Bandeau ton="alerte" icone="cloud-offline-outline" texte="Quelques fichiers manquent : ils seront téléchargés au retour du réseau." /> : null}
          {erreur ? <Bandeau ton="danger" icone="alert-circle" texte={erreur} /> : null}
          <BriefView brief={brief} moi={moi ? { prenom: moi.prenom, nom: moi.nom } : null} />
          {admin && local?.epingle ? (
            <Bouton titre="Ne plus garder hors ligne" variante="fantome" petit onPress={() => void desepinglerBrief(id)} />
          ) : null}
          {index?.courseIds?.length === 0 && !admin ? (
            <Texte v="petit" doux style={{ textAlign: 'center' }}>
              Brief ouvert depuis un lien de partage.
            </Texte>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
