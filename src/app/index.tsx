import { Redirect } from 'expo-router';
import { useEtat } from '@/lib/store';

/** Entrée : le planning si on est connecté, la connexion sinon. */
export default function Entree() {
  const connecte = useEtat((e) => !!e.utilisateur);
  return <Redirect href={connecte ? '/planning' : '/connexion'} />;
}
