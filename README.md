# loopstat

> Ton Spotify, en chiffres. Une alternative **plus légère, gratuite et sans pub** à [stats.fm](https://stats.fm) — auto-hébergeable et open.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react)](https://react.dev)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License MIT](https://img.shields.io/badge/license-MIT-green)](#licence)

---

## Sommaire

- [Aperçu](#aperçu)
- [Stack technique](#stack-technique)
- [Setup](#setup)
- [Configuration de l'app Spotify](#configuration-de-lapp-spotify)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Modèle de données](#modèle-de-données)
- [Migrations](#migrations)
- [Contraintes Spotify Development Mode](#contraintes-spotify-development-mode)
- [Dépannage](#dépannage)
- [Licence](#licence)

---

## Aperçu

`loopstat` agrège les statistiques d'écoute Spotify d'un utilisateur et les expose dans une UI moderne, sobre, sans pub :

- **Top tracks / artistes / albums** sur 4 semaines, 6 mois, 1 an, lifetime.
- **Listening clock** (heatmap heure × jour de la semaine).
- **Historique d'écoute complet** via polling régulier de l'API Spotify + import du dump *Extended Streaming History* officiel.
- **Currently playing** en temps réel.
- **Détails par track / artiste / album** avec playcount et minutes cumulées.

Conçu pour scaler à **≥ 10 000 utilisateurs** dès la modélisation des données (catalogue mutualisé, index sur la table de faits, partitionnement prêt).

---

## Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript | SSR + Server Actions + route handlers dans un seul projet, bundle optimal. |
| Style | **Tailwind CSS 4** + design tokens maison | Itération rapide, dark mode natif. |
| UI Kit | shadcn/ui-style, Lucide icons, Framer Motion | Composants headless réutilisables, animations sobres. |
| Auth | **NextAuth v5** (provider Spotify, OAuth 2.0 + PKCE) | Standard de facto, refresh tokens automatiques. |
| DB | **PostgreSQL 16** (Docker en local, Neon en prod) | Relationnel + agrégations + JSON natif + hébergement gratuit. |
| ORM | **Drizzle** | Schéma 100 % TS, requêtes proches de SQL. |
| Jobs / queue | **BullMQ** + **Redis 7** | Polling périodique, imports lourds, enrichissement métadonnées. |
| Validation | Zod | Schémas typés bout-en-bout (UI + worker). |
| Crypto tokens | `node:crypto` AES-256-GCM | Chiffrement des access/refresh tokens en DB. |

---

## Setup

### Prérequis

- **Node.js ≥ 20** (testé avec Node 25)
- **pnpm** (`npm i -g pnpm` si absent)
- **Docker Desktop** (pour Postgres + Redis)
- Un compte **Spotify** (gratuit ou premium)

### Étapes

```bash
# 1. Cloner et installer
git clone <repo-url> loopstat
cd loopstat
pnpm install

# 2. Préparer .env.local — voir la section ci-dessous pour chaque variable
cp .env.example .env.local
#   → générer AUTH_SECRET    : openssl rand -base64 32
#   → générer TOKEN_ENC_KEY  : openssl rand -hex 32
#   → SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET : voir "Configuration de l'app Spotify"

# 3. Démarrer Postgres + Redis (containers loopstat_postgres / loopstat_redis)
pnpm db:up

# 4. Appliquer les migrations Drizzle
pnpm db:migrate

# 5. Dans un premier terminal : Next.js
pnpm dev                   # http://127.0.0.1:3000

# 6. Dans un second terminal : worker BullMQ (polling, imports, enrichissement)
pnpm worker
```

> ⚠️ **Toujours ouvrir l'app sur `http://127.0.0.1:3000` — pas `localhost:3000`.**
> Spotify n'accepte plus `localhost` dans les redirect URIs, donc le cookie de session est posé sur `127.0.0.1`. Un visiteur arrivant sur `localhost` ne le verrait pas et serait renvoyé sur `/login`. `next.config.ts` redirige `localhost:3000/*` → `127.0.0.1:3000/*` au niveau framework, mais on évite quand même le détour.

---

## Configuration de l'app Spotify

À faire **une seule fois** :

1. Va sur [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → connecte-toi → **Create app**.
2. Remplis :
   - **App name** : `loopstat` (ou ce que tu veux)
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

L'app reste en **Spotify Development Mode** par défaut — lire la section [Contraintes Spotify Development Mode](#contraintes-spotify-development-mode) pour les conséquences.

---

## Variables d'environnement

Toutes dans `.env.local` (gitignored). Modèle complet : [`.env.example`](.env.example).

| Clé | Exemple / format | Rôle |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | `0123456789abcdef...` | Client ID de l'app Spotify Developer |
| `SPOTIFY_CLIENT_SECRET` | `0123456789abcdef...` | Client secret idem |
| `AUTH_SECRET` | `openssl rand -base64 32` | Secret de signature JWT NextAuth |
| `AUTH_URL` | `http://127.0.0.1:3000` | Origine canonique de l'app (sans slash final) |
| `DATABASE_URL` | `postgres://loopstat:loopstat@127.0.0.1:5432/loopstat` | Connexion Postgres (matche `docker-compose.yml`) |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Connexion Redis pour BullMQ |
| `TOKEN_ENC_KEY` | `openssl rand -hex 32` (64 chars hex) | Clé AES-256 pour chiffrer les tokens Spotify en DB |
| `NODE_ENV` | `development` / `production` | Standard Node — fixé par les scripts `next dev` / `next start`. |

---

## Scripts

| Commande | Action |
|---|---|
| `pnpm dev` | Dev server Next.js sur `http://127.0.0.1:3000` (Turbopack, hôte forcé). |
| `pnpm build` | Build de production (`next build`). |
| `pnpm start` | Lance le build de production (`next start`). |
| `pnpm lint` | ESLint (`eslint`). |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Vitest, un run unique. |
| `pnpm test:watch` | Vitest en mode watch. |
| `pnpm db:up` | `docker compose up -d` (Postgres + Redis). |
| `pnpm db:down` | Arrête les containers. |
| `pnpm db:generate` | Génère un fichier de migration SQL depuis `src/db/schema.ts`. |
| `pnpm db:migrate` | Applique les migrations versionnées de `drizzle/`. |
| `pnpm db:push` | **Dev uniquement** — synchronise le schéma sans passer par un fichier de migration. Voir [Migrations](#migrations). |
| `pnpm db:studio` | Drizzle Studio (UI web pour explorer la DB). |
| `pnpm worker` | Lance le worker BullMQ (polling, imports, enrichissement métadonnées). |

---

## Architecture

```
┌────────────────────────────────────────────┐
│  Browser (Next.js client + PWA)            │
│  - shadcn/ui, Tailwind, Recharts, Framer   │
└────────────┬───────────────────────────────┘
             │ Server Actions / fetch
┌────────────▼───────────────────────────────┐
│  Next.js 16 (App Router)                   │
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
│  - poll-recent      (cron 30 min)          │
│  - import-history   (par user)             │
│  - enrich-metadata  (un track à la fois)   │
└────────────────────────────────────────────┘
```

### Découpage du code

```
loopstat/
├── docker-compose.yml          # Postgres 16 + Redis 7 (loopstat_postgres / loopstat_redis)
├── drizzle.config.ts           # Config Drizzle Kit
├── drizzle/                    # Migrations SQL versionnées
├── public/                     # Assets statiques (icônes PWA, favicon)
├── next.config.ts              # Redirige localhost → 127.0.0.1 (cookies OAuth)
├── src/
│   ├── app/                    # Next.js 16 App Router — pages SSR + route handlers
│   ├── components/             # React UI (stats/, settings/, theme, ui/, ...)
│   ├── db/
│   │   ├── client.ts           # Drizzle client (postgres-js)
│   │   ├── schema.ts           # Tables + types inférés
│   │   └── queries/            # Helpers de requête (streams, ...)
│   ├── lib/                    # Modules purs
│   │   ├── crypto.ts           # AES-256-GCM (encrypt/decrypt tokens)
│   │   ├── log.ts              # Logger structuré JSON
│   │   ├── rate-limit.ts       # Rate limiter in-memory
│   │   ├── utils.ts            # cn(), formatMs(), formatNumber()
│   │   └── spotify/
│   │       ├── client.ts       # spotifyFetch() + refresh auto
│   │       ├── catalog.ts      # upsert tracks/artists/albums
│   │       ├── top.ts          # helpers /me/top
│   │       ├── scopes.ts       # Scopes OAuth
│   │       └── types.ts        # Types API Spotify
│   └── types/                  # Augmentations TS (NextAuth Session, ...)
└── worker/
    ├── index.ts                # Entrée du worker
    ├── queue.ts                # Définition des queues BullMQ
    ├── schemas.ts              # Zod — validation des payloads worker
    └── jobs/                   # poll-recent, import-history, enrich-metadata
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
| `top_cache` | Cache d'agrégats pré-calculés | Clé `(user_id, kind, period)` |

À 10 k users × ~30 streams/jour, on parle d'environ **100 M lignes/an** dans `streams` — Postgres encaisse facilement avec les index actuels, et un partitionnement par `RANGE(played_at)` mensuel pourra être ajouté plus tard sans casser l'API.

---

## Migrations

Le projet suit un flow **fichiers SQL versionnés et committés** :

```bash
# 1. Modifier le schéma dans src/db/schema.ts
# 2. Générer la migration SQL
pnpm db:generate           # crée drizzle/NNNN_<slug>.sql
# 3. RELIRE le SQL généré (DROP COLUMN, NOT NULL inattendu, etc.)
# 4. Commiter le fichier de migration avec le changement de schéma
git add drizzle/ src/db/schema.ts
# 5. Appliquer localement (et en production, via le même script en deploy)
pnpm db:migrate
```

### ⚠️ `pnpm db:push` est réservé au prototypage local

`drizzle-kit push` **diffe le schéma et applique les changements en direct, sans créer de fichier de migration**. Il peut `DROP` une colonne sans confirmation et désynchronise complètement l'historique versionné de la prod. **Ne jamais le pointer sur une base de production.**

Utilisations légitimes :
- prototyper rapidement sur une DB locale jetable,
- inspecter le diff avant de générer la vraie migration.

Sinon, toujours `db:generate` + revue + `db:migrate`.

---

## Contraintes Spotify Development Mode

L'app tourne par défaut en **Spotify Development Mode** (statut accordé à toute nouvelle app du Developer Dashboard). Depuis février 2026, Spotify a **fortement réduit ce que ce mode renvoie sur certains endpoints** — il faut composer avec.

### Champs retirés ou indisponibles

- **`/me/top/artists` et `/artists/{id}` ne renvoient plus `genres`.**
  → la page `/top/genres` a donc été retirée du produit. Les agrégats de genres ne sont plus calculables tant que la quota mode reste en Development.
- **`tracks` et `artists` arrivent fréquemment sans `popularity`, `external_ids` (notamment `isrc`), ni `followers`.**
  → l'enrichissement métadonnées doit tolérer ces champs absents (champs `null` dans `tracks` / `artists` plutôt qu'un crash).
- **`GET /tracks?ids=...` (batch) renvoie 403 en Development Mode.**
  → le job `enrich-metadata` du worker récupère donc les tracks **un par un** via `GET /tracks/{id}`. C'est plus lent mais c'est la seule voie qui passe.

### Contournement

Demander à Spotify de basculer l'app en **Extended Quota Mode** une fois qu'elle a de vrais utilisateurs (formulaire dans le Developer Dashboard). Tant que ce n'est pas accordé, vivre avec.

---

## Dépannage

### « Au login, je reviens immédiatement sur `/login` »

Tu as ouvert l'app sur `http://localhost:3000`. Le callback OAuth Spotify est figé sur `http://127.0.0.1:3000` (Spotify n'autorise plus `localhost` dans les redirect URIs), donc le cookie de session est posé sur `127.0.0.1` et **invisible** depuis `localhost`. `next.config.ts` redirige `localhost:3000/*` → `127.0.0.1:3000/*` au niveau framework, mais il faut faire la requête initiale sur le bon host pour fluidifier.
→ **Ouvre `http://127.0.0.1:3000`.**

### « Mon import reste à `pending` indéfiniment »

Le worker BullMQ n'est pas lancé. Démarre-le :

```bash
pnpm worker
```

Au prochain démarrage, le worker effectue un **sweep** : tout import resté à `pending` ou `running` au-delà du seuil est repassé en `failed` (Phase 7, Task 9). Tu peux ensuite relancer un import propre.

### « `AccessDenied` juste après l'autorisation Spotify »

Le callback NextAuth a échoué à écrire la session — quasi toujours parce que **Postgres n'est pas joignable**. Vérifie :

```bash
pnpm db:up
docker ps          # le container loopstat_postgres doit être "Up"
```

Si Docker Desktop n'est pas démarré : `open -a Docker`, attendre la baleine verte, puis `pnpm db:up`.

### `Error: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET`

Pas (encore) renseigné les creds dans `.env.local`. La page `/login` affiche désormais un guide visuel à la place du crash. Voir [Configuration de l'app Spotify](#configuration-de-lapp-spotify).

### `invalid_grant: Invalid redirect URI` lors du callback

Le `redirect_uri` envoyé au token exchange ne matche pas exactement ce qui est enregistré chez Spotify. Vérifier que l'URI dashboard est strictement `http://127.0.0.1:3000/api/auth/callback/spotify` (pas de slash final, port 3000, `http`, `127.0.0.1`).

### Drizzle `Interactive prompts require a TTY terminal`

N'utilise pas `pnpm db:push` en CI ni en prod. Préférer le flow `db:generate` + `db:migrate` (voir [Migrations](#migrations)).

---

## Licence

MIT — fais-en ce que tu veux.

---

> Construit avec ☕ par [@judescha](https://github.com/judescha) (et Claude Code).
