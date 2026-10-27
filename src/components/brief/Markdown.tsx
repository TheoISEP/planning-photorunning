import * as Linking from 'expo-linking';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { blocs, morceauxEnLigne } from '@/lib/markdown';
import { usePalette } from '@/lib/theme';

/**
 * Le Markdown des briefs (résumé, texte libre), rendu sans dépendance :
 * titres, paragraphes, listes, gras, italique, liens, citations. Le HTML brut
 * éventuel est retiré (balises), son texte gardé.
 */

function EnLigne({ texte, taille = 15 }: { texte: string; taille?: number }) {
  const p = usePalette();
  return (
    <Text style={{ color: p.texte, fontSize: taille, lineHeight: taille * 1.45 }}>
      {morceauxEnLigne(texte).map((m, i) => (
        <Text
          key={i}
          onPress={m.lien ? () => void Linking.openURL(m.lien!) : undefined}
          style={{
            fontWeight: m.gras ? '700' : undefined,
            fontStyle: m.italique ? 'italic' : undefined,
            color: m.lien ? p.lien : undefined,
            textDecorationLine: m.lien ? 'underline' : undefined,
            fontFamily: m.code ? 'Courier' : undefined,
          }}
        >
          {m.texte}
        </Text>
      ))}
    </Text>
  );
}

export function Markdown({ source }: { source: string }) {
  const p = usePalette();
  const contenu: ReactNode[] = blocs(source).map((b, i) => {
    switch (b.type) {
      case 'titre':
        return <EnLigne key={i} texte={b.texte} taille={b.niveau <= 2 ? 19 : 16} />;
      case 'paragraphe':
        return <EnLigne key={i} texte={b.texte} />;
      case 'citation':
        return (
          <View key={i} style={{ borderLeftWidth: 3, borderColor: p.bordFort, paddingLeft: 10 }}>
            <EnLigne texte={b.texte} />
          </View>
        );
      case 'separateur':
        return <View key={i} style={{ height: 1, backgroundColor: p.bord, marginVertical: 4 }} />;
      case 'liste':
        return (
          <View key={i} style={{ gap: 4 }}>
            {b.items.map((it, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ color: p.texteDoux, fontSize: 15, lineHeight: 21, minWidth: 16 }}>{b.ordonnee ? `${j + 1}.` : '•'}</Text>
                <View style={{ flex: 1 }}>
                  <EnLigne texte={it} />
                </View>
              </View>
            ))}
          </View>
        );
    }
  });
  return <View style={{ gap: 10 }}>{contenu}</View>;
}
