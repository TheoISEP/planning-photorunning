import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { initiales } from '@/lib/format';
import { rayon, usePalette } from '@/lib/theme';
import type { Annuaire, ContactAnnuaire } from '@/lib/types';
import { Texte } from '@/components/ui';

/** Une personne de l'annuaire en liste : initiales cerclées de la couleur de sa thématique. */
export function LigneContact({ c, donnees }: { c: ContactAnnuaire; donnees: Annuaire }) {
  const p = usePalette();
  const org = c.organisationId ? donnees.organisations.find((o) => o.id === c.organisationId) : undefined;
  const t = donnees.thematiques.find((x) => x.id === (c.thematiqueIds[0] ?? org?.thematiqueId));
  const favori = donnees.favoris.includes(c.id);
  return (
    <Pressable
      onPress={() => router.push(`/annuaire/contact/${c.id}`)}
      style={({ pressed }) => ({ backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.carte2, borderWidth: 2, borderColor: t?.couleur ?? p.bord, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: p.texte, fontWeight: '800' }}>{initiales(c.prenom, c.nom)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Texte v="fort" numberOfLines={1}>
          {favori ? '★ ' : ''}
          {c.prenom} {c.nom}
        </Texte>
        <Texte v="petit" doux numberOfLines={1}>
          {[c.poste, org?.nom].filter(Boolean).join(' · ') || t?.nom || ' '}
        </Texte>
      </View>
      {c.importance === 1 ? <Ionicons name="star" size={14} color={p.avertissement} /> : null}
      <Ionicons name="chevron-forward" size={18} color={p.texteDoux} />
    </Pressable>
  );
}
