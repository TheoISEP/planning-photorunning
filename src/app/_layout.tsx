import * as Network from 'expo-network';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ANNUAIRE_VERROU_ARRIERE_PLAN_MS } from '@/lib/config';
import { synchroniserAnnuaire, verrouillerAnnuaire } from '@/lib/annuaire';
import { verifierMiseAJourAChaud } from '@/lib/majChaud';
import { useEtat } from '@/lib/store';
import { demarrer, fermerAvis, marquerHorsLigne, rafraichirConfig, synchroniser, versionBloquee } from '@/lib/synchro';
import { usePalette } from '@/lib/theme';
import { FournisseurActionsContact } from '@/components/contacts/Actions';
import { EcranMiseAJour } from '@/components/MiseAJour';
import { ZoneToast } from '@/components/Toast';
import { Dialogue } from '@/components/ui';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Racine de l'app : chargement des données gardées sur le téléphone, synchro
 * à l'ouverture, au retour du réseau et au retour dans l'app, écran de mise à
 * jour obligatoire, et verrouillage de l'annuaire en arrière-plan.
 */
export default function Racine() {
  const p = usePalette();
  const charge = useEtat((e) => e.charge);
  const utilisateur = useEtat((e) => e.utilisateur);
  const avis = useEtat((e) => e.avis);
  const bloquee = useEtat((e) => versionBloquee(e) && !e.lectureSeule);
  const quitteeA = useRef<number | null>(null);

  useEffect(() => {
    void demarrer().finally(() => SplashScreen.hide());

    const reseau = Network.addNetworkStateListener((s) => {
      const enLigne = !!s.isConnected && s.isInternetReachable !== false;
      marquerHorsLigne(!enLigne);
      if (enLigne) {
        void synchroniser();
        void synchroniserAnnuaire();
      }
    });

    const etatApp = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') {
        if (quitteeA.current && Date.now() - quitteeA.current > ANNUAIRE_VERROU_ARRIERE_PLAN_MS) verrouillerAnnuaire();
        quitteeA.current = null;
        void rafraichirConfig();
        void synchroniser();
        void verifierMiseAJourAChaud();
      } else if (etat === 'background') {
        quitteeA.current = Date.now();
      }
    });

    return () => {
      reseau.remove();
      etatApp.remove();
    };
  }, []);

  if (!charge) return <View style={{ flex: 1, backgroundColor: p.fond }} />;

  return (
    <SafeAreaProvider>
      <FournisseurActionsContact>
        <StatusBar style={p.sombre ? 'light' : 'dark'} />
        {bloquee ? (
          <EcranMiseAJour />
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: p.carte },
              headerTintColor: p.texte,
              headerTitleStyle: { fontWeight: '700' },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: p.fond },
            }}
          >
            <Stack.Protected guard={!!utilisateur}>
              <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
              <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
              <Stack.Screen name="brief/[id]" options={{ title: 'Brief' }} />
              <Stack.Screen name="annuaire/contact/[id]" options={{ title: 'Contact' }} />
              <Stack.Screen name="annuaire/organisation/[id]" options={{ title: 'Organisation' }} />
            </Stack.Protected>
            <Stack.Protected guard={!utilisateur}>
              <Stack.Screen name="connexion" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="share/[token]" options={{ title: 'Brief partagé' }} />
            <Stack.Screen name="photographer/planning/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" options={{ title: 'Introuvable' }} />
          </Stack>
        )}
        <ZoneToast />
        <Dialogue
          visible={!!avis}
          titre={avis?.titre ?? ''}
          texte={avis?.texte ?? ''}
          confirmer="Compris"
          annuler={null}
          onConfirmer={fermerAvis}
          onFermer={fermerAvis}
        />
      </FournisseurActionsContact>
    </SafeAreaProvider>
  );
}
