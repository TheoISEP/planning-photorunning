import { Stack, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ScrollView, View } from 'react-native';
import { useEtat } from '@/lib/store';
import { usePalette } from '@/lib/theme';
import { LigneCanal } from '@/components/contacts/Actions';
import { FicheVerrouillee } from '@/components/contacts/FicheVerrouillee';
import { LigneContact } from '@/components/contacts/LigneContact';
import { Carte, Ligne, Pastille, Section, Texte, Vide } from '@/components/ui';

/** Une organisation (OC Sport, une mairie…) et les personnes qu'on y connaît. */
export default function FicheOrganisation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const donnees = useEtat((e) => e.annuaire.donnees);
  const deverrouille = useEtat((e) => e.annuaire.deverrouille);
  if (!deverrouille) return <FicheVerrouillee />;
  const o = donnees?.organisations.find((x) => x.id === id);
  if (!donnees || !o) return <Vide icone="business-outline" titre="Organisation introuvable" />;
  const t = o.thematiqueId ? donnees.thematiques.find((x) => x.id === o.thematiqueId) : undefined;
  const personnes = donnees.contacts.filter((c) => c.organisationId === o.id).sort((a, b) => a.importance - b.importance || a.prenom.localeCompare(b.prenom));
  const tel = o.canaux.filter((x) => x.type === 'TELEPHONE' || x.type === 'WHATSAPP');
  const mails = o.canaux.filter((x) => x.type === 'EMAIL');
  const autres = o.canaux.filter((x) => !['TELEPHONE', 'WHATSAPP', 'EMAIL'].includes(x.type));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.fond }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: o.nom }} />
      <View style={{ gap: 6 }}>
        <Texte v="titre">{o.nom}</Texte>
        {t ? <Pastille texte={t.nom} fond={p.carte} couleur={p.texte} bord={t.couleur} /> : null}
        {o.description ? <Texte doux>{o.description}</Texte> : null}
        {o.adresse || o.ville ? <Texte doux>📍 {[o.adresse, o.ville, o.pays].filter(Boolean).join(', ')}</Texte> : null}
      </View>
      {o.canaux.length > 0 && (
        <Section titre="Joindre">
          <Carte style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
            {tel.map((x, i) => (
              <LigneCanal key={`t${i}`} type="telephone" valeur={x.valeur} libelle={x.libelle} nom={o.nom} whatsapp={x.type === 'WHATSAPP'} />
            ))}
            {mails.map((x, i) => (
              <LigneCanal key={`m${i}`} type="email" valeur={x.valeur} libelle={x.libelle} nom={o.nom} />
            ))}
            {autres.map((x, i) => (
              <Ligne key={`a${i}`} icone="link-outline" titre={x.libelle || x.type.toLowerCase()} detail={x.valeur} onPress={() => void Linking.openURL(x.valeur)} />
            ))}
          </Carte>
        </Section>
      )}
      <Section titre={`Personnes (${personnes.length})`}>
        <View style={{ gap: 8 }}>
          {personnes.map((c) => (
            <LigneContact key={c.id} c={c} donnees={donnees} />
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}
