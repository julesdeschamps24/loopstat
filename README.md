# stat_fm

> Ton Spotify, en chiffres. Une alternative **plus légère, gratuite et sans pub** à [stats.fm](https://stats.fm) — auto-hébergeable et open.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react)](https://react.dev)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License MIT](https://img.shields.io/badge/license-MIT-green)](#licence)

---

## Sommaire

- [Aperçu](#aperçu)
- [Stack technique](#stack-technique)
- [Fonctionnalités du MVP](#fonctionnalités-du-mvp)
- [Architecture](#architecture)
- [Modèle de données](#modèle-de-données)
- [Installation & démarrage local](#installation--démarrage-local)
- [Configuration de l'app Spotify](#configuration-de-lapp-spotify)
- [Scripts disponibles](#scripts-disponibles)
- [Structure du projet](#structure-du-projet)
- [Variables d'environnement](#variables-denvironnement)
- [Workflow de développement](#workflow-de-développement)
- [Roadmap](#roadmap)
- [Dépannage](#dépannage)
- [Licence](#licence)

---

## Aperçu

`stat_fm` agrège les statistiques d'écoute Spotify d'un utilisateur et les expose dans une UI moderne, sobre, sans pub :

- **Top tracks / artistes / albums / genres** sur 4 semaines, 6 mois, 1 an, lifetime.
- **Listening clock** (heatmap heure × jour de la semaine).
- **Historique d'écoute complet** via polling régulier de l'API Spotify + import du dump *Extended Streaming History* officiel.
- **Currently playing** en temps réel.
- **Détails par track / artiste / album** avec playcount et minutes cumulées.

Conçu pour scaler à **≥ 10 000 utilisateurs** dès la modélisation des données (catalogue mutualisé, index sur la table de faits, partitionnement prêt).

---

## Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript | SSR + Server Actions + API routes dans un seul projet, bundle optimal. |
| Style | **Tailwind CSS 4** + design system maison (variables CSS, palette Spotify-green) | Rapidité d'itération, dark mode natif. |
| UI Kit | shadcn/ui-style, Lucide icons, Framer Motion | Composants headless réutilisables, animations sobres. |
| Auth | **NextAuth v5** (provider Spotify, OAuth 2.0 + PKCE) | Standard de facto, refresh tokens automatiques. |
| DB | **PostgreSQL 16** (Docker en local, Neon en prod) | Relationnel + agrégations + JSON natif + hébergement gratuit. |
| ORM | **Drizzle** | Schéma 100 % TS, requêtes proches de SQL, perf supérieure à Prisma. |
| Jobs / queue | **BullMQ** + **Redis 7** | Polling périodique, imports lourds, fiable. |
| Validation | Zod | Schémas typés bout-en-bout. |
| Crypto tokens | `node:crypto` AES-256-GCM | Chiffrement des access/refresh tokens en DB. |

---

## Fonctionnalités du MVP

### Authentification
- Login Spotify en 1 clic (OAuth 2.0 PKCE).
- Scopes : `user-read-email`, `user-read-private`, `user-read-recently-played`, `user-read-currently-playing`, `user-read-playback-state`, `user-top-read`.
- Tokens (access + refresh) chiffrés AES-256-GCM avant stockage.
- Refresh automatique transparent quand l'access token expire.

### Collecte des données
- **Polling** : `GET /me/player/recently-played` toutes les 30 minutes par utilisateur actif (limite Spotify : 50 derniers titres → polling fréquent obligatoire).
- **Import historique étendu** : upload des fichiers `Streaming_History_Audio_*.json` que Spotify envoie sur demande à l'utilisateur, parsing serveur, dédup, enrichissement métadonnées.
- **Top Read** : utilisation des endpoints `/me/top/{tracks,artists}` en complément (périodes `short_term` / `medium_term` / `long_term`).
- **Currently playing** : poll côté client (15 s) quand l'onglet est actif.

### Pages stats
- Dashboard (vue d'ensemble), Top tracks/artists/albums/genres (filtrable par période), Listening Clock, Recently Played, détail track/artist/album, Settings.

### UX / UI
- Dark mode par défaut, palette dérivée des pochettes (extraction couleurs).
- Skeleton loaders partout, animations Framer Motion, mobile-first, **PWA installable**.
- **Aucune pub, aucun tracker tiers, aucun paywall.**

---

## Architecture

```
┌────────────────────────────────────────────┐
│  Browser (Next.js client + PWA)            │
│  - shadcn/ui, Tailwind, Recharts, Framer   │
└────────────┬───────────────────────────────┘
             │ Server Actions / fetch
┌────────────▼───────────────────────────────┐
│  Next.js (App Router)                      │
│  - /api/auth/[...nextauth]  (OAuth)        │
│  - /api/sync                (poll manuel)  │
│  - /api/import              (upload JSON)  │
│  - Server components pour les pages stats  │
└────────────┬───────────────────────────────┘
             │ Drizzle ORM
┌────────────▼───────────────────────────────┐
│  PostgreSQL 16 (Docker → Neon en prod)     │
└────────────────────────────────────────────┘
             ▲
             │
┌────────────┴───────────────────────────────┐
│  Worker Node (BullMQ + Redis)              │
│  - 'poll-recent-plays'  (cron 30 min)      │
│  - 'import-history'     (queue par user)   │
│  - 'enrich-metadata'    (batch tracks)     │
└────────────────────────────────────────────┘
```

---

## Modèle de données

10 tables, gérées par Drizzle ([src/db/schema.ts](src/db/schema.ts)).

| Table | Rôle | Particularité |
|---|---|---|
| `users` | Profils utilisateurs | `spotify_id` unique, `last_synced_at` pour scheduler le polling |
| `spotify_tokens` | Access/refresh tokens chiffrés | `bytea` AES-256-GCM, 1 ligne = 1 user |
| `artists` | Catalogue artistes | **Mutualisé entre tous les users** → gros gain de stockage |
| `albums` | Catalogue albums | idem |
| `tracks` | Catalogue tracks | idem |
| `track_artists` | Junction tracks ↔ artistes | `position` pour conserver l'ordre des featurings |
| `album_artists` | Junction albums ↔ artistes | |
| `streams` | **Table de faits** : 1 ligne = 1 écoute | Index `(user_id, played_at DESC)`, unique `(user_id, played_at, track_id)` pour dédup |
| `imports` | État des imports d'historique étendu | `status`, `rows_imported`, `error_message` |
| `top_cache` | Cache d'agrégats pré-calculés | Optimisation v1.1, clé `(user_id, kind, period)` |

À 10 k users × ~30 streams/jour, on parle d'environ **100 M lignes/an** dans `streams` — Postgres encaisse facilement avec les index actuels, et un partitionnement par `RANGE(played_at)` mensuel pourra être ajouté plus tard sans casser l'API.

---

## Installation & démarrage local

### Prérequis

- **Node.js ≥ 20** (testé avec Node 25)
- **pnpm** (`npm i -g pnpm` si absent)
- **Docker Desktop** (pour Postgres + Redis)
- Un compte **Spotify** (gratuit ou premium)

### Étapes

```bash
# 1. Cloner et installer
git clone <repo-url> stat_fm
cd stat_fm
pnpm install

# 2. Démarrer Postgres + Redis
pnpm db:up                 # docker compose up -d

# 3. Préparer .env.local
cp .env.example .env.local
#   → générer AUTH_SECRET :   openssl rand -base64 32
#   → générer TOKEN_ENC_KEY : openssl rand -hex 32
#   → SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET : voir section ci-dessous

# 4. Appliquer le schéma DB
pnpm db:generate           # génère le SQL depuis schema.ts
pnpm db:migrate            # applique les migrations

# 5. Lancer le dev server
pnpm dev                   # http://127.0.0.1:3000

# (optionnel) Worker BullMQ pour le polling automatique
pnpm worker
```

> ⚠️ **Toujours utiliser `http://127.0.0.1:3000` (jamais `localhost:3000`)** pour éviter les conflits de cookies PKCE entre les deux origines, puisque Spotify n'autorise plus `localhost` dans les redirect URIs.

---

## Configuration de l'app Spotify

À faire **une seule fois**, comme stats.fm ou receiptify font côté serveur :

1. Va sur [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → connecte-toi → **Create app**.
2. Remplis :
   - **App name** : `stat_fm` (ou ce que tu veux)
   - **Redirect URIs** : `http://127.0.0.1:3000/api/auth/callback/spotify` (clic **Add** !)
   - **Which API/SDKs** : coche **Web API**
3. Coche les CGU → **Save**.
4. **Settings** → copie le `Client ID` et le `Client secret` dans `.env.local` :
   ```env
   SPOTIFY_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxx
   SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxx
   ```
5. Redémarre `pnpm dev`.

> Tant que les creds Spotify ne sont pas configurés, la page `/login` affiche automatiquement un guide visuel (au lieu de crasher).

---

## Scripts disponibles

| Commande | Action |
|---|---|
| `pnpm dev` | Dev server Next.js sur `http://127.0.0.1:3000` (Turbopack) |
| `pnpm build` | Build de production |
| `pnpm start` | Lance le build de production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:up` | `docker compose up -d` (Postgres + Redis) |
| `pnpm db:down` | Arrête les containers |
| `pnpm db:generate` | Génère les migrations SQL depuis le schéma Drizzle |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:push` | Push direct du schéma (dev seulement) |
| `pnpm db:studio` | Drizzle Studio (UI web pour explorer la DB) |
| `pnpm worker` | Lance le worker BullMQ (polling, imports) |

---

## Structure du projet

```
stat_fm/
├── docker-compose.yml          # Postgres 16 + Redis 7
├── drizzle.config.ts           # Config Drizzle Kit
├── drizzle/                    # Migrations SQL générées
├── public/                     # Assets statiques (icônes PWA, favicon)
├── src/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/route.ts   # Handler NextAuth
│   │   ├── login/page.tsx                    # Page de login + guide setup
│   │   ├── dashboard/page.tsx                # Dashboard auth-gated
│   │   ├── layout.tsx                        # Root layout + ThemeProvider
│   │   ├── page.tsx                          # Landing
│   │   └── globals.css                       # Tailwind + design tokens
│   ├── auth.ts                               # Config NextAuth (provider Spotify, callbacks)
│   ├── components/theme-provider.tsx         # next-themes wrapper
│   ├── db/
│   │   ├── client.ts                         # Drizzle client (postgres-js)
│   │   ├── schema.ts                         # Tables (10) + types inférés
│   │   └── queries/
│   │       └── streams.ts                    # Insert batché des streams
│   ├── lib/
│   │   ├── crypto.ts                         # AES-256-GCM (encrypt/decrypt tokens)
│   │   ├── utils.ts                          # cn(), formatMs(), formatNumber()
│   │   └── spotify/
│   │       ├── client.ts                     # spotifyFetch() avec refresh auto
│   │       ├── catalog.ts                    # upsert tracks/artists/albums
│   │       ├── scopes.ts                     # Liste des scopes OAuth
│   │       └── types.ts                      # Types API Spotify
│   └── types/next-auth.d.ts                  # Augmentation Session.user
└── worker/                     # (à venir Phase 3) Worker BullMQ
```

---

## Variables d'environnement

Toutes dans `.env.local` (gitignored).

| Clé | Exemple / format | Rôle |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | `0123456789abcdef...` | Client ID de l'app Spotify Developer |
| `SPOTIFY_CLIENT_SECRET` | `0123456789abcdef...` | Client secret idem |
| `AUTH_SECRET` | `openssl rand -base64 32` | Secret de signature JWT NextAuth |
| `AUTH_URL` | `http://127.0.0.1:3000` | Origine canonique de l'app (sans slash final) |
| `DATABASE_URL` | `postgres://stat_fm:stat_fm@127.0.0.1:5432/stat_fm` | Connexion Postgres (matche `docker-compose.yml`) |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Connexion Redis pour BullMQ |
| `TOKEN_ENC_KEY` | `openssl rand -hex 32` (64 chars hex) | Clé AES-256 pour chiffrer les tokens Spotify en DB |

---

## Workflow de développement

### Modifier le schéma DB

```bash
# 1. Édite src/db/schema.ts
# 2. Génère la migration SQL
pnpm db:generate
# 3. Inspecte le fichier généré dans drizzle/
# 4. Applique
pnpm db:migrate
```

### Inspecter la base

```bash
pnpm db:studio
# Ouvre https://local.drizzle.studio
```

### Vérifier que tout compile

```bash
pnpm lint && pnpm typecheck
```

### Tester le login Spotify

1. Démarrer la stack : `pnpm db:up && pnpm dev`
2. Ouvrir http://127.0.0.1:3000/login en **navigation privée**
3. Cliquer « Se connecter avec Spotify »
4. Autoriser → tu dois atterrir sur `/dashboard` avec ton avatar et ton nom

---

## Roadmap

État actuel et phases à venir (plan complet : `~/.claude/plans/j-aimerai-faire-une-copie-memoized-wave.md`).

| Phase | Description | Statut |
|---|---|---|
| 0 | Bootstrap (Next.js, Docker, Drizzle, theme) | ✅ Livré |
| 1 | Auth Spotify (OAuth, tokens chiffrés) | 🚧 En cours (debug `invalid_grant`) |
| 2 | Schéma DB & helpers d'upsert catalog | ✅ Livré |
| 3 | Worker BullMQ — polling Recently Played | ⏳ À venir |
| 4 | Import Extended Streaming History | ⏳ |
| 5 | Pages stats (dashboard, tops, listening clock) | ⏳ |
| 6 | Polish UX/UI (skeletons, animations, PWA) | ⏳ |
| 7 | Hardening (rate limit, logs, tests) | ⏳ |

### Post-MVP (hors scope V1)

- Déploiement Vercel + Neon + Upstash (free tier).
- Profil public partageable (`/u/[username]`).
- Système d'amis et comparaisons.
- Notifications (nouveau record perso, sortie album d'un artiste suivi).
- App mobile React Native.

---

## Dépannage

### `Error: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET`
Tu n'as pas (encore) renseigné les creds dans `.env.local`. La page `/login` t'affiche désormais un guide visuel à la place du crash. Voir [Configuration de l'app Spotify](#configuration-de-lapp-spotify).

### `InvalidCheck: pkceCodeVerifier value could not be parsed`
Tu as ouvert l'app sur `localhost:3000` au lieu de `127.0.0.1:3000`. Les cookies de PKCE sont posés sur un domaine et lus sur l'autre → mismatch. **Toujours utiliser `127.0.0.1`.**

### `invalid_grant: Invalid redirect URI` lors du callback
Le `redirect_uri` envoyé au step 4 (token exchange) ne matche pas exactement ce qui est en base chez Spotify. Vérifier :
1. L'URI dashboard est strictement `http://127.0.0.1:3000/api/auth/callback/spotify` (pas de slash final, port 3000, http, `127.0.0.1`).
2. La config `authorization` dans [src/auth.ts](src/auth.ts) est en **forme objet** (`{ url, params }`), pas en string.
3. Si toujours bloqué : `debug: true` est activé temporairement → les logs `[auth-debug]` montrent le `redirect_uri` envoyé. Comparer avec le dashboard.

### `Cannot connect to the Docker daemon`
Docker Desktop n'est pas démarré. `open -a Docker` puis attendre que la baleine soit verte.

### Drizzle `Interactive prompts require a TTY terminal`
N'utilise pas `pnpm db:push` en CI. Préférer le flow `db:generate` + `db:migrate`.

---

## Licence

MIT — fais-en ce que tu veux.

---

> Construit avec ☕ par [@judescha](https://github.com/judescha) (et Claude Code).
