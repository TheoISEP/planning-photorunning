import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useEtat } from '@/lib/store';
import { synchroniserMaintenant } from '@/lib/synchro';
import { usePalette } from '@/lib/theme';
import { PlanningAdmin } from '@/components/planning/PlanningAdmin';
import { PlanningPhotographe } from '@/components/planning/PlanningPhotographe';
import { Bouton, Texte, Vide } from '@/components/ui';

type Vue = 'calendrier' | 'moi' | 'archives';

export default function OngletPlanning() {
  const p = usePalette();
  const admin = useEtat((e) => e.utilisateur?.role === 'admin');
  const aDesDonnees = useEtat((e) => !!e.planning);
  const enCours = useEtat((e) => e.synchro.enCours);
  const [vue, setVue] = useState<Vue>(admin ? 'calendrier' : 'moi');

  const onglets: { cle: Vue; titre: string }[] = admin
    ? [
        { cle: 'calendrier', titre: 'Calendrier' },
        { cle: 'moi', titre: 'Mon calendrier' },
        { cle: 'archives', titre: 'Archives' },
      ]
    : [
        { cle: 'moi', titre: 'Mon calendrier' },
        { cle: 'archives', titre: 'Archives' },
      ];

  if (!aDesDonnees) {
    return (
      <Vide
        icone="cloud-download-outline"
        titre={enCours ? 'Premier chargement…' : 'Pas encore de planning sur ce téléphone'}
        texte="Il faut du réseau une première fois pour récupérer ton planning et tes briefs. Ensuite, tout reste consultable sans connexion."
        action={enCours ? null : <Bouton titre="Réessayer" icone="refresh" onPress={() => void synchroniserMaintenant()} />}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 10 }}>
        <Texte v="titre">{vue === 'archives' ? 'Archives' : vue === 'calendrier' ? 'Calendrier' : 'Mon calendrier'}</Texte>
        <View style={{ flexDirection: 'row', backgroundColor: p.carte2, borderRadius: 10, padding: 3 }}>
          {onglets.map((o) => (
            <Pressable
              key={o.cle}
              onPress={() => setVue(o.cle)}
              style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', backgroundColor: vue === o.cle ? p.carte : 'transparent' }}
            >
              <Text style={{ color: vue === o.cle ? p.texte : p.texteDoux, fontWeight: vue === o.cle ? '700' : '500', fontSize: 13 }}>{o.titre}</Text>
            </Pressable>
          ))}
        </View>
        {vue === 'moi' && !admin ? (
          <Texte v="petit" doux>
            Indique tes disponibilités. Les affectations apparaissent quand la course est finalisée.
          </Texte>
        ) : null}
      </View>
      {vue === 'calendrier' ? (
        <PlanningAdmin mode="actives" />
      ) : vue === 'archives' ? (
        admin ? <PlanningAdmin mode="archives" /> : <PlanningPhotographe mode="archives" />
      ) : (
        <PlanningPhotographe mode="actives" />
      )}
    </View>
  );
}
