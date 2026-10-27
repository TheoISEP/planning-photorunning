import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { versionInstallee } from '@/lib/appareil';
import { useEtat } from '@/lib/store';
import { passerEnLectureSeule } from '@/lib/synchro';
import { usePalette } from '@/lib/theme';
import { etatDeVersion } from '@/lib/versions';
import { Bouton, Texte } from './ui';

/**
 * Les mises à jour, réglées depuis l'admin du planning (« App mobile ») :
 *  - version obligatoire : écran bloquant, avec une porte de sortie pour
 *    consulter ses données hors ligne sans rien synchroniser (jour de course
 *    sans réseau : on ne doit jamais perdre l'accès à son brief) ;
 *  - version recommandée : bandeau en haut des onglets ;
 *  - correction arrivée à chaud (EAS Update) : bandeau « Redémarrer ».
 */

function lienStore(config: { iosUrl: string; androidUrl: string } | null): string {
  if (Platform.OS === 'ios') return config?.iosUrl || 'itms-apps://apps.apple.com';
  return config?.androidUrl || 'market://details?id=com.photorunning.equipe';
}

export function EcranMiseAJour() {
  const p = usePalette();
  const config = useEtat((e) => e.config);
  const aDesDonnees = useEtat((e) => !!e.planning);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.fond }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 16 }}>
        <View style={{ alignSelf: 'center', backgroundColor: p.primaireDoux, borderRadius: 999, padding: 20 }}>
          <Ionicons name="arrow-up-circle" size={48} color={p.primaire} />
        </View>
        <Texte v="titre" style={{ textAlign: 'center' }}>
          Mets à jour l’app
        </Texte>
        <Texte doux style={{ textAlign: 'center' }}>
          Une nouvelle version de PhotoRunning Équipe est nécessaire pour continuer (tu as la {versionInstallee()}, il faut la{' '}
          {config?.minVersion ?? 'dernière'}).
        </Texte>
        {config?.message ? (
          <View style={{ backgroundColor: p.carte, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: p.bord }}>
            <Texte>{config.message}</Texte>
          </View>
        ) : null}
        <Bouton titre="Mettre à jour" icone="download-outline" onPress={() => void Linking.openURL(lienStore(config))} />
        {aDesDonnees ? (
          <Bouton
            titre="Consulter mes données hors ligne"
            variante="fantome"
            onPress={passerEnLectureSeule}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function BandeauxMiseAJour() {
  const p = usePalette();
  const config = useEtat((e) => e.config);
  const lectureSeule = useEtat((e) => e.lectureSeule);
  const { isUpdatePending } = Updates.useUpdates();
  const etat = etatDeVersion(versionInstallee(), config);

  if (lectureSeule) {
    return (
      <Pressable onPress={() => void Linking.openURL(lienStore(config))} style={{ backgroundColor: p.danger, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="alert-circle" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '600', flex: 1 }}>Version trop ancienne : rien n’est synchronisé. Touche pour mettre à jour.</Text>
      </Pressable>
    );
  }
  if (isUpdatePending) {
    return (
      <Pressable onPress={() => void Updates.reloadAsync()} style={{ backgroundColor: p.primaire, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="refresh-circle" size={18} color={p.primaireTexte} />
        <Text style={{ color: p.primaireTexte, fontWeight: '600', flex: 1 }}>Une amélioration est prête. Touche pour redémarrer l’app.</Text>
      </Pressable>
    );
  }
  if (etat === 'recommandee') {
    return (
      <Pressable onPress={() => void Linking.openURL(lienStore(config))} style={{ backgroundColor: p.avertissementDoux, borderBottomWidth: 1, borderColor: p.avertissement, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="sparkles" size={16} color={p.avertissement} />
        <Text style={{ color: p.avertissementTexte, fontWeight: '600', flex: 1 }}>
          Nouvelle version {config?.latestVersion} disponible{config?.message ? ` : ${config.message}` : ''}. Touche pour l’installer.
        </Text>
      </Pressable>
    );
  }
  return null;
}
