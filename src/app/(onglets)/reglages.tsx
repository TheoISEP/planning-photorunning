import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { deconnecterAnnuaire, verrouillerAnnuaire } from '@/lib/annuaire';
import { versionInstallee } from '@/lib/appareil';
import { PLANNING_URL } from '@/lib/config';
import { ilYA } from '@/lib/format';
import { tailleStockage } from '@/lib/stockage';
import { useEtat } from '@/lib/store';
import { deconnecter, synchroniserMaintenant } from '@/lib/synchro';
import { rayon, usePalette } from '@/lib/theme';
import { toast } from '@/components/Toast';
import { Bouton, Dialogue, Ligne, Section, Separateur, Texte } from '@/components/ui';

const mo = (o: number) => (o > 1e9 ? `${(o / 1e9).toFixed(1)} Go` : `${Math.max(0.1, o / 1e6).toFixed(1)} Mo`);

export default function OngletReglages() {
  const p = usePalette();
  const u = useEtat((e) => e.utilisateur);
  const synchro = useEtat((e) => e.synchro);
  const nbBriefs = useEtat((e) => Object.keys(e.briefsLocaux).length);
  const nbComplets = useEtat((e) => Object.values(e.briefsLocaux).filter((b) => b.fichiers === 'complets').length);
  const annuaire = useEtat((e) => e.annuaire);
  const [confirmer, setConfirmer] = useState<'deconnexion' | 'annuaire' | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [verif, setVerif] = useState(false);

  const carte = { backgroundColor: p.carte, borderRadius: rayon.moyen, borderWidth: 1, borderColor: p.bord, paddingHorizontal: 14 } as const;

  const verifierMaj = async () => {
    if (!Updates.isEnabled) return toast('Mises à jour à chaud indisponibles ici');
    setVerif(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
        await Updates.fetchUpdateAsync();
        toast('Amélioration téléchargée : redémarrage…');
        await Updates.reloadAsync();
      } else toast('L’app est à jour');
    } catch {
      toast('Vérification impossible (réseau ?)');
    } finally {
      setVerif(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 20, paddingBottom: 48 }}>
      <Texte v="titre">Réglages</Texte>

      <Section titre="Compte">
        <View style={carte}>
          <Ligne icone="person-circle-outline" titre={`${u?.prenom ?? ''} ${u?.nom ?? ''}`.trim() || 'Compte'} detail={`${u?.email ?? ''} · ${u?.role === 'admin' ? 'Admin' : 'Photographe'}`} />
          <Separateur />
          <Ligne icone="globe-outline" titre="Ouvrir le planning sur le web" onPress={() => void Linking.openURL(PLANNING_URL)} />
        </View>
      </Section>

      <Section titre="Hors ligne">
        <View style={carte}>
          <Ligne
            icone="sync-outline"
            titre="Dernière synchro"
            detail={synchro.enCours ? 'En cours…' : ilYA(synchro.derniere)}
            droite={<Bouton titre="Synchroniser" petit variante="secondaire" onPress={() => void synchroniserMaintenant()} chargement={synchro.enCours} />}
          />
          <Separateur />
          <Ligne icone="document-text-outline" titre="Briefs sur le téléphone" detail={`${nbBriefs} brief${nbBriefs > 1 ? 's' : ''}, dont ${nbComplets} avec tous leurs fichiers`} />
          <Separateur />
          <Ligne icone="phone-portrait-outline" titre="Place utilisée" detail={mo(tailleStockage())} />
        </View>
      </Section>

      {u?.role === 'admin' && (
        <Section titre="Annuaire">
          <View style={carte}>
            <Ligne
              icone="book-outline"
              titre={annuaire.connecte ? 'Connecté à l’annuaire' : 'Annuaire non connecté'}
              detail={annuaire.connecte ? `Synchro ${ilYA(annuaire.derniere)} · copie chiffrée, Face ID` : 'Ouvre l’onglet Annuaire pour te connecter.'}
            />
            {annuaire.connecte && (
              <>
                <Separateur />
                <Ligne icone="lock-closed-outline" titre="Verrouiller maintenant" onPress={() => {
                  verrouillerAnnuaire();
                  toast('Annuaire verrouillé');
                }} />
                <Separateur />
                <Ligne icone="log-out-outline" titre="Retirer l’annuaire de ce téléphone" couleurIcone={p.danger} onPress={() => setConfirmer('annuaire')} />
              </>
            )}
          </View>
        </Section>
      )}

      <Section titre="Application">
        <View style={carte}>
          <Ligne
            icone="information-circle-outline"
            titre={`PhotoRunning Équipe ${versionInstallee()}`}
            detail={Updates.isEnabled && Updates.updateId ? `Correctif ${Updates.updateId.slice(0, 8)}` : 'Version d’origine'}
            droite={<Bouton titre="Vérifier" petit variante="secondaire" onPress={() => void verifierMaj()} chargement={verif} />}
          />
        </View>
      </Section>

      <Bouton titre="Se déconnecter" icone="log-out-outline" variante="danger" onPress={() => setConfirmer('deconnexion')} />
      <Texte v="petit" doux style={{ textAlign: 'center' }}>
        Se déconnecter efface du téléphone le planning, les briefs, les contacts et l’annuaire.
      </Texte>

      <Dialogue
        visible={confirmer === 'deconnexion'}
        titre="Se déconnecter ?"
        texte="Tout ce que l’app garde sur ce téléphone sera effacé. Il faudra du réseau pour te reconnecter."
        confirmer="Se déconnecter"
        danger
        chargement={enCours}
        onFermer={() => setConfirmer(null)}
        onConfirmer={async () => {
          setEnCours(true);
          await deconnecter();
          setEnCours(false);
          setConfirmer(null);
        }}
      />
      <Dialogue
        visible={confirmer === 'annuaire'}
        titre="Retirer l’annuaire ?"
        texte="La copie de l’annuaire est effacée de ce téléphone. Tu pourras te reconnecter avec ton compte de l’annuaire."
        confirmer="Retirer"
        danger
        chargement={enCours}
        onFermer={() => setConfirmer(null)}
        onConfirmer={async () => {
          setEnCours(true);
          await deconnecterAnnuaire();
          setEnCours(false);
          setConfirmer(null);
        }}
      />
    </ScrollView>
  );
}
