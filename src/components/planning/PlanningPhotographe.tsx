import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { euros, moisAnnee, plageDeDates } from '@/lib/format';
import {
  DECLARATIONS,
  cleDispo,
  cleWeekend,
  estCacheePour,
  groupesParMois,
  vuePhotographe,
  type VueCourse,
  type VueCreneau,
} from '@/lib/planning';
import { useEtat } from '@/lib/store';
import { changerStatut, choisirPersonne, synchroniserMaintenant } from '@/lib/synchro';
import { rayon, usePalette } from '@/lib/theme';
import type { Dispo, Personne } from '@/lib/types';
import { Texte, Vide } from '@/components/ui';
import { BadgeAnnulee, BandeauWeekend, CaseStatut, ChoixStatut, EnteteMois, PointEtatCourse } from './elements';

/**
 * « Mon calendrier » du photographe — la vue téléphone du site (cartes par
 * mois, bandeau week-end, montants), lisible et modifiable hors ligne : un
 * changement de disponibilité part dès que le réseau revient.
 */
export function PlanningPhotographe({ mode = 'actives' }: { mode?: 'actives' | 'archives' }) {
  const p = usePalette();
  const planning = useEtat((e) => e.planning);
  const file = useEtat((e) => e.file);
  const personneActive = useEtat((e) => e.personneActive);
  const lectureSeule = useEtat((e) => e.lectureSeule);
  const enCours = useEtat((e) => e.synchro.enCours);
  const [choix, setChoix] = useState<{ vue: VueCourse; creneau: VueCreneau; personneId: string } | null>(null);

  const moi = planning?.me;
  const geres = useMemo(() => (planning ? planning.personnes.filter((x) => planning.me.geres.includes(x.id)) : []), [planning]);
  const actif = personneActive && geres.some((g) => g.id === personneActive) ? personneActive : moi?.id ?? '';

  const dispos = useMemo(() => {
    const m = new Map<string, Dispo>();
    for (const d of planning?.dispos ?? []) m.set(cleDispo(d.courseId, d.photographeId, d.tarifId), d);
    return m;
  }, [planning]);
  const enAttente = useMemo(() => new Set(file.map((o) => cleDispo(o.courseId, o.photographeId, o.tarifId))), [file]);
  const mois = useMemo(() => groupesParMois(planning?.courses ?? [], mode), [planning, mode]);

  if (!planning || !moi) return null;

  return (
    <View style={{ flex: 1 }}>
      {geres.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          {[moi as Personne, ...geres].map((x) => (
            <Pressable
              key={x.id}
              onPress={() => choisirPersonne(x.id === moi.id ? null : x.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: x.id === actif ? p.primaire : p.bord,
                backgroundColor: x.id === actif ? p.primaireDoux : p.carte,
              }}
            >
              <Text style={{ color: p.texte, fontWeight: x.id === actif ? '700' : '500' }}>
                {x.prenom} {x.nom}
                {x.id === moi.id ? ' (moi)' : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={enCours} onRefresh={() => void synchroniserMaintenant()} />}
      >
        {mois.length === 0 && (
          <Vide
            icone="calendar-outline"
            titre={mode === 'archives' ? 'Aucune course archivée' : 'Aucune course pour le moment'}
            texte="Les courses apparaissent ici dès que PhotoRunning les ajoute au planning."
          />
        )}
        {mois.map((g) => {
          const vues = g.courses.map((c) => vuePhotographe(c, dispos, actif)).filter((v) => !estCacheePour(v));
          if (vues.length === 0) return null;
          const travail = vues.filter((v) => v.travaille);
          const total = vues.reduce((s, v) => s + v.montant, 0);
          return (
            <View key={g.cle} style={{ gap: 8 }}>
              <EnteteMois
                titre={moisAnnee(g.annee, g.mois)}
                droite={travail.length ? `${travail.length} validée${travail.length > 1 ? 's' : ''} · ${euros(total)}` : undefined}
              />
              {vues.map((v, i) => {
                const avant = i > 0 ? vues[i - 1] : null;
                const wk = cleWeekend(v.course.dateDebut);
                const nouveauWeekend = !avant || cleWeekend(avant.course.dateDebut) !== wk;
                const resume = planning.weekends[wk];
                return (
                  <View key={v.course.id} style={{ gap: 8 }}>
                    {nouveauWeekend && v.travaille && resume ? <BandeauWeekend w={resume} /> : null}
                    <CarteCourse
                      vue={v}
                      estompee={mode !== 'archives'}
                      enAttente={(t) => enAttente.has(cleDispo(v.course.id, actif, t))}
                      lectureSeule={lectureSeule}
                      onChoisir={(creneau) => setChoix({ vue: v, creneau, personneId: actif })}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}
        <Text style={{ color: p.texteDoux, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Une réponse ne peut plus être modifiée une fois la course finalisée par l’admin : contacte-le si besoin.
        </Text>
      </ScrollView>

      <ChoixStatut
        visible={!!choix}
        titre={choix ? choix.vue.course.nom : ''}
        sousTitre={choix?.creneau.tarif.nom ? `Créneau : ${choix.creneau.tarif.nom}` : 'Ta disponibilité'}
        options={DECLARATIONS}
        actuel={choix?.creneau.statut ?? null}
        onFermer={() => setChoix(null)}
        onChoisir={(s) => {
          if (choix) void changerStatut(choix.vue.course.id, choix.personneId, choix.creneau.tarif.id, s);
          setChoix(null);
        }}
      />
    </View>
  );
}

function CarteCourse({
  vue,
  estompee,
  enAttente,
  lectureSeule,
  onChoisir,
}: {
  vue: VueCourse;
  estompee: boolean;
  enAttente: (tarifId: string) => boolean;
  lectureSeule: boolean;
  onChoisir: (c: VueCreneau) => void;
}) {
  const p = usePalette();
  const { course } = vue;
  const multi = course.tarifs.length > 1;
  const fond = course.annulee ? p.annuleeFond : vue.travaille ? (vue.referent ? p.referentFond : p.valideFond) : p.carte;
  const bord = course.annulee ? p.annuleeBord : vue.travaille ? (vue.referent ? p.referentBord : p.valideBord) : p.bord;
  return (
    <Pressable
      onPress={() => router.push(`/course/${course.id}`)}
      style={({ pressed }) => ({
        backgroundColor: fond,
        borderColor: bord,
        borderWidth: 2,
        borderRadius: rayon.moyen,
        padding: 12,
        gap: 6,
        opacity: vue.passee && estompee && !course.annulee ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {course.annulee && <BadgeAnnulee />}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Texte v="fort" style={{ flex: 1 }}>
          {vue.travaille ? (vue.referent ? '👑 ' : '✓ ') : ''}
          {course.nom}
        </Texte>
        <PointEtatCourse course={course} />
      </View>
      <View style={{ gap: 2 }}>
        <Texte v="petit" doux>
          📍 {course.ville || course.localisation}
        </Texte>
        <Texte v="petit" doux>
          📅 {plageDeDates(course.dateDebut, course.dateFin)}
        </Texte>
      </View>
      {!course.annulee && <ResumeCreneaux vue={vue} multi={multi} />}
      <View style={{ gap: 8, marginTop: 4 }}>
        {vue.creneaux.map((c) => (
          <CaseStatut
            key={c.tarif.id}
            statut={c.statut}
            libelleCreneau={multi ? c.tarif.nom : undefined}
            montant={c.montant}
            modifiable={c.modifiable && !lectureSeule}
            enAttente={enAttente(c.tarif.id)}
            onPress={() => onChoisir(c)}
          />
        ))}
      </View>
    </Pressable>
  );
}

/** « Validé sur Samedi et Dimanche · 600 € », sinon les tarifs proposés. */
function ResumeCreneaux({ vue, multi }: { vue: VueCourse; multi: boolean }) {
  const p = usePalette();
  const retenus = vue.creneaux.filter((c) => c.statut === 'validated' || c.statut === 'teamLeader');
  if (retenus.length > 0) {
    const jours = retenus.map((c) => c.tarif.nom).filter(Boolean);
    const tous = multi && retenus.length === vue.creneaux.length;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ backgroundColor: vue.referent ? p.referentBord : p.valideBord, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: vue.referent ? p.referentTexte : p.valideTexte, fontSize: 12, fontWeight: '700' }}>
            {vue.referent ? 'Référent' : 'Validé'}
            {multi && jours.length ? ` sur ${jours.join(' et ')}` : ''}
            {tous && jours.length > 2 ? ' (tous les jours)' : ''}
          </Text>
        </View>
        <Text style={{ color: p.valideFort, fontSize: 13, fontWeight: '800' }}>{euros(vue.montant)}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {vue.creneaux.map((c) => (
        <Text key={c.tarif.id} style={{ color: p.texteDoux, fontSize: 12 }}>
          {multi ? <Text style={{ color: p.lien, fontWeight: '600' }}>{c.tarif.nom} · </Text> : null}
          {c.tarif.tarifPhotographe} €
        </Text>
      ))}
    </View>
  );
}
