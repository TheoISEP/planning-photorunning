import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { initiales, normaliser } from '@/lib/format';
import { useEtat } from '@/lib/store';
import { synchroniserMaintenant } from '@/lib/synchro';
import { rayon, usePalette } from '@/lib/theme';
import { LigneCanal } from '@/components/contacts/Actions';
import { Bandeau, Texte, Vide } from '@/components/ui';

/**
 * Contacts PhotoRunning : les fiches de l'annuaire que les admins ont
 * cochées « visibles des photographes », avec leurs numéros et emails
 * (sauf ceux masqués). Disponibles hors ligne.
 */
export default function OngletContacts() {
  const p = usePalette();
  const contacts = useEtat((e) => e.planning?.contacts);
  const admin = useEtat((e) => e.utilisateur?.role === 'admin');
  const enCours = useEtat((e) => e.synchro.enCours);
  const [recherche, setRecherche] = useState('');

  const liste = useMemo(() => {
    const q = normaliser(recherche.trim());
    return (contacts ?? []).filter(
      (c) => !q || normaliser(`${c.prenom} ${c.nom} ${c.poste} ${c.organisation} ${c.telephones.map((t) => t.numero).join(' ')}`).includes(q),
    );
  }, [contacts, recherche]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={enCours} onRefresh={() => void synchroniserMaintenant()} />}
      keyboardShouldPersistTaps="handled"
    >
      <Texte v="titre">Contacts PhotoRunning</Texte>
      {admin ? (
        <Bandeau
          ton="info"
          icone="information-circle"
          texte="Ce que voient les photographes. Pour ajouter quelqu’un ici, coche « Visible des photographes » sur sa fiche dans l’annuaire."
        />
      ) : null}
      {(contacts ?? []).length > 5 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={p.texteDoux} />
          <TextInput
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Rechercher"
            placeholderTextColor={p.texteDoux}
            style={{ flex: 1, height: 44, color: p.texte, fontSize: 16 }}
          />
        </View>
      )}
      {liste.length === 0 ? (
        <Vide icone="call-outline" titre="Aucun contact partagé pour le moment" texte="PhotoRunning ajoute ici les numéros utiles pour les jours de course." />
      ) : null}
      {liste.map((c) => (
        <View key={c.id} style={{ backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, padding: 12, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, marginBottom: 2 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.primaireDoux, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: p.primaire, fontWeight: '800' }}>{initiales(c.prenom, c.nom)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Texte v="fort">
                {c.prenom} {c.nom}
              </Texte>
              {c.poste || c.organisation ? (
                <Texte v="petit" doux>
                  {[c.poste, c.organisation].filter(Boolean).join(' · ')}
                </Texte>
              ) : null}
            </View>
          </View>
          {c.telephones.map((t, i) => (
            <LigneCanal key={`t${i}`} type="telephone" valeur={t.numero} libelle={t.libelle} nom={`${c.prenom} ${c.nom}`} whatsapp={t.whatsapp} />
          ))}
          {c.emails.map((e, i) => (
            <LigneCanal key={`e${i}`} type="email" valeur={e.adresse} libelle={e.libelle} nom={`${c.prenom} ${c.nom}`} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
