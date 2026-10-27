import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { memoriserLien } from '@/lib/liens';
import { lire, useEtat } from '@/lib/store';
import { ouvrirLienDePartage } from '@/lib/synchro';
import { usePalette } from '@/lib/theme';
import { Bouton, Vide } from '@/components/ui';

/**
 * Un lien de partage de brief (https://…/share/<jeton>) ouvert sur un
 * téléphone où l'app est installée : le brief s'ouvre dans l'app et y reste
 * disponible hors ligne. Sans connexion, on attend la connexion puis on l'ouvre.
 */
export default function LienPartage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const p = usePalette();
  const connecte = useEtat((e) => !!e.utilisateur);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!connecte || !token) return;
    // Déjà sur le téléphone (index ou lien déjà ouvert) : on l'ouvre directement.
    const e = lire();
    const connu = [...(e.planning?.briefs ?? []), ...Object.values(e.briefsParLien)].find((b) => b.shareToken === token);
    if (connu && e.briefsLocaux[connu.id]) {
      router.replace(`/brief/${connu.id}`);
      return;
    }
    ouvrirLienDePartage(token)
      .then((id) => router.replace(`/brief/${id}`))
      .catch((err) => setErreur(err instanceof Error ? err.message : 'Lien impossible à ouvrir'));
  }, [connecte, token]);

  if (!connecte) {
    memoriserLien(`/share/${token}`);
    return <Redirect href="/connexion" />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: p.fond }}>
      <Vide
        icone={erreur ? 'alert-circle-outline' : 'document-text-outline'}
        titre={erreur ? 'Ce brief ne peut pas s’ouvrir' : 'Ouverture du brief…'}
        texte={erreur ?? undefined}
        action={erreur ? <Bouton titre="Retour" onPress={() => router.replace('/')} /> : null}
      />
    </View>
  );
}
