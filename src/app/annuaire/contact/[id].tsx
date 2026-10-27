import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ScrollView, Text, View } from 'react-native';
import { dateHeureCourte, initiales } from '@/lib/format';
import { useEtat } from '@/lib/store';
import { rayon, usePalette } from '@/lib/theme';
import { LigneCanal } from '@/components/contacts/Actions';
import { FicheVerrouillee } from '@/components/contacts/FicheVerrouillee';
import { Carte, Ligne, Pastille, Section, Texte, Vide } from '@/components/ui';

const IMPORTANCE = { 1: 'Contact clé', 2: 'Important', 3: 'Occasionnel' } as Record<number, string>;
const TYPE_NOTE = { NOTE: 'Note', APPEL: 'Appel', EMAIL: 'Email', SMS: 'SMS', RDV: 'Rendez-vous' } as Record<string, string>;

/** Fiche d'une personne de l'annuaire, lisible hors ligne. Les modifications se font sur le web. */
export default function FicheContact() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const donnees = useEtat((e) => e.annuaire.donnees);
  const deverrouille = useEtat((e) => e.annuaire.deverrouille);
  if (!deverrouille) return <FicheVerrouillee />;
  const c = donnees?.contacts.find((x) => x.id === id);
  if (!donnees || !c) return <Vide icone="person-outline" titre="Fiche introuvable" />;
  const org = c.organisationId ? donnees.organisations.find((o) => o.id === c.organisationId) : undefined;
  const themes = c.thematiqueIds.map((t) => donnees.thematiques.find((x) => x.id === t)).filter(Boolean);
  const tel = c.canaux.filter((x) => x.type === 'TELEPHONE' || x.type === 'WHATSAPP');
  const mails = c.canaux.filter((x) => x.type === 'EMAIL');
  const autres = c.canaux.filter((x) => !['TELEPHONE', 'WHATSAPP', 'EMAIL'].includes(x.type));
  const nom = `${c.prenom} ${c.nom}`.trim();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.fond }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: nom }} />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: p.carte, borderWidth: 3, borderColor: themes[0]?.couleur ?? p.bord, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: p.texte, fontWeight: '800', fontSize: 24 }}>{initiales(c.prenom, c.nom)}</Text>
        </View>
        <Texte v="titre" style={{ textAlign: 'center' }}>
          {nom}
        </Texte>
        {c.poste || org ? (
          <Texte doux style={{ textAlign: 'center' }}>
            {[c.poste, org?.nom, c.secteur].filter(Boolean).join(' · ')}
          </Texte>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          <Pastille texte={IMPORTANCE[c.importance] ?? 'Important'} fond={p.carte2} couleur={p.texte} icone={c.importance === 1 ? 'star' : undefined} />
          {themes.map((t) => (
            <Pastille key={t!.id} texte={t!.nom} fond={p.carte} couleur={p.texte} bord={t!.couleur} />
          ))}
          {c.visiblePhotographes ? <Pastille texte="Visible des photographes" fond={p.primaireDoux} couleur={p.primaire} icone="eye" /> : null}
        </View>
      </View>

      {tel.length + mails.length > 0 && (
        <Section titre="Joindre">
          <Carte style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
            {tel.map((x, i) => (
              <LigneCanal key={`t${i}`} type="telephone" valeur={x.valeur} libelle={x.libelle} nom={nom} whatsapp={x.type === 'WHATSAPP'} />
            ))}
            {mails.map((x, i) => (
              <LigneCanal key={`m${i}`} type="email" valeur={x.valeur} libelle={x.libelle} nom={nom} />
            ))}
          </Carte>
        </Section>
      )}

      {autres.length > 0 && (
        <Section titre="En ligne">
          <Carte style={{ paddingVertical: 2 }}>
            {autres.map((x, i) => (
              <Ligne key={i} icone="link-outline" titre={x.libelle || x.type.toLowerCase()} detail={x.valeur} onPress={() => void Linking.openURL(x.valeur)} />
            ))}
          </Carte>
        </Section>
      )}

      {org ? (
        <Section titre="Organisation">
          <Carte onPress={() => router.push(`/annuaire/organisation/${org.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="business-outline" size={20} color={p.texte} />
            <View style={{ flex: 1 }}>
              <Texte v="fort">{org.nom}</Texte>
              {org.ville ? <Texte v="petit" doux>{org.ville}</Texte> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.texteDoux} />
          </Carte>
        </Section>
      ) : null}

      {c.aSavoir ? (
        <Section titre="À savoir">
          <Carte>
            <Texte>{c.aSavoir}</Texte>
          </Carte>
        </Section>
      ) : null}

      {(c.ville || c.langue || c.tags.length > 0) && (
        <Section titre="Contexte">
          <Carte style={{ gap: 6 }}>
            {c.ville ? <Texte>📍 {[c.ville, c.pays].filter(Boolean).join(', ')}</Texte> : null}
            {c.langue ? <Texte>🗣 {c.langue}</Texte> : null}
            {c.tags.length ? <Texte doux>#{c.tags.join('  #')}</Texte> : null}
          </Carte>
        </Section>
      )}

      {c.notes.length > 0 && (
        <Section titre="Dernières notes">
          <View style={{ gap: 8 }}>
            {c.notes.map((n, i) => (
              <View key={i} style={{ backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, padding: 12, gap: 4 }}>
                <Text style={{ color: p.texteDoux, fontSize: 12 }}>
                  {TYPE_NOTE[n.type] ?? 'Note'} · {dateHeureCourte(n.date)}
                  {n.auteurNom ? ` · ${n.auteurNom}` : ''}
                </Text>
                <Texte>{n.contenu}</Texte>
              </View>
            ))}
          </View>
        </Section>
      )}
      <Texte v="petit" doux style={{ textAlign: 'center' }}>
        Les modifications se font dans l’annuaire sur le web.
      </Texte>
    </ScrollView>
  );
}
