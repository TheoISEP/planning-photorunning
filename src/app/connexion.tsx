import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reprendreLien } from '@/lib/liens';
import { connecter } from '@/lib/synchro';
import { rayon, usePalette } from '@/lib/theme';
import { Bandeau, Bouton, Texte } from '@/components/ui';

/**
 * Connexion avec le compte du planning (jecourse.fr) : rien à créer de plus.
 * Mot de passe oublié : il se gère sur le planning, comme aujourd'hui.
 */
export default function Connexion() {
  const p = usePalette();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const valider = async () => {
    setErreur(null);
    if (!email.trim() || !motDePasse) return setErreur('Indique ton email et ton mot de passe.');
    setEnCours(true);
    try {
      await connecter(email, motDePasse);
      const lien = reprendreLien();
      router.replace((lien ?? '/planning') as never);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setEnCours(false);
    }
  };

  const champ = {
    backgroundColor: p.carte,
    borderColor: p.bordFort,
    borderWidth: 1,
    borderRadius: rayon.moyen,
    paddingHorizontal: 14,
    height: 52,
    fontSize: 16,
    color: p.texte,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.fond }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 84, height: 84, borderRadius: 20 }} />
            <Texte v="titre">PhotoRunning Équipe</Texte>
            <Texte doux style={{ textAlign: 'center' }}>
              Ton planning, tes briefs et les contacts utiles, même sans réseau.
            </Texte>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: p.texteDoux, fontSize: 13, fontWeight: '600' }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              placeholder="prenom@exemple.fr"
              placeholderTextColor={p.texteDoux}
              style={champ}
              returnKeyType="next"
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: p.texteDoux, fontSize: 13, fontWeight: '600' }}>Mot de passe</Text>
            <TextInput
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              placeholder="Le même que sur le planning"
              placeholderTextColor={p.texteDoux}
              style={champ}
              returnKeyType="go"
              onSubmitEditing={() => void valider()}
            />
          </View>

          {erreur ? <Bandeau ton="danger" icone="alert-circle" texte={erreur} /> : null}

          <Bouton titre="Se connecter" onPress={() => void valider()} chargement={enCours} />
          <Texte v="petit" doux style={{ textAlign: 'center' }}>
            Utilise les identifiants du planning des photographes. Mot de passe oublié : demande à PhotoRunning de le réinitialiser.
          </Texte>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
