import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { euros, plageDeDates } from '@/lib/format';
import { cleDispo, cleWeekend, DECLARATIONS, estTravail, resumeAdmin, resumePassageFait, statutAdmin, vuePhotographe } from '@/lib/planning';
import { useEtat } from '@/lib/store';
import { changerEtatCourse, changerStatut } from '@/lib/synchro';
import { usePalette, useStatuts } from '@/lib/theme';
import type { Course, Dispo, Personne, Statut, Tarif } from '@/lib/types';
import { LigneCanal } from '@/components/contacts/Actions';
import { BadgeAnnulee, BandeauWeekend, CaseStatut, ChoixStatut, PointEtatCourse } from '@/components/planning/elements';
import { toast } from '@/components/Toast';
import { Bandeau, Bouton, Carte, Dialogue, Section, Texte, Vide } from '@/components/ui';

const TOUS: Statut[] = ['pending', 'available', 'unavailable', 'validated', 'teamLeader', 'rejected', 'nonPris'];

/** Fiche d'une course : la sienne pour un photographe, toute l'équipe pour un admin. */
export default function FicheCourse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const planning = useEtat((e) => e.planning);
  const admin = useEtat((e) => e.utilisateur?.role === 'admin');
  const course = planning?.courses.find((c) => c.id === id);

  if (!planning || !course) {
    return (
      <View style={{ flex: 1, backgroundColor: p.fond }}>
        <Stack.Screen options={{ title: 'Course' }} />
        <Vide icone="calendar-outline" titre="Course introuvable" texte="Elle n’est plus dans ton planning, ou pas encore synchronisée." />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.fond }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
      <Stack.Screen options={{ title: course.nom }} />
      <EnTete course={course} />
      {admin ? <VueAdmin course={course} /> : <VuePhotographe course={course} />}
      <Infos course={course} admin={admin} />
      <BriefDeLaCourse course={course} />
    </ScrollView>
  );
}

