import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rayon, usePalette } from '@/lib/theme';

/**
 * Briques d'interface partagées. Jamais de fenêtre native (Alert) : des
 * feuilles et des boîtes de dialogue maison, comme dans les outils web.
 */

export type NomIcone = ComponentProps<typeof Ionicons>['name'];

export function Icone({ nom, taille = 18, couleur }: { nom: NomIcone; taille?: number; couleur?: string }) {
  const p = usePalette();
  return <Ionicons name={nom} size={taille} color={couleur ?? p.texte} />;
}

type Variante = 'titre' | 'sousTitre' | 'corps' | 'petit' | 'legende' | 'fort';

const tailles: Record<Variante, TextStyle> = {
  titre: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  sousTitre: { fontSize: 17, fontWeight: '700' },
  corps: { fontSize: 15, lineHeight: 21 },
  fort: { fontSize: 15, fontWeight: '600' },
  petit: { fontSize: 13, lineHeight: 18 },
  legende: { fontSize: 12, lineHeight: 16 },
};

export function Texte({
  v = 'corps',
  doux,
  couleur,
  style,
  ...reste
}: TextProps & { v?: Variante; doux?: boolean; couleur?: string }) {
  const p = usePalette();
  return <Text {...reste} style={[tailles[v], { color: couleur ?? (doux ? p.texteDoux : p.texte) }, style]} />;
}

export function Carte({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const p = usePalette();
  const base: ViewStyle = {
    backgroundColor: p.carte,
    borderRadius: rayon.moyen,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: p.bord,
    padding: 14,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.75 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Bouton({
  titre,
  onPress,
  variante = 'primaire',
  icone,
  chargement,
  desactive,
  petit,
  style,
}: {
  titre: string;
  onPress: () => void;
  variante?: 'primaire' | 'secondaire' | 'danger' | 'fantome';
  icone?: NomIcone;
  chargement?: boolean;
  desactive?: boolean;
  petit?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const couleurs = {
    primaire: { fond: p.primaire, texte: p.primaireTexte, bord: p.primaire },
    secondaire: { fond: p.carte, texte: p.texte, bord: p.bordFort },
    danger: { fond: p.danger, texte: '#ffffff', bord: p.danger },
    fantome: { fond: 'transparent', texte: p.texte, bord: 'transparent' },
  }[variante];
  const inactif = desactive || chargement;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactif}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: petit ? 36 : 48,
          paddingHorizontal: petit ? 12 : 18,
          borderRadius: rayon.moyen,
          backgroundColor: couleurs.fond,
          borderWidth: 1,
          borderColor: couleurs.bord,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: inactif ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {chargement ? <ActivityIndicator color={couleurs.texte} /> : icone ? <Ionicons name={icone} size={petit ? 16 : 18} color={couleurs.texte} /> : null}
      <Text style={{ color: couleurs.texte, fontSize: petit ? 14 : 16, fontWeight: '600' }}>{titre}</Text>
    </Pressable>
  );
}

export function Pastille({ texte, fond, couleur, bord, icone }: { texte: string; fond: string; couleur: string; bord?: string; icone?: NomIcone }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: fond,
        borderColor: bord ?? fond,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      {icone && <Ionicons name={icone} size={12} color={couleur} />}
      <Text style={{ color: couleur, fontSize: 12, fontWeight: '700' }}>{texte}</Text>
    </View>
  );
}

export function Bandeau({ ton, texte, icone, action }: { ton: 'info' | 'alerte' | 'danger' | 'succes'; texte: string; icone?: NomIcone; action?: ReactNode }) {
  const p = usePalette();
  const c = {
    info: { fond: p.carte2, bord: p.bord, texte: p.texte, icone: p.info },
    alerte: { fond: p.avertissementDoux, bord: p.avertissement, texte: p.avertissementTexte, icone: p.avertissement },
    danger: { fond: p.dangerDoux, bord: p.danger, texte: p.sombre ? '#fecaca' : '#7f1d1d', icone: p.danger },
    succes: { fond: p.valideFond, bord: p.valideBord, texte: p.valideTexte, icone: p.valideFort },
  }[ton];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: c.fond,
        borderColor: c.bord,
        borderWidth: 1,
        borderRadius: rayon.moyen,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      {icone && <Ionicons name={icone} size={18} color={c.icone} />}
      <Text style={{ flex: 1, color: c.texte, fontSize: 13, lineHeight: 18 }}>{texte}</Text>
      {action}
    </View>
  );
}

