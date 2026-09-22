# Planning PhotoRunning

Outil de planning des photographes : les admins créent les courses, les photographes déclarent leurs disponibilités, les admins valident, puis publient en passant la course en « Fait ».

Stack : Next.js 16 (App Router), Prisma 6 + Neon (PostgreSQL), better-auth 1.6 (mots de passe bcrypt), Tailwind 4, déployé sur Vercel.

## Règles métier (v2, septembre 2026)

- **Déclaration / décision / publication.** Pour chaque créneau d'une course, une ligne `Disponibilite` porte ce que le photographe déclare (`declaration` : en attente / dispo / pas dispo) et ce que l'admin décide (`decision` : validé / référent / refusé / non pris). Tant que la course est **En cours**, le photographe ne voit que sa déclaration. Au passage en **Fait**, toutes les lignes sont tranchées et publiées : validé/référent conservés, « dispo » non retenu → refusé, « en attente » / « pas dispo » → non pris. Un photographe refusé ou non pris ne voit plus la course.
- **Jours / créneaux (`Tarif`).** Une course a un ou plusieurs créneaux tarifés (ex. Samedi, Dimanche). Chaque photographe est placé par créneau. Ajouter un créneau à une course « Fait » la repasse « En cours » : les validés restent validés (déjà publiés), le nouveau créneau est en attente pour tout le monde ; on repasse en Fait une fois le nouveau jour validé.
- **Week-end.** Un photographe validé voit « N photographes travaillent ce week-end sur M événements », calculé uniquement sur les courses en « Fait » (week-end = jeudi → lundi).
- **Admins non rémunérés** (`nonRemunere`) : comptés à 0 € dans les coûts, tarif de base affiché entre parenthèses.

Le cœur des règles est dans `lib/planning.ts` (fonctions pures testées) et `lib/data/*.ts` (accès base).

## Développement

```bash
npm install
cp .env.example .env.local      # puis renseigner DATABASE_URL, DIRECT_DATABASE_URL, BETTER_AUTH_SECRET…
npx prisma migrate deploy       # applique les migrations SQL (prisma/migrations)
npm run dev
```

- `npm run typecheck` · `npm run lint` · `npm test` (vitest ; les tests base sautent sans `DATABASE_URL`)
- Le client Prisma est généré en mode `engineType = "client"` (pas de moteur binaire) avec le driver `pg`.

## Migration depuis l'ancien Google Sheet

```bash
npm run migrate:sheets -- --dry-run   # lit le Sheet et contrôle, n'écrit rien
npm run migrate:sheets                # importe (relançable : upserts)
npm run verify:sheets                 # compare Sheet et base
```

Le script lit le Sheet via l'export CSV public (lien lisible) ou via l'API Sheets si `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` sont renseignés. Identifiants, hashs de mots de passe, courses (y compris archivées), tarifs, disponibilités et coûts mensuels sont conservés.

## Variables d'environnement (Vercel)

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Neon, URL *pooler* |
| `DIRECT_DATABASE_URL` | Neon, URL directe (migrations) |
| `BETTER_AUTH_SECRET` | secret de session (32+ caractères aléatoires) |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app (ex. `https://planning-photorunning.vercel.app`) |
| `BETTER_AUTH_TRUSTED_ORIGINS` | même URL (plusieurs séparées par des virgules) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_DRIVE_BRIEF_FOLDER_ID` | upload des briefs PDF sur Drive (inchangé) |

Le build Vercel exécute `prisma generate && prisma migrate deploy && next build`.
