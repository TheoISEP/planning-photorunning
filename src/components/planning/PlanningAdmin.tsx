import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { dateCourte, euros, moisAnnee } from '@/lib/format';
import { cleDispo, groupesParMois, resumeAdmin, statutAdmin } from '@/lib/planning';
import { useEtat } from '@/lib/store';
import { changerStatut, synchroniserMaintenant } from '@/lib/synchro';
import { rayon, usePalette, useStatuts } from '@/lib/theme';
import type { Course, Dispo, Personne, Statut, Tarif } from '@/lib/types';
import { Texte, Vide } from '@/components/ui';
import { BadgeAnnulee, ChoixStatut, EnteteMois, PointEtatCourse } from './elements';

const TOUS: Statut[] = ['pending', 'available', 'unavailable', 'validated', 'teamLeader', 'rejected', 'nonPris'];

type Filtre = 'all' | 'inProgress' | 'done';

/**
 * Le calendrier de l'admin, comme sur le site : vue liste (cartes par mois,
 * retenus, dispos, coût) ou grille (courses × photographes, groupés admins
 * puis par région). Une case de la grille se change d'un toucher.
 */
export function PlanningAdmin({ mode = 'actives' }: { mode?: 'actives' | 'archives' }) {
  const planning = useEtat((e) => e.planning);
  const enCours = useEtat((e) => e.synchro.enCours);
  const [vue, setVue] = useState<'liste' | 'grille'>('liste');
  const [filtre, setFiltre] = useState<Filtre>('all');
  const p = usePalette();

  const colonnes = useMemo(() => {
    const personnes = planning?.personnes ?? [];
    const admins = personnes.filter((x) => x.role === 'admin' && x.actif);
    const photographes = personnes
      .filter((x) => x.role === 'photographer' && x.actif)
      .sort((a, b) => (a.region || 'zzz').localeCompare(b.region || 'zzz') || a.prenom.localeCompare(b.prenom));
    return [...admins, ...photographes];
  }, [planning]);
  const dispos = useMemo(() => {
    const m = new Map<string, Dispo>();
    for (const d of planning?.dispos ?? []) m.set(cleDispo(d.courseId, d.photographeId, d.tarifId), d);
    return m;
  }, [planning]);
  const mois = useMemo(() => {
    const courses = (planning?.courses ?? []).filter((c) => filtre === 'all' || c.statutTraitement === filtre);
    return groupesParMois(courses, mode);
  }, [planning, filtre, mode]);

  if (!planning) return null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Puce p={p} actif={filtre === 'all'} titre="Toutes" onPress={() => setFiltre('all')} />
        <Puce p={p} actif={filtre === 'inProgress'} titre="🟠 En cours" onPress={() => setFiltre('inProgress')} />
        <Puce p={p} actif={filtre === 'done'} titre="🟢 Fait" onPress={() => setFiltre('done')} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setVue(vue === 'liste' ? 'grille' : 'liste')} hitSlop={8} accessibilityLabel="Changer de vue">
          <Ionicons name={vue === 'liste' ? 'grid-outline' : 'list-outline'} size={22} color={p.texte} />
        </Pressable>
      </View>
      {mois.length === 0 ? (
        <Vide icone="calendar-outline" titre={mode === 'archives' ? 'Aucune course archivée' : 'Aucune course pour ce filtre'} />
      ) : vue === 'liste' ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={enCours} onRefresh={() => void synchroniserMaintenant()} />}
        >
          {mois.map((g) => {
            const total = g.courses.reduce((s, c) => s + resumeAdmin(c, dispos, colonnes).cout, 0);
            return (
              <View key={g.cle} style={{ gap: 8 }}>
                <EnteteMois titre={moisAnnee(g.annee, g.mois)} droite={`${g.courses.length} course${g.courses.length > 1 ? 's' : ''} · ${euros(total)}`} />
                {g.courses.map((c) => (
                  <CarteCourseAdmin key={c.id} course={c} resume={resumeAdmin(c, dispos, colonnes)} estompee={mode !== 'archives'} />
                ))}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <Grille mois={mois} colonnes={colonnes} dispos={dispos} />
      )}
    </View>
  );
}

