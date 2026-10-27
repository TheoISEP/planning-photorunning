import { router } from 'expo-router';
import { View } from 'react-native';
import { usePalette } from '@/lib/theme';
import { Bouton, Vide } from '@/components/ui';

export default function Introuvable() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.fond }}>
      <Vide
        icone="help-circle-outline"
        titre="Page introuvable"
        texte="Ce lien ne mène à rien dans l’app."
        action={<Bouton titre="Retour au planning" onPress={() => router.replace('/')} />}
      />
    </View>
  );
}
