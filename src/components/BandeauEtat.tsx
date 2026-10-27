import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ilYA } from '@/lib/format';
import { useEtat } from '@/lib/store';
import { synchroniserMaintenant } from '@/lib/synchro';
import { usePalette } from '@/lib/theme';

/**
 * Une ligne discrète en haut des onglets : hors ligne ou pas, date de la
 * dernière synchro, changements en attente d'envoi. Toucher relance la synchro.
 */
export function BandeauEtat() {
  const p = usePalette();
  const enLigne = useEtat((e) => e.enLigne);
  const synchro = useEtat((e) => e.synchro);
  const enAttente = useEtat((e) => e.file.length);
  const lectureSeule = useEtat((e) => e.lectureSeule);

  let icone: React.ComponentProps<typeof Ionicons>['name'] = 'checkmark-circle';
  let couleur = p.valideFort;
  let texte = `À jour ${ilYA(synchro.derniere)}`;
  if (synchro.enCours) {
    texte = synchro.etape ? `Synchronisation : ${synchro.etape.toLowerCase()}…` : 'Synchronisation…';
  } else if (!enLigne) {
    icone = 'cloud-offline';
    couleur = p.avertissement;
    texte = `Hors ligne · données du ${synchro.derniere ? new Date(synchro.derniere).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}`;
  } else if (synchro.erreur) {
    icone = 'alert-circle';
    couleur = p.danger;
    texte = `Synchro impossible : ${synchro.erreur}`;
  }
  if (enAttente > 0 && !synchro.enCours) texte += ` · ${enAttente} changement${enAttente > 1 ? 's' : ''} à envoyer`;

  return (
    <Pressable
      disabled={lectureSeule || synchro.enCours}
      onPress={() => void synchroniserMaintenant()}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}
    >
      {synchro.enCours ? <ActivityIndicator size="small" color={p.texteDoux} /> : <Ionicons name={icone} size={14} color={couleur} />}
      <Text numberOfLines={1} style={{ color: p.texteDoux, fontSize: 12, flex: 1 }}>
        {texte}
      </Text>
      <View />
    </Pressable>
  );
}
