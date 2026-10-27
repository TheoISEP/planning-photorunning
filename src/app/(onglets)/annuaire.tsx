import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { connecterAnnuaire, deverrouillerAnnuaire, synchroniserAnnuaire } from '@/lib/annuaire';
import { ilYA, normaliser } from '@/lib/format';
import { useEtat } from '@/lib/store';
import { rayon, usePalette } from '@/lib/theme';
import { Bandeau, Bouton, Texte, Vide } from '@/components/ui';
import { LigneContact } from '@/components/contacts/LigneContact';

/**
 * L'annuaire PhotoRunning (admins). Compte de l'annuaire, distinct du
 * planning ; s'ouvre par Face ID ; consultable sans réseau.
 */
export default function OngletAnnuaire() {
  const connecte = useEtat((e) => e.annuaire.connecte);
  const deverrouille = useEtat((e) => e.annuaire.deverrouille);
  if (!connecte) return <ConnexionAnnuaire />;
  if (!deverrouille) return <Verrou />;
  return <ListeAnnuaire />;
}

function ConnexionAnnuaire({ titre = 'Annuaire', explication }: { titre?: string; explication?: string }) {
  const p = usePalette();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const champ = { backgroundColor: p.carte, borderColor: p.bordFort, borderWidth: 1, borderRadius: rayon.moyen, paddingHorizontal: 14, height: 50, fontSize: 16, color: p.texte } as const;
  const valider = async () => {
    setErreur(null);
    setEnCours(true);
    try {
      await connecterAnnuaire(email, motDePasse);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setEnCours(false);
    }
  };
  return (
    <View style={{ flex: 1, padding: 16, gap: 14 }}>
      <Texte v="titre">{titre}</Texte>
      <Texte doux>
        {explication ??
          'Connecte-toi avec ton compte de l’annuaire (pas celui du planning). L’annuaire sera ensuite gardé sur ce téléphone, chiffré, et s’ouvrira avec Face ID.'}
      </Texte>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email de l’annuaire" placeholderTextColor={p.texteDoux} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={champ} />
      <TextInput value={motDePasse} onChangeText={setMotDePasse} placeholder="Mot de passe" placeholderTextColor={p.texteDoux} secureTextEntry style={champ} onSubmitEditing={() => void valider()} />
      {erreur ? <Bandeau ton="danger" icone="alert-circle" texte={erreur} /> : null}
      <Bouton titre="Ouvrir l’annuaire" icone="lock-open-outline" onPress={() => void valider()} chargement={enCours} desactive={!email || !motDePasse} />
    </View>
  );
}

function Verrou() {
  const p = usePalette();
  const [sansBiometrie, setSansBiometrie] = useState(false);
  const ouvrir = () =>
    deverrouillerAnnuaire().then((r) => {
      if (r === 'indisponible') setSansBiometrie(true);
    });
  useEffect(() => {
    // Face ID proposé d'office à l'ouverture de l'onglet.
    void deverrouillerAnnuaire().then((r) => {
      if (r === 'indisponible') setSansBiometrie(true);
    });
  }, []);
  if (sansBiometrie) {
    return (
      <ConnexionAnnuaire
        titre="Annuaire verrouillé"
        explication="Ce téléphone n’a ni Face ID, ni empreinte, ni code : redonne le mot de passe de l’annuaire pour l’ouvrir. Active un code sur ton téléphone pour aller plus vite la prochaine fois."
      />
    );
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
      <View style={{ backgroundColor: p.carte2, borderRadius: 999, padding: 20 }}>
        <Ionicons name="lock-closed" size={36} color={p.texte} />
      </View>
      <Texte v="sousTitre">Annuaire verrouillé</Texte>
      <Texte doux style={{ textAlign: 'center' }}>
        Il se reverrouille quand tu quittes l’app quelques minutes.
      </Texte>
      <Bouton titre="Ouvrir avec Face ID" icone="scan-outline" onPress={() => void ouvrir()} />
    </View>
  );
}