export function Vide({ icone, titre, texte, action }: { icone: NomIcone; titre: string; texte?: string; action?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ backgroundColor: p.carte2, borderRadius: 999, padding: 16 }}>
        <Ionicons name={icone} size={28} color={p.texteDoux} />
      </View>
      <Texte v="sousTitre" style={{ textAlign: 'center' }}>
        {titre}
      </Texte>
      {texte ? (
        <Texte doux style={{ textAlign: 'center' }}>
          {texte}
        </Texte>
      ) : null}
      {action}
    </View>
  );
}

export function Section({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Texte v="petit" doux style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' }}>
          {titre}
        </Texte>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Ligne({
  icone,
  titre,
  detail,
  onPress,
  droite,
  couleurIcone,
}: {
  icone?: NomIcone;
  titre: string;
  detail?: string;
  onPress?: () => void;
  droite?: ReactNode;
  couleurIcone?: string;
}) {
  const p = usePalette();
  const contenu = (
    <>
      {icone && (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: p.carte2, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icone} size={18} color={couleurIcone ?? p.texte} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Texte v="fort">{titre}</Texte>
        {detail ? (
          <Texte v="petit" doux>
            {detail}
          </Texte>
        ) : null}
      </View>
      {droite ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={p.texteDoux} /> : null)}
    </>
  );
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 };
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}>
      {contenu}
    </Pressable>
  ) : (
    <View style={style}>{contenu}</View>
  );
}

export function Separateur() {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.bord }} />;
}

/** Feuille qui monte du bas de l'écran (choix d'un statut, actions d'un contact…). */
export function Feuille({
  visible,
  onFermer,
  titre,
  sousTitre,
  children,
}: {
  visible: boolean;
  onFermer: () => void;
  titre?: string;
  sousTitre?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onFermer} accessibilityLabel="Fermer" />
      <View
        style={{
          backgroundColor: p.carte,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 16),
          gap: 6,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: p.bordFort, marginBottom: 6 }} />
        {titre ? <Texte v="sousTitre">{titre}</Texte> : null}
        {sousTitre ? (
          <Texte v="petit" doux style={{ marginBottom: 4 }}>
            {sousTitre}
          </Texte>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

/** Une action dans une feuille. */
export function ActionFeuille({ icone, titre, detail, onPress, danger }: { icone: NomIcone; titre: string; detail?: string; onPress: () => void; danger?: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 13,
        paddingHorizontal: 6,
        borderRadius: rayon.moyen,
        backgroundColor: pressed ? p.carte2 : 'transparent',
      })}
    >
      <Ionicons name={icone} size={22} color={danger ? p.danger : p.primaire} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? p.danger : p.texte, fontSize: 16, fontWeight: '600' }}>{titre}</Text>
        {detail ? <Text style={{ color: p.texteDoux, fontSize: 13 }}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Boîte de confirmation maison. */
export function Dialogue({
  visible,
  titre,
  texte,
  confirmer,
  annuler = 'Annuler',
  danger,
  chargement,
  onConfirmer,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  texte: string;
  confirmer: string;
  annuler?: string | null;
  danger?: boolean;
  chargement?: boolean;
  onConfirmer: () => void;
  onFermer: () => void;
}) {
  const p = usePalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: p.carte, borderRadius: rayon.grand, padding: 20, gap: 12 }}>
          <Texte v="sousTitre">{titre}</Texte>
          <Texte doux>{texte}</Texte>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            {annuler ? <Bouton titre={annuler} variante="secondaire" onPress={onFermer} style={{ flex: 1 }} desactive={chargement} /> : null}
            <Bouton titre={confirmer} variante={danger ? 'danger' : 'primaire'} onPress={onConfirmer} style={{ flex: 1 }} chargement={chargement} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Petite notification passagère en bas de l'écran. */
export function useStyleEcran() {
  const p = usePalette();
  return { flex: 1, backgroundColor: p.fond } as const;
}
