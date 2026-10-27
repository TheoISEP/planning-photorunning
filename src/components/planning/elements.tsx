import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { euros } from '@/lib/format';
import { estTravail } from '@/lib/planning';
import { rayon, usePalette, useStatuts } from '@/lib/theme';
import type { Course, Statut, WeekendResume } from '@/lib/types';
import { ActionFeuille, Feuille, Texte } from '@/components/ui';

/** Briques du planning, calquées sur celles du site (statuts.ts, PhotographerBoard.tsx). */

/** Pastille 🟢 / 🟠 : course finalisée ou en cours de constitution. */
export function PointEtatCourse({ course }: { course: Course }) {
  return <Text style={{ fontSize: 11 }}>{course.statutTraitement === 'done' ? '🟢' : '🟠'}</Text>;
}

export function BadgeAnnulee() {
  const p = usePalette();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: p.annuleeBadge,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginBottom: 4,
      }}
    >
      <Ionicons name="ban" size={11} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>COURSE ANNULÉE</Text>
    </View>
  );
}

export function BandeauWeekend({ w }: { w: WeekendResume }) {
  const p = usePalette();
  const pluriel = w.photographers > 1;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: p.weekendFond,
        borderColor: p.weekendBord,
        borderWidth: 1,
        borderRadius: rayon.petit,
        padding: 8,
      }}
    >
      <Ionicons name="people" size={16} color={p.weekendIcone} />
      <Text style={{ flex: 1, color: p.weekendTexte, fontSize: 12, fontWeight: '500' }}>
        Week-end du {w.label} : <Text style={{ fontWeight: '800' }}>{w.photographers}</Text> photographe{pluriel ? 's' : ''} travaill
        {pluriel ? 'ent' : 'e'} sur <Text style={{ fontWeight: '800' }}>{w.events}</Text> événement{w.events > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

/** En-tête de mois orange, comme sur le site. */
export function EnteteMois({ titre, droite }: { titre: string; droite?: string }) {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: p.moisFond,
        borderColor: p.moisBord,
        borderWidth: 1,
        borderRadius: rayon.petit,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Texte v="fort" style={{ fontSize: 16, fontWeight: '800', textTransform: 'capitalize' }}>
        {titre}
      </Texte>
      {droite ? <Text style={{ color: p.moisMontant, fontSize: 13, fontWeight: '800' }}>{droite}</Text> : null}
    </View>
  );
}

/** Une case de statut : modifiable (ouvre le choix) ou figée (tranchée par l'admin). */
export function CaseStatut({
  statut,
  libelleCreneau,
  montant,
  modifiable,
  enAttente,
  onPress,
  compacte,
}: {
  statut: Statut;
  libelleCreneau?: string;
  montant?: number;
  modifiable: boolean;
  enAttente?: boolean;
  onPress?: () => void;
  compacte?: boolean;
}) {
  const s = useStatuts()[statut];
  const p = usePalette();
  const contenu = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: s.fond,
        borderColor: s.bord,
        borderWidth: 1,
        borderRadius: rayon.petit,
        paddingHorizontal: compacte ? 8 : 12,
        height: compacte ? 32 : 42,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.point }} />
        <Text numberOfLines={1} style={{ color: s.texte, fontSize: compacte ? 13 : 15, fontWeight: '600' }}>
          {s.libelle}
        </Text>
        {enAttente ? <Ionicons name="cloud-upload-outline" size={13} color={s.texte} /> : null}
      </View>
      {modifiable ? (
        <Ionicons name="chevron-down" size={16} color={s.texte} />
      ) : estTravail(statut) && montant ? (
        <Text style={{ color: s.texte, fontSize: 12, fontWeight: '700' }}>{euros(montant)}</Text>
      ) : (
        <Ionicons name="lock-closed" size={12} color={p.texteDoux} />
      )}
    </View>
  );
  return (
    <View style={{ gap: 3 }}>
      {libelleCreneau ? <Text style={{ fontSize: 11, fontWeight: '600', color: p.texteDoux }}>{libelleCreneau}</Text> : null}
      {modifiable && onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }} accessibilityRole="button">
          {contenu}
        </Pressable>
      ) : (
        contenu
      )}
    </View>
  );
}

/** Feuille de choix d'un statut (déclarations pour un photographe, tout pour un admin). */
export function ChoixStatut({
  visible,
  titre,
  sousTitre,
  options,
  actuel,
  onChoisir,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  sousTitre?: string;
  options: Statut[];
  actuel: Statut | null;
  onChoisir: (s: Statut) => void;
  onFermer: () => void;
}) {
  const styles = useStatuts();
  const p = usePalette();
  return (
    <Feuille visible={visible} onFermer={onFermer} titre={titre} sousTitre={sousTitre}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChoisir(o)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: rayon.moyen,
            backgroundColor: o === actuel ? styles[o].fond : pressed ? p.carte2 : 'transparent',
            borderWidth: 1,
            borderColor: o === actuel ? styles[o].bord : 'transparent',
          })}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: styles[o].point }} />
          <Text style={{ flex: 1, color: p.texte, fontSize: 16, fontWeight: o === actuel ? '700' : '500' }}>{styles[o].libelle}</Text>
          {o === actuel ? <Ionicons name="checkmark" size={20} color={styles[o].texte} /> : null}
        </Pressable>
      ))}
      <ActionFeuille icone="close" titre="Annuler" onPress={onFermer} />
    </Feuille>
  );
}
