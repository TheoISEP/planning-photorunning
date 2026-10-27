import { Redirect, useLocalSearchParams } from 'expo-router';
import { memoriserLien } from '@/lib/liens';
import { useEtat } from '@/lib/store';

/** Lien vers une course du planning web (jecourse.fr/photographer/planning/<id>) : même course dans l'app. */
export default function LienCourse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const connecte = useEtat((e) => !!e.utilisateur);
  if (!connecte) {
    memoriserLien(`/course/${id}`);
    return <Redirect href="/connexion" />;
  }
  return <Redirect href={`/course/${id}`} />;
}
