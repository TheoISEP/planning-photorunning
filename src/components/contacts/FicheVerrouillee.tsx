import { View } from 'react-native';
import { deverrouillerAnnuaire } from '@/lib/annuaire';
import { usePalette } from '@/lib/theme';
import { Bouton, Vide } from '@/components/ui';

/** Fiche de l'annuaire demandée alors qu'il est verrouillé. */
export function FicheVerrouillee() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.fond }}>
      <Vide
        icone="lock-closed-outline"
        titre="Annuaire verrouillé"
        action={<Bouton titre="Ouvrir avec Face ID" icone="scan-outline" onPress={() => void deverrouillerAnnuaire()} />}
      />
    </View>
  );
}
