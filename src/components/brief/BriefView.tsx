import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { normaliser, plageDeDates } from '@/lib/format';
import { fichierDeCle, telechargerCle, uriLocale } from '@/lib/stockage';
import { alleger, cadreDe, lireTrace, projeteur, type Point } from '@/lib/trace';
import { rayon, usePalette } from '@/lib/theme';
import type { BriefComplet, Section } from '@/lib/types';
import { LigneCanal } from '@/components/contacts/Actions';
import { toast } from '@/components/Toast';
import { Pastille, Texte } from '@/components/ui';
import { Markdown } from './Markdown';

/**
 * LE BRIEF, LISIBLE SANS RÉSEAU — toutes les sections de l'app des briefs,
 * dans l'ordre du brief, avec les images, plans, PDF et traces gardés sur le
 * téléphone. Ce qui concerne la personne connectée (sa ligne dans le
 * tableau, ses fichiers, ses positions) est mis en avant.
 */

const NOMS: Record<string, string> = {
  cover: 'Page d’accueil',
  summary: 'Résumé de l’épreuve',
  photographersTable: 'Photographes',
  courseMap: 'Parcours et positions',
  cameraSettings: 'Réglages photo',
  weather: 'Météo',
  contacts: 'Contacts jour J',
  framing: 'Consignes de cadrage',
  freeText: 'Informations',
  freeImage: 'Image',
  hotel: 'Hébergement',
  meetingPoint: 'Rendez-vous',
  downloadableFiles: 'Fichiers',
};

const ICONES_REGLAGE: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  aperture: 'aperture',
  shutter: 'timer-outline',
  iso: 'sunny-outline',
  flash: 'flash-outline',
  'white-balance': 'color-palette-outline',
  focus: 'scan-outline',
  exposure: 'contrast-outline',
  'image-weight': 'document-outline',
  autofocus: 'locate-outline',
  'image-size': 'resize-outline',
  batteries: 'battery-half-outline',
  equipment: 'camera-outline',
  'focal-length': 'search-outline',
};

interface Moi {
  prenom: string;
  nom: string;
}

const memeNom = (a: Moi, b: { firstName?: string; lastName?: string }) =>
  !!a.prenom &&
  normaliser(a.prenom).trim() === normaliser(b.firstName ?? '').trim() &&
  (!a.nom || !b.lastName || b.lastName === '?' || normaliser(a.nom).trim() === normaliser(b.lastName).trim());

export function BriefView({ brief, moi }: { brief: BriefComplet; moi: Moi | null }) {
  const p = usePalette();
  const fiches = useMemo(() => new Map(brief.photographers.map((x) => [x.id, x])), [brief]);
  const mesIds = useMemo(() => {
    const ids = new Set<string>();
    if (!moi) return ids;
    for (const x of brief.photographers) if (memeNom(moi, x)) ids.add(x.id);
    return ids;
  }, [brief, moi]);
  const sections = brief.sections.filter((s) => s.type !== 'cover');
  const cover = brief.sections.find((s) => s.type === 'cover');

  return (
    <View style={{ gap: 16 }}>
      <Couverture brief={brief} section={cover} />
      {sections.map((s) => (
        <BlocSection key={s.id} titre={s.customTitle || (s.type === 'freeText' || s.type === 'freeImage' ? s.data?.title : '') || NOMS[s.type] || 'Section'}>
          <ContenuSection section={s} brief={brief} fiches={fiches} mesIds={mesIds} moi={moi} />
        </BlocSection>
      ))}
      <Text style={{ color: p.texteDoux, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        Brief mis à jour le {new Date(brief.updatedAt).toLocaleDateString('fr-FR')}.
      </Text>
    </View>
  );
}

function BlocSection({ titre, children }: { titre: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ backgroundColor: p.carte, borderRadius: rayon.grand, borderWidth: 1, borderColor: p.bord, padding: 16, gap: 12 }}>
      <Texte v="sousTitre">{titre}</Texte>
      {children}
    </View>
  );
}