function Puce({ p, actif, titre, onPress }: { p: ReturnType<typeof usePalette>; actif: boolean; titre: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: actif ? p.primaire : p.bord,
        backgroundColor: actif ? p.primaireDoux : p.carte,
      }}
    >
      <Text style={{ color: p.texte, fontSize: 13, fontWeight: actif ? '700' : '500' }}>{titre}</Text>
    </Pressable>
  );
}

function CarteCourseAdmin({ course, resume, estompee }: { course: Course; resume: ReturnType<typeof resumeAdmin>; estompee: boolean }) {
  const p = usePalette();
  const passee = new Date(course.dateFin) < new Date();
  return (
    <Pressable
      onPress={() => router.push(`/course/${course.id}`)}
      style={({ pressed }) => ({
        backgroundColor: course.annulee ? p.annuleeFond : p.carte,
        borderColor: course.annulee ? p.annuleeBord : p.bord,
        borderWidth: 1,
        borderRadius: rayon.moyen,
        padding: 12,
        gap: 8,
        opacity: passee && estompee && !course.annulee ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {course.annulee && <BadgeAnnulee />}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Texte v="fort" style={{ flex: 1 }}>
          {course.nom}
        </Texte>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: course.statutTraitement === 'done' ? p.valideFond : p.moisFond,
            borderWidth: 1,
            borderColor: course.statutTraitement === 'done' ? p.valideBord : p.moisBord,
          }}
        >
          <PointEtatCourse course={course} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: p.texte }}>{course.statutTraitement === 'done' ? 'Fait' : 'En cours'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
        <Text style={{ width: '50%', color: p.texteDoux, fontSize: 12 }}>📍 {course.ville || course.localisation}</Text>
        <Text style={{ width: '50%', color: p.texteDoux, fontSize: 12 }}>📅 {dateCourte(course.dateDebut)}</Text>
        <Text style={{ width: '50%', color: p.texteDoux, fontSize: 12 }}>
          📷 {resume.retenus} validé{resume.retenus > 1 ? 's' : ''} · {resume.disponibles} dispo
        </Text>
        <Text style={{ width: '50%', color: p.texteDoux, fontSize: 12 }}>💶 {euros(resume.cout)}</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Grille : colonne des courses fixe, en-tête des personnes fixe
// ---------------------------------------------------------------------------

const LARGEUR_COURSE = 150;
const LARGEUR_CASE = 76;
const HAUTEUR_ENTETE = 44;
const HAUTEUR_MOIS = 34;
const hauteurLigne = (c: Course) => Math.max(1, c.tarifs.length) * 28 + 14;

function Grille({ mois, colonnes, dispos }: { mois: ReturnType<typeof groupesParMois>; colonnes: Personne[]; dispos: Map<string, Dispo> }) {
  const p = usePalette();
  const styles = useStatuts();
  const enCours = useEtat((e) => e.synchro.enCours);
  const lectureSeule = useEtat((e) => e.lectureSeule);
  const gauche = useRef<ScrollViewInstance>(null);
  const entete = useRef<ScrollViewInstance>(null);
  const [choix, setChoix] = useState<{ course: Course; tarif: Tarif; personne: Personne; statut: Statut } | null>(null);

  const suivreVertical = (e: NativeSyntheticEvent<NativeScrollEvent>) => gauche.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
  const suivreHorizontal = (e: NativeSyntheticEvent<NativeScrollEvent>) => entete.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });

  const lignes = mois.flatMap((g) => [{ type: 'mois' as const, g }, ...g.courses.map((c) => ({ type: 'course' as const, c }))]);

  return (
    <View style={{ flex: 1, borderTopWidth: 1, borderColor: p.bord }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', height: HAUTEUR_ENTETE, backgroundColor: p.carte2, borderBottomWidth: 1, borderColor: p.bordFort }}>
        <View style={{ width: LARGEUR_COURSE, justifyContent: 'center', paddingHorizontal: 8, borderRightWidth: 1, borderColor: p.bordFort }}>
          <Text style={{ color: p.texte, fontWeight: '700', fontSize: 13 }}>Course</Text>
        </View>
        <ScrollView ref={entete} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          {colonnes.map((u) => (
            <View key={u.id} style={{ width: LARGEUR_CASE, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
              <Text numberOfLines={1} style={{ color: p.texte, fontSize: 11, fontWeight: u.role === 'admin' ? '800' : '600' }}>
                {u.prenom}
              </Text>
              <Text numberOfLines={1} style={{ color: p.texteDoux, fontSize: 9 }}>
                {u.role === 'admin' ? 'Admin' : u.region || u.nom}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Colonne des courses (suit le défilement vertical) */}
        <ScrollView ref={gauche} scrollEnabled={false} showsVerticalScrollIndicator={false} style={{ width: LARGEUR_COURSE, flexGrow: 0 }}>
          {lignes.map((l) =>
            l.type === 'mois' ? (
              <View key={`m${l.g.cle}`} style={{ height: HAUTEUR_MOIS, justifyContent: 'center', paddingHorizontal: 8, backgroundColor: p.moisFond, borderBottomWidth: 1, borderColor: p.moisBord }}>
                <Text style={{ color: p.texte, fontWeight: '800', fontSize: 13, textTransform: 'capitalize' }}>{moisAnnee(l.g.annee, l.g.mois)}</Text>
              </View>
            ) : (
              <Pressable
                key={l.c.id}
                onPress={() => router.push(`/course/${l.c.id}`)}
                style={{
                  height: hauteurLigne(l.c),
                  paddingHorizontal: 8,
                  justifyContent: 'center',
                  borderBottomWidth: 1,
                  borderRightWidth: 1,
                  borderColor: p.bord,
                  backgroundColor: l.c.annulee ? p.annuleeFond : p.carte,
                }}
              >
                <Text numberOfLines={2} style={{ color: p.texte, fontWeight: '700', fontSize: 12 }}>
                  {l.c.statutTraitement === 'done' ? '🟢 ' : '🟠 '}
                  {l.c.nom}
                </Text>
                <Text style={{ color: p.texteDoux, fontSize: 10, textTransform: 'capitalize' }}>{dateCourte(l.c.dateDebut)}</Text>
              </Pressable>
            ),
          )}
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* Cases */}
        <ScrollView horizontal onScroll={suivreHorizontal} scrollEventThrottle={16} showsHorizontalScrollIndicator>
          <ScrollView
            onScroll={suivreVertical}
            scrollEventThrottle={16}
            refreshControl={<RefreshControl refreshing={enCours} onRefresh={() => void synchroniserMaintenant()} />}
          >
            {lignes.map((l) =>
              l.type === 'mois' ? (
                <View key={`m${l.g.cle}`} style={{ height: HAUTEUR_MOIS, width: colonnes.length * LARGEUR_CASE, backgroundColor: p.moisFond, borderBottomWidth: 1, borderColor: p.moisBord }} />
              ) : (
                <View key={l.c.id} style={{ flexDirection: 'row', height: hauteurLigne(l.c), borderBottomWidth: 1, borderColor: p.bord, opacity: l.c.annulee ? 0.4 : 1 }}>
                  {colonnes.map((u) => (
                    <View key={u.id} style={{ width: LARGEUR_CASE, padding: 3, gap: 2, justifyContent: 'center', borderRightWidth: 1, borderColor: p.bord }}>
                      {l.c.tarifs.map((t) => {
                        const d = dispos.get(cleDispo(l.c.id, u.id, t.id));
                        const s: Statut = d ? statutAdmin(d) : 'pending';
                        const st = styles[s];
                        return (
                          <Pressable
                            key={t.id}
                            disabled={lectureSeule || l.c.archived}
                            onPress={() => setChoix({ course: l.c, tarif: t, personne: u, statut: s })}
                            style={{
                              height: 24,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: st.bord,
                              backgroundColor: st.fond,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text numberOfLines={1} style={{ color: st.texte, fontSize: 10, fontWeight: '700' }}>
                              {l.c.tarifs.length > 1 && t.nom ? `${t.nom.slice(0, 3)}. ` : ''}
                              {st.court}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ),
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        </ScrollView>
      </View>

      <ChoixStatut
        visible={!!choix}
        titre={choix ? `${choix.personne.prenom} ${choix.personne.nom}` : ''}
        sousTitre={choix ? `${choix.course.nom}${choix.tarif.nom ? ` · ${choix.tarif.nom}` : ''}` : undefined}
        options={TOUS}
        actuel={choix?.statut ?? null}
        onFermer={() => setChoix(null)}
        onChoisir={(s) => {
          if (choix) void changerStatut(choix.course.id, choix.personne.id, choix.tarif.id, s);
          setChoix(null);
        }}
      />
    </View>
  );
}
