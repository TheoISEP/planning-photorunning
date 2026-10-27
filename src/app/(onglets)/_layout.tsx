import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEtat } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import { BandeauEtat } from '@/components/BandeauEtat';
import { BandeauxMiseAJour } from '@/components/MiseAJour';

/**
 * Les onglets. Photographe : Planning, Briefs, Contacts, Réglages.
 * Admin : les mêmes, plus l'Annuaire.
 */
export default function Onglets() {
  const p = usePalette();
  const admin = useEtat((e) => e.utilisateur?.role === 'admin');
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.fond }}>
      <BandeauxMiseAJour />
      <BandeauEtat />
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: p.primaire,
            tabBarInactiveTintColor: p.texteDoux,
            tabBarStyle: { backgroundColor: p.carte, borderTopColor: p.bord },
            sceneStyle: { backgroundColor: p.fond },
          }}
        >
          <Tabs.Screen
            name="planning"
            options={{ title: 'Planning', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color as string} size={size} /> }}
          />
          <Tabs.Screen
            name="briefs"
            options={{ title: 'Briefs', tabBarIcon: ({ color, size }) => <Ionicons name="document-text" color={color as string} size={size} /> }}
          />
          <Tabs.Screen
            name="contacts"
            options={{ title: 'Contacts', tabBarIcon: ({ color, size }) => <Ionicons name="call" color={color as string} size={size} /> }}
          />
          <Tabs.Screen
            name="annuaire"
            options={{
              title: 'Annuaire',
              href: admin ? undefined : null,
              tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color as string} size={size} />,
            }}
          />
          <Tabs.Screen
            name="reglages"
            options={{ title: 'Réglages', tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color as string} size={size} /> }}
          />
        </Tabs>
      </View>
    </SafeAreaView>
  );
}
