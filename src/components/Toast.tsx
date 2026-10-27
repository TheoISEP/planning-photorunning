import { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Petit message passager (« Numéro copié »), sans fenêtre native. */

let afficher: ((texte: string) => void) | null = null;

export function toast(texte: string) {
  afficher?.(texte);
}

export function ZoneToast() {
  const insets = useSafeAreaInsets();
  const [texte, setTexte] = useState<string | null>(null);
  const [opacite] = useState(() => new Animated.Value(0));
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    afficher = (t: string) => {
      setTexte(t);
      if (minuteur.current) clearTimeout(minuteur.current);
      Animated.timing(opacite, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      minuteur.current = setTimeout(() => {
        Animated.timing(opacite, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setTexte(null));
      }, 2200);
    };
    return () => {
      afficher = null;
    };
  }, [opacite]);

  if (!texte) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: insets.bottom + 80,
        opacity: opacite,
        backgroundColor: 'rgba(17,24,39,0.94)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{texte}</Text>
    </Animated.View>
  );
}