/** Image d'un brief : la copie du téléphone si elle existe, sinon l'adresse en ligne. */
export function ImageBrief({ cle, url, rond, hauteurMax }: { cle?: string | null; url?: string | null; rond?: boolean; hauteurMax?: number }) {
  const p = usePalette();
  const [ratio, setRatio] = useState(4 / 3);
  const source = uriLocale(cle) ?? url ?? null;
  if (!source) {
    return (
      <View style={{ aspectRatio: 4 / 3, borderRadius: rayon.moyen, backgroundColor: p.carte2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cloud-offline-outline" size={22} color={p.texteDoux} />
        <Text style={{ color: p.texteDoux, fontSize: 12, marginTop: 4 }}>Image pas encore téléchargée</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: source }}
      onLoad={(e) => {
        if (e.source.width && e.source.height) setRatio(e.source.width / e.source.height);
      }}
      contentFit="contain"
      style={{ width: '100%', aspectRatio: ratio, maxHeight: hauteurMax, borderRadius: rond ? rayon.moyen : 0, backgroundColor: p.carte2 }}
      transition={150}
    />
  );
}

function Couverture({ brief, section }: { brief: BriefComplet; section?: Section }) {
  const d = section?.data ?? {};
  const fond = d.backgroundType === 'image' ? uriLocale(d.backgroundImageKey) ?? d.backgroundImageUrl : null;
  const logo = uriLocale(d.eventLogoKey) ?? d.eventLogoUrl ?? uriLocale(brief.folder?.logoKey) ?? brief.folder?.logoUrl ?? null;
  const date = d.eventDate ?? brief.eventDate;
  return (
    <View style={{ borderRadius: rayon.grand, overflow: 'hidden', backgroundColor: d.backgroundColor || '#1a1a1a', minHeight: 180, justifyContent: 'flex-end' }}>
      {fond ? <Image source={{ uri: fond }} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 }} /> : null}
      <View style={{ padding: 18, gap: 8 }}>
        {logo ? <Image source={{ uri: logo }} contentFit="contain" style={{ width: 96, height: 56 }} /> : null}
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{d.title || brief.title}</Text>
        {d.subtitle ? <Text style={{ color: '#f1f5f9', fontSize: 15 }}>{d.subtitle}</Text> : null}
        {date ? <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '600' }}>{plageDeDates(date, date)}</Text> : null}
      </View>
    </View>
  );
}

function Ligne2({ icone, texte }: { icone: React.ComponentProps<typeof Ionicons>['name']; texte: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Ionicons name={icone} size={16} color={p.texteDoux} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: p.texte, fontSize: 15, lineHeight: 21 }}>{texte}</Text>
    </View>
  );
}

function BoutonLien({ titre, url, icone = 'navigate-outline' }: { titre: string; url: string; icone?: React.ComponentProps<typeof Ionicons>['name'] }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: p.bord,
        backgroundColor: pressed ? p.carte2 : p.carte,
      })}
    >
      <Ionicons name={icone} size={15} color={p.lien} />
      <Text style={{ color: p.lien, fontWeight: '600', fontSize: 13 }}>{titre}</Text>
    </Pressable>
  );
}