function ListeAnnuaire() {
  const p = usePalette();
  const donnees = useEtat((e) => e.annuaire.donnees);
  const derniere = useEtat((e) => e.annuaire.derniere);
  const enCours = useEtat((e) => e.annuaire.enCours);
  const erreur = useEtat((e) => e.annuaire.erreur);
  const [recherche, setRecherche] = useState('');
  const [thematique, setThematique] = useState<string | null>(null);
  const [vue, setVue] = useState<'personnes' | 'organisations'>('personnes');

  const orgs = useMemo(() => new Map((donnees?.organisations ?? []).map((o) => [o.id, o])), [donnees]);
  const themes = useMemo(() => new Map((donnees?.thematiques ?? []).map((t) => [t.id, t])), [donnees]);
  const racines = useMemo(() => (donnees?.thematiques ?? []).filter((t) => !t.parentId), [donnees]);

  const dansTheme = (ids: string[]) => {
    if (!thematique) return true;
    return ids.some((id) => id === thematique || themes.get(id)?.parentId === thematique);
  };

  const contacts = useMemo(() => {
    if (!donnees) return [];
    const q = normaliser(recherche.trim()).split(/\s+/).filter(Boolean);
    const favoris = new Set(donnees.favoris);
    return donnees.contacts
      .filter((c) => {
        const org = c.organisationId ? orgs.get(c.organisationId) : undefined;
        const ids = c.thematiqueIds.length ? c.thematiqueIds : org?.thematiqueId ? [org.thematiqueId] : [];
        if (!dansTheme(ids)) return false;
        if (!q.length) return true;
        const texte = normaliser(
          `${c.prenom} ${c.nom} ${c.poste ?? ''} ${c.secteur ?? ''} ${org?.nom ?? ''} ${c.ville ?? ''} ${c.tags.join(' ')} ${c.canaux.map((x) => x.valeur).join(' ')}`,
        );
        return q.every((m) => texte.includes(m));
      })
      .sort((a, b) => Number(favoris.has(b.id)) - Number(favoris.has(a.id)) || a.importance - b.importance || a.prenom.localeCompare(b.prenom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, recherche, thematique, orgs]);

  const organisations = useMemo(() => {
    if (!donnees) return [];
    const q = normaliser(recherche.trim());
    return donnees.organisations.filter((o) => (!thematique || dansTheme(o.thematiqueId ? [o.thematiqueId] : [])) && (!q || normaliser(`${o.nom} ${o.ville ?? ''} ${o.tags.join(' ')}`).includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, recherche, thematique]);

  if (!donnees) {
    return <Vide icone="cloud-download-outline" titre={enCours ? 'Chargement de l’annuaire…' : 'Annuaire pas encore sur ce téléphone'} texte={erreur ?? 'Il faut du réseau une première fois.'} action={enCours ? null : <Bouton titre="Réessayer" onPress={() => void synchroniserAnnuaire()} />} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Texte v="titre">Annuaire</Texte>
          <Pressable onPress={() => void synchroniserAnnuaire()} hitSlop={8}>
            <Text style={{ color: p.texteDoux, fontSize: 12 }}>{enCours ? 'Synchro…' : `À jour ${ilYA(derniere)}`}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={p.texteDoux} />
          <TextInput value={recherche} onChangeText={setRecherche} placeholder="Nom, organisation, ville, numéro…" placeholderTextColor={p.texteDoux} style={{ flex: 1, height: 44, color: p.texte, fontSize: 16 }} autoCorrect={false} />
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '', nom: 'Tout', couleur: p.texteDoux }, ...racines]}
          keyExtractor={(t) => t.id || 'tout'}
          contentContainerStyle={{ gap: 6 }}
          renderItem={({ item }) => {
            const actif = (item.id || null) === thematique;
            return (
              <Pressable
                onPress={() => setThematique(item.id || null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: actif ? item.couleur : p.bord, backgroundColor: actif ? p.carte2 : p.carte }}
              >
                {item.id ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.couleur }} /> : null}
                <Text style={{ color: p.texte, fontSize: 13, fontWeight: actif ? '700' : '500' }}>{item.nom}</Text>
              </Pressable>
            );
          }}
        />
        <View style={{ flexDirection: 'row', backgroundColor: p.carte2, borderRadius: 10, padding: 3 }}>
          {(['personnes', 'organisations'] as const).map((v) => (
            <Pressable key={v} onPress={() => setVue(v)} style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', backgroundColor: vue === v ? p.carte : 'transparent' }}>
              <Text style={{ color: vue === v ? p.texte : p.texteDoux, fontWeight: vue === v ? '700' : '500', fontSize: 13 }}>
                {v === 'personnes' ? `Personnes (${contacts.length})` : `Organisations (${organisations.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {vue === 'personnes' ? (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          renderItem={({ item }) => <LigneContact c={item} donnees={donnees} />}
          ListEmptyComponent={<Vide icone="search" titre="Personne ne correspond" />}
        />
      ) : (
        <FlatList
          data={organisations}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const t = item.thematiqueId ? themes.get(item.thematiqueId) : undefined;
            const n = donnees.contacts.filter((c) => c.organisationId === item.id).length;
            return (
              <Pressable onPress={() => router.push(`/annuaire/organisation/${item.id}`)} style={({ pressed }) => ({ backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: p.carte2, borderWidth: 2, borderColor: t?.couleur ?? p.bord, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business" size={18} color={t?.couleur ?? p.texteDoux} />
                </View>
                <View style={{ flex: 1 }}>
                  <Texte v="fort">{item.nom}</Texte>
                  <Texte v="petit" doux>
                    {[t?.nom, item.ville, `${n} personne${n > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                  </Texte>
                </View>
                <Ionicons name="chevron-forward" size={18} color={p.texteDoux} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
