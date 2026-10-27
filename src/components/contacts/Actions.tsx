import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { telephoneBrut, telephoneLisible } from '@/lib/format';
import { rayon, usePalette } from '@/lib/theme';
import { ActionFeuille, Feuille, Icone } from '@/components/ui';
import { toast } from '@/components/Toast';

/**
 * Toucher un numéro → appeler, SMS (numéro prérempli), WhatsApp ou copier.
 * Toucher un email → écrire ou copier. Une seule feuille pour toute l'app.
 */

type Cible =
  | { type: 'telephone'; valeur: string; nom?: string; whatsapp?: boolean }
  | { type: 'email'; valeur: string; nom?: string };

const Contexte = createContext<(c: Cible) => void>(() => undefined);

export const useActionsContact = () => useContext(Contexte);

export function FournisseurActionsContact({ children }: { children: ReactNode }) {
  const [cible, setCible] = useState<Cible | null>(null);
  const fermer = () => setCible(null);
  const ouvrir = useCallback((c: Cible) => setCible(c), []);

  const copier = async (texte: string, message: string) => {
    await Clipboard.setStringAsync(texte);
    fermer();
    toast(message);
  };

  return (
    <Contexte.Provider value={ouvrir}>
      {children}
      <Feuille
        visible={!!cible}
        onFermer={fermer}
        titre={cible?.type === 'telephone' ? telephoneLisible(cible.valeur) : cible?.valeur}
        sousTitre={cible?.nom}
      >
        {cible?.type === 'telephone' && (
          <>
            <ActionFeuille
              icone="call"
              titre="Appeler"
              onPress={() => {
                fermer();
                void Linking.openURL(`tel:${telephoneBrut(cible.valeur)}`);
              }}
            />
            <ActionFeuille
              icone="chatbubble"
              titre="Envoyer un SMS"
              onPress={() => {
                fermer();
                void Linking.openURL(`sms:${telephoneBrut(cible.valeur)}`);
              }}
            />
            <ActionFeuille
              icone="logo-whatsapp"
              titre="WhatsApp"
              onPress={() => {
                fermer();
                void Linking.openURL(`https://wa.me/${telephoneBrut(cible.valeur).replace(/^\+/, '')}`);
              }}
            />
            <ActionFeuille icone="copy" titre="Copier le numéro" onPress={() => void copier(telephoneLisible(cible.valeur), 'Numéro copié')} />
          </>
        )}
        {cible?.type === 'email' && (
          <>
            <ActionFeuille
              icone="mail"
              titre="Écrire un email"
              onPress={() => {
                fermer();
                void Linking.openURL(`mailto:${cible.valeur}`);
              }}
            />
            <ActionFeuille icone="copy" titre="Copier l’adresse" onPress={() => void copier(cible.valeur, 'Adresse copiée')} />
          </>
        )}
      </Feuille>
    </Contexte.Provider>
  );
}

/** Une ligne cliquable « numéro » ou « email ». */
export function LigneCanal({
  type,
  valeur,
  libelle,
  nom,
  whatsapp,
}: {
  type: 'telephone' | 'email';
  valeur: string;
  libelle?: string | null;
  nom?: string;
  whatsapp?: boolean;
}) {
  const p = usePalette();
  const ouvrir = useActionsContact();
  return (
    <Pressable
      onPress={() => ouvrir(type === 'telephone' ? { type, valeur, nom, whatsapp } : { type, valeur, nom })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: rayon.moyen,
        backgroundColor: pressed ? p.carte2 : 'transparent',
      })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.primaireDoux, alignItems: 'center', justifyContent: 'center' }}>
        <Icone nom={type === 'telephone' ? (whatsapp ? 'logo-whatsapp' : 'call') : 'mail'} taille={17} couleur={p.primaire} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.texte, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
          {type === 'telephone' ? telephoneLisible(valeur) : valeur}
        </Text>
        {libelle ? <Text style={{ color: p.texteDoux, fontSize: 12 }}>{libelle}</Text> : null}
      </View>
    </Pressable>
  );
}