function ContenuSection({
  section,
  brief,
  fiches,
  mesIds,
  moi,
}: {
  section: Section;
  brief: BriefComplet;
  fiches: Map<string, BriefComplet['photographers'][number]>;
  mesIds: Set<string>;
  moi: Moi | null;
}) {
  const p = usePalette();
  const d = section.data ?? {};
  switch (section.type) {
    case 'summary':
      return (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {d.location ? <Pastille texte={`📍 ${d.location}`} fond={p.carte2} couleur={p.texte} /> : null}
            {d.startTime ? <Pastille texte={`🕘 ${d.startTime}`} fond={p.carte2} couleur={p.texte} /> : null}
            {d.distance ? <Pastille texte={`📏 ${d.distance}`} fond={p.carte2} couleur={p.texte} /> : null}
            {d.participantCount ? <Pastille texte={`🏃 ${d.participantCount}`} fond={p.carte2} couleur={p.texte} /> : null}
          </View>
          {(d.courses ?? []).length > 0 && (
            <View style={{ gap: 6 }}>
              {(d.courses as { id: string; name: string; startTime: string; participantCount: string }[]).map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: p.bord }}>
                  <Text style={{ color: p.texte, fontWeight: '700', fontSize: 15 }}>{c.name}</Text>
                  <Text style={{ color: p.texteDoux, fontSize: 14 }}>
                    {c.startTime}
                    {c.participantCount ? ` · ${c.participantCount}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {d.content ? <Markdown source={d.content} /> : null}
        </View>
      );

    case 'freeText':
      return d.content ? <Markdown source={d.content} /> : <Texte doux>—</Texte>;

    case 'freeImage':
      return (
        <View style={{ gap: 8 }}>
          <ImageBrief cle={d.imageKey} url={d.imageUrl} rond />
          {d.comment ? <Texte>{d.comment}</Texte> : null}
        </View>
      );

    case 'cameraSettings':
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(d.settings ?? []).map((r: { id: string; icon: string; value: string }) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.carte2, borderRadius: rayon.moyen, paddingHorizontal: 12, paddingVertical: 10, minWidth: '47%', flexGrow: 1 }}>
              <Ionicons name={ICONES_REGLAGE[r.icon] ?? 'settings-outline'} size={18} color={p.primaire} />
              <Text style={{ color: p.texte, fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{r.value}</Text>
            </View>
          ))}
        </View>
      );

    case 'weather':
      return (
        <View style={{ gap: 10 }}>
          {d.description ? <Texte>{d.description}</Texte> : null}
          {(d.screenshotKeys ?? []).map((k: string, i: number) => (
            <ImageBrief key={k} cle={k} url={d.screenshotUrls?.[i]} rond />
          ))}
        </View>
      );

    case 'contacts':
      return (
        <View style={{ gap: 4 }}>
          {(d.contacts ?? []).map((c: { id: string; name: string; role: string; phone: string; note: string }) => (
            <View key={c.id} style={{ gap: 2, paddingVertical: 4 }}>
              <Text style={{ color: p.texte, fontSize: 15, fontWeight: '700' }}>
                {c.name}
                {c.role ? <Text style={{ color: p.texteDoux, fontWeight: '500' }}> · {c.role}</Text> : null}
              </Text>
              {c.phone ? <LigneCanal type="telephone" valeur={c.phone} nom={c.name} /> : null}
              {c.note ? <Texte v="petit" doux>{c.note}</Texte> : null}
            </View>
          ))}
        </View>
      );

    case 'hotel':
      return (
        <View style={{ gap: 14 }}>
          {(d.hotels ?? []).map((h: { id: string; name: string; imageKey: string | null; imageUrl?: string; details: string; googleMapsLink: string | null }) => (
            <View key={h.id} style={{ gap: 8 }}>
              {h.name ? <Texte v="fort">🏨 {h.name}</Texte> : null}
              {h.imageKey ? <ImageBrief cle={h.imageKey} url={h.imageUrl} rond /> : null}
              {h.details ? <Texte>{h.details}</Texte> : null}
              {h.googleMapsLink ? <BoutonLien titre="Itinéraire" url={h.googleMapsLink} /> : null}
            </View>
          ))}
        </View>
      );

    case 'meetingPoint':
      return (
        <View style={{ gap: 14 }}>
          {(d.meetingPoints ?? []).map(
            (m: { id: string; time: string; description: string; location: string; googleMapsLink: string | null; gpxKmlKey: string | null; additionalInfo: string }) => (
              <View key={m.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {m.time ? (
                    <View style={{ backgroundColor: p.primaire, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: p.primaireTexte, fontWeight: '800', fontSize: 16 }}>{m.time}</Text>
                    </View>
                  ) : null}
                  {m.description ? <Texte v="fort" style={{ flex: 1 }}>{m.description}</Texte> : null}
                </View>
                {m.location ? <Ligne2 icone="location-outline" texte={m.location} /> : null}
                {m.additionalInfo ? <Texte doux>{m.additionalInfo}</Texte> : null}
                {m.googleMapsLink ? <BoutonLien titre="Itinéraire" url={m.googleMapsLink} /> : null}
              </View>
            ),
          )}
        </View>
      );

    case 'framing':
      return (
        <View style={{ gap: 16 }}>
          {(d.contextGroups ?? []).map((g: { id: string; name: string; examples: { id: string; imageKey: string; imageUrl?: string; type: 'do' | 'dont'; caption: string }[] }) => (
            <View key={g.id} style={{ gap: 8 }}>
              {g.name ? <Texte v="fort">{g.name}</Texte> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {g.examples.map((ex) => (
                  <View key={ex.id} style={{ width: '48%', gap: 4 }}>
                    <View style={{ borderRadius: rayon.moyen, overflow: 'hidden', borderWidth: 3, borderColor: ex.type === 'do' ? '#10b981' : '#ef4444' }}>
                      <ImageBrief cle={ex.imageKey} url={ex.imageUrl} />
                    </View>
                    <Text style={{ color: ex.type === 'do' ? p.valideFort : p.danger, fontWeight: '700', fontSize: 13 }}>
                      {ex.type === 'do' ? '✅ À faire' : '❌ À éviter'}
                    </Text>
                    {ex.caption ? <Text style={{ color: p.texteDoux, fontSize: 12 }}>{ex.caption}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      );

    case 'photographersTable':
      return <TableauPhotographes data={d} fiches={fiches} mesIds={mesIds} moi={moi} />;

    case 'courseMap':
      return <Parcours data={d} fiches={fiches} mesIds={mesIds} />;

    case 'downloadableFiles':
      return <Fichiers data={d} fiches={fiches} mesIds={mesIds} brief={brief} />;

    default:
      return <Texte doux>Section non prise en charge dans l’app : ouvre le brief sur le web.</Texte>;
  }
}

// ---------------------------------------------------------------------------
// Tableau des photographes
// ---------------------------------------------------------------------------

type LigneTableau = {
  id: string;
  photographerId: string | null;
  firstName: string;
  lastName: string;
  cardTypes: string[];
  transport: null | {
    mode: 'car' | 'train' | 'plane' | null;
    departureLocation: string;
    departureTime: string;
    arrivalLocation: string;
    arrivalTime: string;
    hasReturn: boolean;
    returnDepartureLocation: string;
    returnDepartureTime: string;
    returnArrivalLocation: string;
    returnArrivalTime: string;
    carpoolDriverRowId?: string | null;
  };
  customColumns: { id: string; value: string }[];
  comment: string;
};

const nomLigne = (l: LigneTableau, fiches: Map<string, { firstName: string; lastName: string }>) => {
  const f = l.photographerId ? fiches.get(l.photographerId) : undefined;
  const prenom = f?.firstName || l.firstName;
  const nom = f?.lastName && f.lastName !== '?' ? f.lastName : l.lastName && l.lastName !== '?' ? l.lastName : '';
  return `${prenom} ${nom}`.trim();
};

function TableauPhotographes({
  data,
  fiches,
  mesIds,
  moi,
}: {
  data: any;
  fiches: Map<string, BriefComplet['photographers'][number]>;
  mesIds: Set<string>;
  moi: Moi | null;
}) {
  const p = usePalette();
  const lignes = (data.rows ?? []) as LigneTableau[];
  const entetes = new Map(((data.customColumnHeaders ?? []) as { id: string; title: string }[]).map((h) => [h.id, h.title]));
  const estMoi = (l: LigneTableau) => (l.photographerId && mesIds.has(l.photographerId)) || (!!moi && memeNom(moi, l));
  const triees = [...lignes].sort((a, b) => Number(estMoi(b)) - Number(estMoi(a)));
  const MODE = { car: '🚗 Voiture', train: '🚆 Train', plane: '✈️ Avion' } as const;
  return (
    <View style={{ gap: 8 }}>
      {triees.map((l) => {
        const conducteur = l.transport?.carpoolDriverRowId ? lignes.find((x) => x.id === l.transport?.carpoolDriverRowId) ?? null : null;
        const passagers = lignes.filter((x) => x.transport?.carpoolDriverRowId === l.id);
        const t = conducteur ? conducteur.transport : l.transport;
        const moiIci = estMoi(l);
        return (
          <View
            key={l.id}
            style={{
              borderRadius: rayon.moyen,
              borderWidth: moiIci ? 2 : 1,
              borderColor: moiIci ? p.primaire : p.bord,
              backgroundColor: moiIci ? p.primaireDoux : p.carte2,
              padding: 12,
              gap: 4,
            }}
          >
            <Text style={{ color: p.texte, fontWeight: '800', fontSize: 15 }}>
              {nomLigne(l, fiches)}
              {moiIci ? ' (toi)' : ''}
            </Text>
            {l.comment ? <Text style={{ color: p.texte, fontSize: 14 }}>{l.comment}</Text> : null}
            {data.showCardTypes && l.cardTypes?.length ? <Text style={{ color: p.texteDoux, fontSize: 13 }}>💾 {l.cardTypes.join(', ')}</Text> : null}
            {data.showTransport && t?.mode ? (
              <View style={{ gap: 2 }}>
                <Text style={{ color: p.texte, fontSize: 13, fontWeight: '600' }}>{MODE[t.mode]}</Text>
                {conducteur ? <Text style={{ color: p.valideFort, fontSize: 12, fontWeight: '600' }}>Covoiturage avec {nomLigne(conducteur, fiches)}</Text> : null}
                {passagers.length ? (
                  <Text style={{ color: p.valideFort, fontSize: 12, fontWeight: '600' }}>Emmène {passagers.map((x) => nomLigne(x, fiches)).join(', ')}</Text>
                ) : null}
                {t.departureLocation && t.arrivalLocation ? (
                  <Text style={{ color: p.texteDoux, fontSize: 12 }}>
                    {t.departureLocation} ({t.departureTime}) → {t.arrivalLocation} ({t.arrivalTime})
                  </Text>
                ) : null}
                {t.hasReturn && t.returnDepartureLocation && t.returnArrivalLocation ? (
                  <Text style={{ color: p.texteDoux, fontSize: 12 }}>
                    ↩ {t.returnDepartureLocation} ({t.returnDepartureTime}) → {t.returnArrivalLocation} ({t.returnArrivalTime})
                  </Text>
                ) : null}
              </View>
            ) : null}
            {l.customColumns
              ?.filter((c) => c.value && entetes.has(c.id))
              .map((c) => (
                <Text key={c.id} style={{ color: p.texte, fontSize: 13 }}>
                  <Text style={{ color: p.texteDoux }}>{entetes.get(c.id)} : </Text>
                  {c.value}
                </Text>
              ))}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Parcours : plan image avec repères, ou trace GPX dessinée hors ligne
// ---------------------------------------------------------------------------

type Repere = {
  id: string;
  x: number;
  y: number;
  photographerIds: string[];
  positionLabel: string;
  instructions: string;
  googleMapsLink: string | null;
  customLinks: { label: string; url: string }[];
};

function Parcours({
  data,
  fiches,
  mesIds,
}: {
  data: any;
  fiches: Map<string, BriefComplet['photographers'][number]>;
  mesIds: Set<string>;
}) {
  const p = usePalette();
  const cartes = (data.images ?? []) as {
    id: string;
    mapType: 'image' | 'gpx';
    imageKey: string | null;
    imageUrl?: string | null;
    gpxKmlKey: string | null;
    gpxKmlFilename: string | null;
    title: string;
    markers: Repere[];
  }[];
  const routes = (data.downloadableRoutes ?? []) as { id: string; name: string; fileKey: string; fileUrl?: string; filename: string }[];
  return (
    <View style={{ gap: 18 }}>
      {cartes.map((c) => {
        const reperes = [...c.markers].sort((a, b) => Number(b.photographerIds.some((id) => mesIds.has(id))) - Number(a.photographerIds.some((id) => mesIds.has(id))));
        return (
          <View key={c.id} style={{ gap: 10 }}>
            {c.title ? <Texte v="fort">{c.title}</Texte> : null}
            {c.mapType === 'gpx' ? (
              <TraceGpx cle={c.gpxKmlKey} nomFichier={c.gpxKmlFilename} reperes={c.markers} mesIds={mesIds} />
            ) : (
              <PlanImage cle={c.imageKey} url={c.imageUrl ?? null} reperes={c.markers} mesIds={mesIds} />
            )}
            {reperes.map((m) => {
              const n = c.markers.indexOf(m) + 1;
              const miens = m.photographerIds.some((id) => mesIds.has(id));
              const noms = m.photographerIds.map((id) => fiches.get(id)).filter(Boolean).map((f) => `${f!.firstName} ${f!.lastName !== '?' ? f!.lastName : ''}`.trim());
              return (
                <View
                  key={m.id}
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    padding: 10,
                    borderRadius: rayon.moyen,
                    backgroundColor: miens ? p.primaireDoux : p.carte2,
                    borderWidth: miens ? 2 : 0,
                    borderColor: p.primaire,
                  }}
                >
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: miens ? p.primaire : '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{n}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: p.texte, fontWeight: '700', fontSize: 15 }}>
                      {m.positionLabel || `Position ${n}`}
                      {miens ? ' · ta position' : ''}
                    </Text>
                    {noms.length ? <Text style={{ color: p.texteDoux, fontSize: 13 }}>📷 {noms.join(', ')}</Text> : null}
                    {m.instructions ? <Text style={{ color: p.texte, fontSize: 14, lineHeight: 20 }}>{m.instructions}</Text> : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {m.googleMapsLink ? <BoutonLien titre="Y aller" url={m.googleMapsLink} /> : null}
                      {(m.customLinks ?? []).map((l, i) => (
                        <BoutonLien key={i} titre={l.label || 'Lien'} url={l.url} icone="link-outline" />
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      {routes.length > 0 && (
        <View style={{ gap: 6 }}>
          <Texte v="petit" doux style={{ fontWeight: '700' }}>
            TRACES À TÉLÉCHARGER
          </Texte>
          {routes.map((r) => (
            <LigneFichier key={r.id} cle={r.fileKey} url={r.fileUrl ?? null} titre={r.name} nomFichier={r.filename} icone="map-outline" />
          ))}
        </View>
      )}
    </View>
  );
}

function PlanImage({ cle, url, reperes, mesIds }: { cle: string | null; url: string | null; reperes: Repere[]; mesIds: Set<string> }) {
  const p = usePalette();
  const [taille, setTaille] = useState<{ l: number; h: number } | null>(null);
  const [ratio, setRatio] = useState(4 / 3);
  const source = uriLocale(cle) ?? url;
  if (!source) return <ImageBrief cle={cle} url={url} />;
  return (
    <View
      onLayout={(e) => setTaille({ l: e.nativeEvent.layout.width, h: e.nativeEvent.layout.width / ratio })}
      style={{ width: '100%', aspectRatio: ratio, borderRadius: rayon.moyen, overflow: 'hidden', backgroundColor: p.carte2 }}
    >
      <Image
        source={{ uri: source }}
        contentFit="fill"
        style={{ width: '100%', height: '100%' }}
        onLoad={(e) => {
          if (e.source.width && e.source.height) setRatio(e.source.width / e.source.height);
        }}
      />
      {taille &&
        reperes.map((m, i) => {
          const miens = m.photographerIds.some((id) => mesIds.has(id));
          return (
            <View
              key={m.id}
              style={{
                position: 'absolute',
                left: m.x * taille.l - 12,
                top: m.y * (taille.l / ratio) - 12,
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: '#fff',
                backgroundColor: miens ? p.primaire : '#ef4444',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{i + 1}</Text>
            </View>
          );
        })}
    </View>
  );
}

function TraceGpx({ cle, nomFichier, reperes, mesIds }: { cle: string | null; nomFichier: string | null; reperes: Repere[]; mesIds: Set<string> }) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const [traces, setTraces] = useState<Point[][] | null>(null);
  useEffect(() => {
    let vivant = true;
    (async () => {
      const uri = uriLocale(cle);
      if (!uri) return setTraces([]);
      try {
        const texte = await new File(uri).text();
        if (vivant) setTraces(lireTrace(texte, nomFichier).map((t) => alleger(t)));
      } catch {
        if (vivant) setTraces([]);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [cle, nomFichier]);

  const largeur = Math.min(width - 64, 640);
  const hauteur = largeur * 0.8;
  // Pour une trace GPX, les repères sont en coordonnées (x = longitude, y = latitude).
  const points = reperes.map((m) => ({ lat: m.y, lon: m.x }));
  const cadre = traces ? cadreDe(traces, points) : null;
  if (!traces) return <View style={{ height: hauteur, backgroundColor: p.carte2, borderRadius: rayon.moyen }} />;
  if (!cadre) {
    return (
      <View style={{ padding: 16, backgroundColor: p.carte2, borderRadius: rayon.moyen }}>
        <Texte doux>Trace pas encore téléchargée sur ce téléphone.</Texte>
      </View>
    );
  }
  const projeter = projeteur(cadre, largeur, hauteur);
  return (
    <View style={{ alignItems: 'center', backgroundColor: p.carte2, borderRadius: rayon.moyen, paddingVertical: 6 }}>
      <Svg width={largeur} height={hauteur}>
        {traces.map((t, i) => (
          <Polyline
            key={i}
            points={t.map((pt) => projeter(pt)).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={p.primaire}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {reperes.map((m) => {
          const q = projeter({ lat: m.y, lon: m.x });
          const miens = m.photographerIds.some((id) => mesIds.has(id));
          return <Circle key={`c${m.id}`} cx={q.x} cy={q.y} r={10} fill={miens ? p.primaire : '#ef4444'} stroke="#fff" strokeWidth={2} />;
        })}
        {reperes.map((m, i) => {
          const q = projeter({ lat: m.y, lon: m.x });
          return (
            <SvgText key={`t${m.id}`} x={q.x} y={q.y + 4} fontSize={10} fontWeight="bold" fill="#fff" textAnchor="middle">
              {String(i + 1)}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={{ color: p.texteDoux, fontSize: 11 }}>Trace sans fond de carte (consultable hors ligne)</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fichiers : billets, réservations, documents
// ---------------------------------------------------------------------------

const ICONES_FICHIER: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ticket: 'ticket-outline',
  hotel: 'bed-outline',
  parking: 'car-outline',
  document: 'document-text-outline',
  other: 'document-outline',
};

function Fichiers({
  data,
  fiches,
  mesIds,
}: {
  data: any;
  fiches: Map<string, BriefComplet['photographers'][number]>;
  mesIds: Set<string>;
  brief: BriefComplet;
}) {
  const fichiers = (data.files ?? []) as { id: string; title: string; fileKey: string; fileUrl?: string; filename: string; photographerIds: string[]; fileType: string }[];
  const pourMoi = (f: (typeof fichiers)[number]) => f.photographerIds.some((id) => mesIds.has(id));
  const tries = [...fichiers].sort((a, b) => Number(pourMoi(b)) - Number(pourMoi(a)));
  return (
    <View style={{ gap: 6 }}>
      {tries.map((f) => {
        const pour = f.photographerIds.length
          ? f.photographerIds
              .map((id) => fiches.get(id))
              .filter(Boolean)
              .map((x) => x!.firstName)
              .join(', ')
          : 'Tous';
        return (
          <LigneFichier
            key={f.id}
            cle={f.fileKey}
            url={f.fileUrl ?? null}
            titre={f.title || f.filename}
            nomFichier={f.filename}
            detail={pourMoi(f) ? 'Pour toi' : `Pour : ${pour}`}
            enAvant={pourMoi(f)}
            icone={ICONES_FICHIER[f.fileType] ?? 'document-outline'}
          />
        );
      })}
    </View>
  );
}

function typeMime(nom: string): string {
  const ext = nom.toLowerCase().split('.').pop() ?? '';
  return (
    ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gpx: 'application/gpx+xml', kml: 'application/vnd.google-earth.kml+xml' } as Record<string, string>)[ext] ??
    'application/octet-stream'
  );
}

function LigneFichier({
  cle,
  url,
  titre,
  nomFichier,
  detail,
  enAvant,
  icone,
}: {
  cle: string;
  url: string | null;
  titre: string;
  nomFichier: string;
  detail?: string;
  enAvant?: boolean;
  icone: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const p = usePalette();
  const [occupe, setOccupe] = useState(false);
  const [present, setPresent] = useState(() => !!uriLocale(cle));

  const ouvrir = async () => {
    try {
      setOccupe(true);
      if (!uriLocale(cle)) {
        if (!url) return toast('Fichier pas encore sur le téléphone');
        const ok = await telechargerCle(cle, url);
        if (!ok) return toast('Téléchargement impossible (réseau ?)');
        setPresent(true);
      }
      const f = fichierDeCle(cle);
      const mimeType = typeMime(nomFichier);
      if (await f.canPreview({ mimeType }).catch(() => false)) {
        await f.preview({ title: titre, mimeType });
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: titre });
      }
    } catch {
      toast('Impossible d’ouvrir ce fichier');
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Pressable
      onPress={() => void ouvrir()}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: rayon.moyen,
        borderWidth: enAvant ? 2 : 1,
        borderColor: enAvant ? p.primaire : p.bord,
        backgroundColor: pressed ? p.carte2 : enAvant ? p.primaireDoux : p.carte,
      })}
    >
      <Ionicons name={icone} size={22} color={p.primaire} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.texte, fontWeight: '700', fontSize: 15 }} numberOfLines={2}>
          {titre}
        </Text>
        <Text style={{ color: p.texteDoux, fontSize: 12 }}>
          {detail ? `${detail} · ` : ''}
          {present ? 'Sur le téléphone' : 'À télécharger'}
        </Text>
      </View>
      <Ionicons name={occupe ? 'hourglass-outline' : present ? 'open-outline' : 'cloud-download-outline'} size={20} color={p.texteDoux} />
    </Pressable>
  );
}
