import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { normaliser, plageDeDates } from '@/lib/format';
import { useEtat } from '@/lib/store';
import { synchroniserMaintenant } from '@/lib/synchro';
import { rayon, usePalette } from '@/lib/theme';
import type { BriefIndex } from '@/lib/types';
import { Texte, Vide } from '@/components/ui';

/**
 * Les briefs : ceux des courses où l'on est retenu, plus ceux ouverts par un
 * lien. Chez un admin, tous.
 * Chaque ligne dit si le brief est complet sur le téléphone.
 */
export default function OngletBriefs() {
  const p = usePalette();
  const index = useEtat((e) => e.planning?.briefs);
  const parLien = useEtat((e) => e.briefsParLien);
  const locaux = useEtat((e) => e.briefsLocaux);
  const courses = useEtat((e) => e.planning?.courses);
  const admin = useEtat((e) => e.utilisateur?.role === 'admin');
  const enCours = useEtat((e) => e.synchro.enCours);
  const [recherche, setRecherche] = useState('');
  const [maintenant] = useState(() => Date.now());

  const { aVenir, passes } = useMemo(() => {
    const tous = new Map<string, BriefIndex>();
    for (const b of index ?? []) tous.set(b.id, b);
    for (const b of Object.values(parLien)) if (!tous.has(b.id)) tous.set(b.id, b);
    const q = normaliser(recherche.trim());
    const liste = [...tous.values()].filter((b) => !q || normaliser(`${b.title} ${b.folderName ?? ''}`).includes(q));
    const hier = maintenant - 86_400_000;
    const date = (b: BriefIndex) => (b.eventDate ? new Date(b.eventDate).getTime() : 0);
    return {
      aVenir: liste.filter((b) => date(b) >= hier).sort((a, b) => date(a) - date(b)),
      passes: liste.filter((b) => date(b) < hier).sort((a, b) => date(b) - date(a)),
    };
  }, [index, parLien, recherche, maintenant]);

  const nomsCourses = (b: BriefIndex) =>
    b.courseIds
      .map((id) => courses?.find((c) => c.id === id)?.nom)
      .filter(Boolean)
      .join(', ');

  const Ligne = ({ b }: { b: BriefIndex }) => {
    const l = locaux[b.id];
    const etat = !l ? 'absent' : l.fichiers === 'complets' ? 'complet' : l.fichiers === 'partiels' ? 'partiel' : 'texte';
    const libelle = { absent: 'Pas encore sur le téléphone', complet: 'Disponible hors ligne', partiel: 'Hors ligne, fichiers incomplets', texte: 'Texte hors ligne, fichiers à la demande' }[etat];
    const couleur = { absent: p.texteDoux, complet: p.valideFort, partiel: p.avertissement, texte: p.texteDoux }[etat];
    return (
      <Pressable
        onPress={() => router.push(`/brief/${b.id}`)}
        style={({ pressed }) => ({
          backgroundColor: p.carte,
          borderRadius: rayon.moyen,
          borderWidth: 1,
          borderColor: p.bord,
          padding: 14,
          gap: 4,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Texte v="fort" style={{ flex: 1 }}>
            {b.title}
          </Texte>
          {parLien[b.id] && !index?.some((x) => x.id === b.id) ? <Ionicons name="link" size={16} color={p.texteDoux} /> : null}
        </View>
        {b.eventDate ? <Texte v="petit" doux>📅 {plageDeDates(b.eventDate, b.eventDate)}</Texte> : null}
        {nomsCourses(b) ? <Texte v="petit" doux>🏁 {nomsCourses(b)}</Texte> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Ionicons name={etat === 'complet' ? 'checkmark-circle' : etat === 'absent' ? 'cloud-outline' : 'cloud-download-outline'} size={14} color={couleur} />
          <Text style={{ color: couleur, fontSize: 12, fontWeight: '600' }}>{libelle}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={enCours} onRefresh={() => void synchroniserMaintenant()} />}
      keyboardShouldPersistTaps="handled"
    >
      <Texte v="titre">Briefs</Texte>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={p.texteDoux} />
        <TextInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Rechercher un brief"
          placeholderTextColor={p.texteDoux}
          style={{ flex: 1, height: 44, color: p.texte, fontSize: 16 }}
          clearButtonMode="while-editing"
        />
      </View>
      {aVenir.length === 0 && passes.length === 0 ? (
        <Vide
          icone="document-text-outline"
          titre={recherche ? 'Aucun brief trouvé' : 'Aucun brief pour l’instant'}
          texte={
            admin
              ? 'Les briefs des courses du planning apparaissent ici.'
              : 'Le brief d’une course apparaît ici quand tu es retenu dessus et que la course est finalisée.'
          }
        />
      ) : null}
      {aVenir.length > 0 && (
        <Texte v="petit" doux style={{ fontWeight: '700', marginTop: 4 }}>
          À VENIR
        </Texte>
      )}
      {aVenir.map((b) => (
        <Ligne key={b.id} b={b} />
      ))}
      {passes.length > 0 && (
        <Texte v="petit" doux style={{ fontWeight: '700', marginTop: 8 }}>
          PASSÉS
        </Texte>
      )}
      {passes.map((b) => (
        <Ligne key={b.id} b={b} />
      ))}
    </ScrollView>
  );
}
