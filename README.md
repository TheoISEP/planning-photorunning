# PhotoRunning Équipe

L'app iPhone et Android de l'équipe PhotoRunning (photographes et admins).

- **Planning** : le même que sur jecourse.fr (cartes par mois, week-ends, montants), consultable sans réseau. Les disponibilités se changent même hors ligne et partent au retour du réseau.
- **Briefs** : chaque brief complet (textes, plans, positions, billets PDF, traces GPX) gardé sur le téléphone. Un lien de partage `https://briefs-photorunning.vercel.app/share/…` ouvre le brief dans l'app.
- **Contacts PhotoRunning** : les fiches de l'annuaire cochées « Visible des photographes ».
- **Annuaire** (admins) : tout l'annuaire, chiffré sur le téléphone, ouvert par Face ID, avec le compte de l'annuaire.
- **Mises à jour** : corrections à chaud (EAS Update) et versions des stores pilotées depuis l'admin du planning, page « App mobile » (bandeau ou écran bloquant).

Aucun compte en plus : on se connecte avec les identifiants du planning.

## Comment c'est branché

```
Téléphone ──► planning (jecourse.fr)  /api/mobile/*      jeton d'appareil (Bearer prm_…)
                 ├──► app des briefs  /api/integration/mobile          (clé PLANNING_INTEGRATION_KEY)
                 └──► admin           /api/integration/annuaire/equipe (clé ADMIN_INTEGRATION_KEY)
Téléphone ──► admin  /api/annuaire/mobile/*   (admins, compte de l'annuaire, Bearer)
```

Le téléphone n'a jamais les clés de liaison. Le planning décide qui voit quoi : un photographe voit les briefs des courses où il est retenu (décision publiée), et ceux qu'on lui envoie par lien ; jamais les coûts des courses. Aucun rapprochement par le nom (un photographe peut changer le sien dans son profil).

## Développer

```bash
npm install
npm run typecheck && npm run lint && npm test
npx expo start            # avec un « development build » installé sur le téléphone
```

L'app utilise des modules natifs (Face ID, trousseau, fichiers) : Expo Go ne suffit pas, il faut un development build (`npx eas-cli@latest build --profile development --platform ios`).

Adresses des serveurs : `EXPO_PUBLIC_PLANNING_URL` et `EXPO_PUBLIC_ADMIN_URL` (par défaut `https://www.jecourse.fr` et `https://www.adminphotorunning.fr`).

## Publier

Tout se fait dans le cloud d'Expo (EAS), sans Xcode ni Android Studio :

```bash
npx eas-cli@latest build --profile production --platform all     # nouvelle version store
npx eas-cli@latest submit --profile production --platform all    # envoi aux stores
npx eas-cli@latest update --channel production --message "…"     # correction à chaud
```

Une correction à chaud ne passe que si la version des stores ne change pas (`runtimeVersion` = version de l'app). Dès qu'on ajoute un module natif ou qu'on change `app.json`, il faut une nouvelle version store : monter `version` dans `app.json`, builder, soumettre, puis régler la version dans « App mobile ».

Le guide pas à pas (comptes Apple et Google, D-U-N-S, fiches des stores, diffusion discrète) est dans le doc projet `claude/app-mobile-equipe.md`.

## Code

```
src/app/                 écrans (expo-router)
  (onglets)/             Planning, Briefs, Contacts, Annuaire, Réglages
  course/[id]            fiche d'une course
  brief/[id]             un brief
  share/[token]          lien de partage d'un brief ouvert dans l'app
  photographer/planning/[id]  lien du planning web ouvert dans l'app
  annuaire/…             fiches de l'annuaire
src/lib/
  synchro.ts             synchro, file des changements hors ligne, briefs et fichiers
  annuaire.ts            annuaire chiffré (XChaCha20-Poly1305, clé dans le trousseau), Face ID
  planning.ts            règles du planning, identiques au site (testées)
  stockage.ts            dossier hors ligne de l'app
  api.ts, store.ts, theme.ts, versions.ts, trace.ts, markdown.ts, octets.ts
src/components/          planning, brief, contacts, briques d'interface
tests/                   tests des règles (node --test)
```