function EnTete({ course }: { course: Course }) {
  return (
    <View style={{ gap: 6 }}>
      {course.annulee && <BadgeAnnulee />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Texte v="titre" style={{ flex: 1 }}>
          {course.nom}
        </Texte>
        <PointEtatCourse course={course} />
      </View>
      <Texte doux>📍 {course.localisation || course.ville}</Texte>
      <Texte doux>📅 {plageDeDates(course.dateDebut, course.dateFin)}</Texte>
      {course.coureursAttendus > 0 ? <Texte doux>🏃 {course.coureursAttendus.toLocaleString('fr-FR')} coureurs attendus</Texte> : null}
    </View>
  );
}

function VuePhotographe({ course }: { course: Course }) {
  const p = usePalette();
  const planning = useEtat((e) => e.planning)!;
  const personneActive = useEtat((e) => e.personneActive);
  const lectureSeule = useEtat((e) => e.lectureSeule);
  const file = useEtat((e) => e.file);
  const [choix, setChoix] = useState<Tarif | null>(null);
  const actif = personneActive && planning.me.geres.includes(personneActive) ? personneActive : planning.me.id;
  const dispos = useMemo(() => {
    const m = new Map<string, Dispo>();
    for (const d of planning.dispos) m.set(cleDispo(d.courseId, d.photographeId, d.tarifId), d);
    return m;
  }, [planning]);
  const vue = vuePhotographe(course, dispos, actif);
  const equipe = planning.equipes[course.id] ?? [];
  const wk = planning.weekends[cleWeekend(course.dateDebut)];
  const multi = course.tarifs.length > 1;

  const ajouterAuCalendrier = async () => {
    const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PhotoRunning//Equipe//FR',
      'BEGIN:VEVENT',
      `UID:${course.id}@photorunning.com`,
      `DTSTAMP:${f(new Date().toISOString())}`,
      `DTSTART:${f(course.dateDebut)}`,
      `DTEND:${f(course.dateFin)}`,
      `SUMMARY:${course.nom}`,
      `LOCATION:${[course.localisation, course.ville].filter(Boolean).join(', ')}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      `DESCRIPTION:Rappel : ${course.nom} demain`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    try {
      const fichier = new File(Paths.cache, `${course.nom.replace(/[^a-z0-9]/gi, '_')}.ics`);
      if (fichier.exists) fichier.delete();
      fichier.create();
      await fichier.write(ics);
      await Sharing.shareAsync(fichier.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: 'Ajouter au calendrier' });
    } catch {
      toast('Impossible de créer l’événement');
    }
  };

  return (
    <>
      {vue.travaille && wk ? <BandeauWeekend w={wk} /> : null}
      <Section titre={vue.creneaux.some((c) => c.modifiable) ? 'Ta disponibilité' : 'Ton statut'}>
        <View style={{ gap: 10 }}>
          {vue.creneaux.map((c) => (
            <CaseStatut
              key={c.tarif.id}
              statut={c.statut}
              libelleCreneau={multi ? `${c.tarif.nom} · ${c.tarif.tarifPhotographe} €` : `${c.tarif.tarifPhotographe} €`}
              montant={c.montant}
              modifiable={c.modifiable && !lectureSeule}
              enAttente={file.some((o) => o.courseId === course.id && o.photographeId === actif && o.tarifId === c.tarif.id)}
              onPress={() => setChoix(c.tarif)}
            />
          ))}
          {vue.travaille ? (
            <Text style={{ color: p.valideFort, fontWeight: '800', fontSize: 15 }}>Total : {euros(vue.montant)}</Text>
          ) : null}
          {course.statutTraitement !== 'done' && !course.annulee ? (
            <Texte v="petit" doux>
              L’affectation s’affichera quand PhotoRunning aura finalisé la course.
            </Texte>
          ) : null}
          {vue.travaille ? <Bouton titre="Ajouter à mon calendrier" icone="calendar-outline" variante="secondaire" onPress={() => void ajouterAuCalendrier()} /> : null}
        </View>
      </Section>

      {vue.travaille && equipe.length > 0 ? (
        <Section titre={`L’équipe (${equipe.length})`}>
          <Carte style={{ gap: 6 }}>
            {equipe.map((x, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ color: p.texte, fontSize: 15, fontWeight: x.referent ? '800' : '500' }}>
                  {x.referent ? '👑 ' : ''}
                  {x.prenom} {x.nom}
                  {x.referent ? <Text style={{ color: p.texteDoux, fontWeight: '500' }}> · référent</Text> : null}
                </Text>
                {x.referent && x.telephone ? <LigneCanal type="telephone" valeur={x.telephone} nom={`${x.prenom} ${x.nom}`} /> : null}
              </View>
            ))}
          </Carte>
        </Section>
      ) : null}

      <ChoixStatut
        visible={!!choix}
        titre={course.nom}
        sousTitre={choix?.nom ? `Créneau : ${choix.nom}` : 'Ta disponibilité'}
        options={DECLARATIONS}
        actuel={choix ? vue.creneaux.find((c) => c.tarif.id === choix.id)?.statut ?? null : null}
        onFermer={() => setChoix(null)}
        onChoisir={(s) => {
          if (choix) void changerStatut(course.id, actif, choix.id, s);
          setChoix(null);
        }}
      />
    </>
  );
}

function VueAdmin({ course }: { course: Course }) {
  const p = usePalette();
  const styles = useStatuts();
  const planning = useEtat((e) => e.planning)!;
  const enLigne = useEtat((e) => e.enLigne);
  const lectureSeule = useEtat((e) => e.lectureSeule);
  const [choix, setChoix] = useState<{ tarif: Tarif; personne: Personne; statut: Statut } | null>(null);
  const [dialogue, setDialogue] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const colonnes = useMemo(
    () => planning.personnes.filter((x) => x.actif).sort((a, b) => (a.role === b.role ? a.prenom.localeCompare(b.prenom) : a.role === 'admin' ? -1 : 1)),
    [planning],
  );
  const dispos = useMemo(() => {
    const m = new Map<string, Dispo>();
    for (const d of planning.dispos) m.set(cleDispo(d.courseId, d.photographeId, d.tarifId), d);
    return m;
  }, [planning]);
  const resume = resumeAdmin(course, dispos, colonnes);
  const passage = resumePassageFait(course, dispos, colonnes);
  const versFait = course.statutTraitement !== 'done';

  const ordre: Statut[] = ['teamLeader', 'validated', 'available', 'pending', 'unavailable', 'rejected', 'nonPris'];

  return (
    <>
      <Carte style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {[
          { v: String(resume.retenus), l: 'Retenus' },
          { v: String(resume.disponibles), l: 'Dispos' },
          { v: euros(resume.cout), l: 'Cachets' },
        ].map((x) => (
          <View key={x.l} style={{ alignItems: 'center' }}>
            <Text style={{ color: p.texte, fontSize: 20, fontWeight: '800' }}>{x.v}</Text>
            <Text style={{ color: p.texteDoux, fontSize: 12 }}>{x.l}</Text>
          </View>
        ))}
      </Carte>

      <View style={{ gap: 8 }}>
        <Bouton
          titre={versFait ? 'Passer en « Fait »' : 'Repasser « En cours »'}
          icone={versFait ? 'checkmark-done' : 'arrow-undo'}
          variante={versFait ? 'primaire' : 'secondaire'}
          desactive={!enLigne || lectureSeule || course.archived}
          onPress={() => setDialogue(true)}
        />
        {!enLigne ? <Texte v="petit" doux>Il faut du réseau pour finaliser une course.</Texte> : null}
        {erreur ? <Bandeau ton="danger" icone="alert-circle" texte={erreur} /> : null}
      </View>

      {course.tarifs.map((t) => {
        const lignes = colonnes
          .map((u) => {
            const d = dispos.get(cleDispo(course.id, u.id, t.id));
            return { u, statut: (d ? statutAdmin(d) : 'pending') as Statut };
          })
          .sort((a, b) => ordre.indexOf(a.statut) - ordre.indexOf(b.statut) || a.u.prenom.localeCompare(b.u.prenom));
        return (
          <Section key={t.id} titre={`${t.nom || 'Photographes'} · ${t.tarifPhotographe} €${t.bonusChefEquipe ? ` (+${t.bonusChefEquipe} € référent)` : ''}`}>
            <Carte style={{ paddingVertical: 4 }}>
              {lignes.map(({ u, statut }) => {
                const s = styles[statut];
                return (
                  <Pressable
                    key={u.id}
                    disabled={lectureSeule || course.archived}
                    onPress={() => setChoix({ tarif: t, personne: u, statut })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.texte, fontSize: 15, fontWeight: estTravail(statut) ? '700' : '500' }}>
                        {u.prenom} {u.nom}
                        {u.role === 'admin' ? <Text style={{ color: p.texteDoux, fontSize: 12 }}> · admin</Text> : null}
                      </Text>
                      {u.region ? <Text style={{ color: p.texteDoux, fontSize: 12 }}>{u.region}</Text> : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: s.fond, borderColor: s.bord, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.point }} />
                      <Text style={{ color: s.texte, fontWeight: '700', fontSize: 12 }}>{s.libelle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={p.texteDoux} />
                  </Pressable>
                );
              })}
            </Carte>
          </Section>
        );
      })}

      <ChoixStatut
        visible={!!choix}
        titre={choix ? `${choix.personne.prenom} ${choix.personne.nom}` : ''}
        sousTitre={choix ? `${course.nom}${choix.tarif.nom ? ` · ${choix.tarif.nom}` : ''}` : undefined}
        options={TOUS}
        actuel={choix?.statut ?? null}
        onFermer={() => setChoix(null)}
        onChoisir={(s) => {
          if (choix) void changerStatut(course.id, choix.personne.id, choix.tarif.id, s);
          setChoix(null);
        }}
      />
      <Dialogue
        visible={dialogue}
        titre={versFait ? `Passer « ${course.nom} » en Fait ?` : `Repasser « ${course.nom} » en cours ?`}
        texte={
          versFait
            ? `Les photographes verront leur statut. ${passage.retenus} retenu${passage.retenus > 1 ? 's' : ''} ; ${passage.versRefuse} dispo non retenu${passage.versRefuse > 1 ? 's' : ''} passeront en « Refusé » ; ${passage.versNonPris} autre${passage.versNonPris > 1 ? 's' : ''} en « Non pris ». Les photographes retenus sont envoyés dans le brief.`
            : 'Les décisions déjà publiées restent visibles des photographes ; la course redevient modifiable.'
        }
        confirmer={versFait ? 'Passer en Fait' : 'Repasser en cours'}
        chargement={enCours}
        onFermer={() => setDialogue(false)}
        onConfirmer={async () => {
          setEnCours(true);
          setErreur(null);
          try {
            await changerEtatCourse(course.id, versFait ? 'done' : 'inProgress');
            toast(versFait ? 'Course passée en Fait' : 'Course repassée en cours');
          } catch (err) {
            setErreur(err instanceof Error ? err.message : 'Changement impossible');
          } finally {
            setEnCours(false);
            setDialogue(false);
          }
        }}
      />
    </>
  );
}

function Infos({ course, admin }: { course: Course; admin: boolean }) {
  const p = usePalette();
  const planning = useEtat((e) => e.planning)!;
  const dispos = planning.dispos;
  const travaille = dispos.some((d) => d.courseId === course.id && d.photographeId === planning.me.id && d.published && estTravail(d.decision));
  if (!admin && !travaille && !course.description) return null;
  const blocs: { icone: React.ComponentProps<typeof Ionicons>['name']; titre: string; texte: string; valide?: boolean }[] = [];
  if (course.hotel && (admin || travaille)) blocs.push({ icone: 'bed-outline', titre: 'Hôtel', texte: course.hotel, valide: admin ? course.hotelValid : undefined });
  if (course.transport && (admin || travaille)) blocs.push({ icone: 'train-outline', titre: 'Transport', texte: course.transport, valide: admin ? course.transportValid : undefined });
  if (course.supplementaire && (admin || travaille)) blocs.push({ icone: 'information-circle-outline', titre: 'Informations', texte: course.supplementaire });
  if (course.description) blocs.push({ icone: 'reader-outline', titre: 'Description', texte: course.description });
  if (blocs.length === 0) return null;
  return (
    <Section titre="Logistique">
      <Carte style={{ gap: 12 }}>
        {blocs.map((b) => (
          <View key={b.titre} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={b.icone} size={16} color={p.texte} />
              <Text style={{ color: p.texte, fontWeight: '700' }}>{b.titre}</Text>
              {b.valide !== undefined ? (
                <Text style={{ fontSize: 11, fontWeight: '700', color: b.valide ? p.valideFort : p.danger }}>{b.valide ? 'validé' : 'à valider'}</Text>
              ) : null}
            </View>
            <Texte doux>{b.texte}</Texte>
          </View>
        ))}
      </Carte>
    </Section>
  );
}

function BriefDeLaCourse({ course }: { course: Course }) {
  const p = usePalette();
  const brief = useEtat((e) => e.planning?.briefs?.find((b) => b.courseIds.includes(course.id) || b.id === course.briefId));
  const local = useEtat((e) => (brief ? e.briefsLocaux[brief.id] : undefined));
  if (!brief) return null;
  return (
    <Section titre="Brief">
      <Carte onPress={() => router.push(`/brief/${brief.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: p.primaireDoux, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="document-text" size={22} color={p.primaire} />
        </View>
        <View style={{ flex: 1 }}>
          <Texte v="fort">{brief.title}</Texte>
          <Texte v="petit" doux>
            {local?.fichiers === 'complets' ? 'Disponible hors ligne' : local ? 'Sur le téléphone' : 'À charger'}
          </Texte>
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.texteDoux} />
      </Carte>
    </Section>
  );
}
