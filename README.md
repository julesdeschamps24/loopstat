# loopstat

> Ton historique d'écoute Spotify, en chiffres. Une alternative **plus légère, gratuite et sans pub** à [stats.fm](https://stats.fm) — auto-hébergeable et open.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react)](https://react.dev)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License MIT](https://img.shields.io/badge/license-MIT-green)](#licence)

---

## Sommaire

- [Aperçu](#aperçu)
- [⚠️ Lis ça d'abord : d'où viennent les données](#️-lis-ça-dabord--doù-viennent-les-données)
- [Stack technique](#stack-technique)
- [Setup](#setup)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Comment les pochettes arrivent (enrichissement Deezer)](#comment-les-pochettes-arrivent-enrichissement-deezer)
- [Import de l'historique](#import-de-lhistorique)
- [Modèle de données](#modèle-de-données)
- [Migrations](#migrations)
- [Déploiement](#déploiement)
- [Dépannage](#dépannage)
- [Licence](#licence)

---

## Aperçu

`loopstat` ingère le **dump d'historique d'écoute Spotify** d'un utilisateur (le fichier *Extended Streaming History* exporté depuis son compte) et l'expose dans une UI moderne, sobre, sans pub :

- **Top tracks / artistes / albums** sur 4 semaines, 6 mois, 1 an, lifetime.
- **Listening clock** (heatmap heure × jour de la semaine).
- **Détails par track / artiste / album** avec playcount et minutes cumulées.
- **Mode démo** : un nouvel utilisateur (avant son premier import) voit un dashboard d'exemple pré-rempli.
- **Profils publics** opt-in (`/u/<username>`) + **éditeur de cartes à partager** (`/share`) avec OG images.
- **Premium** (abonnement Stripe) : cartes sans watermark + personnalisation du profil public.

Conçu pour scaler à **≥ 10 000 utilisateurs** dès la modélisation des données (catalogue mutualisé, index sur la table de faits, partitionnement prêt).

---

## ⚠️ Lis ça d'abord : d'où viennent les données

C'est le piège n°1 quand on (re)découvre le projet. **loopstat n'appelle PAS l'API Web Spotify.** Il n'y a ni polling temps réel, ni « currently playing », ni OAuth Spotify.

| Aspect | Comment ça marche réellement |
|---|---|
| **Authentification** | **Google OAuth** via NextAuth v5. Pas de connexion Spotify. |
| **Données d'écoute** | L'utilisateur **téléverse son export Spotify** (*Extended Streaming History*, fichiers `Streaming_History_Audio_*.json`) sur `/import`. Un job worker parse ces fichiers et insère les écoutes. Voir [Import de l'historique](#import-de-lhistorique). |
| **Pochettes & images d'artistes** | Récupérées via l'**API publique Deezer** (`/search`, `/album/{id}`) par le worker, en tâche de fond. Voir [Comment les pochettes arrivent](#comment-les-pochettes-arrivent-enrichissement-deezer). |

> Le mot « Spotify » dans le code désigne presque toujours **le format du fichier d'export** (`spotify:track:<id>`, `master_metadata_*`), pas un appel réseau vers Spotify. La route `POST /api/sync` n'est plus qu'un **stub vide** conservé pour ne pas casser d'anciens clients.

**Historique des archis (pour éviter de réintroduire du code mort)** : le projet a d'abord utilisé l'API Web Spotify (live polling), puis MusicBrainz + Cover Art Archive pour les pochettes. **Les deux ont été abandonnés.** Si tu vois une référence à `spotify/client`, `musicbrainz`, `mbid`, `coverartarchive` ou `TheAudioDB`, c'est du legacy — ne le ressuscite pas, la source unique des images est Deezer.

---

## Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript | SSR + Server Actions + route handlers dans un seul projet. |
| Style | **Tailwind CSS 4** + design tokens maison | Itération rapide, dark mode natif. |
| UI Kit | shadcn/ui-style, Lucide icons, Framer Motion | Composants headless réutilisables, animations sobres. |
| Auth | **NextAuth v5** (provider **Google**, OAuth 2.0) | Pas de dépendance à un compte Spotify côté login. |
| DB | **PostgreSQL 16** (Docker en local, conteneur sur le VPS en prod) | Relationnel + agrégations + JSON natif. |
| ORM | **Drizzle** | Schéma 100 % TS, requêtes proches de SQL. |
| Jobs / queue | **BullMQ** + **Redis 7** | Import lourd de l'historique + enrichissement des métadonnées Deezer. |
| Catalogue images | **API publique Deezer** | `/search/album`, `/search/artist`, `/album/{id}` — aucune clé requise. |
| Paiements | **Stripe** (Checkout + Customer Portal + webhook) | Abonnement Premium mensuel / annuel. |
| Validation | Zod | Schémas typés bout-en-bout (UI + worker). |

---

## Setup

### Prérequis

- **Node.js ≥ 20** (testé avec Node 25)
- **pnpm** (`npm i -g pnpm` si absent)
- **Docker Desktop** (pour Postgres + Redis)
- Un projet **Google Cloud** avec des identifiants OAuth (voir ci-dessous)
- *(optionnel)* un compte **Stripe** test pour les features Premium

### Étapes

```bash
# 1. Cloner et installer
git clone <repo-url> loopstat
cd loopstat
pnpm install

# 2. Préparer .env.local — voir la section "Variables d'environnement"
cp .env.example .env.local
#   → générer AUTH_SECRET : openssl rand -base64 32
#   → GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET : voir docs/google-auth-setup.md
#   → (optionnel) clés Stripe pour tester le Premium

# 3. Démarrer Postgres + Redis (containers loopstat_postgres / loopstat_redis)
pnpm db:up

# 4. Appliquer les migrations Drizzle
pnpm db:migrate

# 5. Terminal 1 : Next.js
pnpm dev                   # http://127.0.0.1:3000

# 6. Terminal 2 : worker BullMQ (import + enrichissement Deezer)
pnpm worker
```

> ⚠️ **Toujours ouvrir l'app sur `http://127.0.0.1:3000` — pas `localhost:3000`.**
> Le redirect URI Google est figé sur `127.0.0.1`, donc le cookie de session est posé sur cet host. Un visiteur arrivant sur `localhost` ne le verrait pas. `next.config.ts` redirige `localhost:3000/*` → `127.0.0.1:3000/*` au niveau framework, mais on évite quand même le détour.

### Configuration Google OAuth

À faire **une seule fois**. La procédure complète (création du projet, écran de consentement, redirect URI) est dans **[`docs/google-auth-setup.md`](docs/google-auth-setup.md)**.

En résumé : Google Cloud Console → APIs & Credentials → OAuth 2.0 Client ID, avec le redirect URI `http://127.0.0.1:3000/api/auth/callback/google`, puis copier `Client ID` / `Client secret` dans `.env.local`.

> Tant que les creds Google ne sont pas configurés, la page `/login` affiche un guide visuel au lieu de crasher.

---

## Variables d'environnement

Toutes dans `.env.local` (gitignored). Modèle complet : [`.env.example`](.env.example).

| Clé | Exemple / format | Rôle |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | Client ID OAuth Google |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Client secret OAuth Google |
| `AUTH_SECRET` | `openssl rand -base64 32` | Secret de signature JWT NextAuth |
| `AUTH_URL` | `http://127.0.0.1:3000` | Origine canonique (sans slash final) |
| `DATABASE_URL` | `postgres://loopstat:loopstat@127.0.0.1:5432/loopstat` | Connexion Postgres (matche `docker-compose.yml`) |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Connexion Redis pour BullMQ |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Clé API Stripe (Premium) — optionnel en dev, requis en prod |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Secret de signature du webhook Stripe |
| `STRIPE_PRICE_ID_MONTHLY` | `price_...` | Prix mensuel Stripe |
| `STRIPE_PRICE_ID_YEARLY` | `price_...` | Prix annuel Stripe |

> Stripe est facultatif en local : sans clé, les routes Premium renvoient un early-return propre. En **production**, `STRIPE_SECRET_KEY` est obligatoire (l'app throw au boot sinon). Setup Dashboard détaillé : [`docs/stripe-setup.md`](docs/stripe-setup.md).
>
> L'API Deezer ne demande **aucune variable d'environnement** (API publique).

---

## Scripts

| Commande | Action |
|---|---|
| `pnpm dev` | Dev server Next.js sur `http://127.0.0.1:3000` (hôte forcé `-H 127.0.0.1`). |
| `pnpm build` | Build de production (`next build`). |
| `pnpm start` | Lance le build de production (`next start`). |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Vitest, un run unique (nécessite Postgres up — `pnpm db:up`). |
| `pnpm test:watch` | Vitest en mode watch. |
| `pnpm db:up` | `docker compose up -d` (Postgres + Redis). |
| `pnpm db:down` | Arrête les containers. |
| `pnpm db:generate` | Génère un fichier de migration SQL depuis `src/db/schema.ts`. |
| `pnpm db:migrate` | Applique les migrations versionnées de `drizzle/`. |
| `pnpm db:push` | **Dev jetable uniquement** — synchronise le schéma sans migration. Voir [Migrations](#migrations). |
| `pnpm db:studio` | Drizzle Studio (UI web pour explorer la DB). |
| `pnpm worker` | Lance le worker BullMQ (`tsx watch worker/index.ts`). |

Scripts utilitaires dans [`scripts/`](scripts/) : `seed-demo-catalog.ts` (enrichit les fixtures du mode démo via Deezer — utilisé au premier déploiement), `enqueue-enrich.ts` / `enqueue-priority.ts` (re-déclenchent manuellement l'enrichissement).

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
│  - /api/auth/[...nextauth]   (Google OAuth)│
│  - /api/import               (upload JSON) │
│  - /api/enrich-single        (cover à la demande)
│  - /api/checkout /portal /stripe/webhook   │
│  - Server components pour les pages stats  │
└────────────┬───────────────────────────────┘
             │ Drizzle ORM
┌────────────▼───────────────────────────────┐
│  PostgreSQL 16 (Docker)                    │
└────────────────────────────────────────────┘
             ▲
             │
┌────────────┴───────────────────────────────┐
│  Worker Node (BullMQ + Redis) — 4 queues    │
│  - import              (parse export → streams)
│  - enrich-catalog      (sweep Deezer + self-heal horaire)
│  - enrich-catalog-hot  (priorité après un import)
│  - enrich-catalog-single (1 item, déclenché par une page)
└────────────────────────────────────────────┘
```

### Découpage du code

```
loopstat/
├── docker-compose.yml          # Postgres 16 + Redis 7 (dev)
├── docker-compose.prod.yml     # Stack prod complète (app + worker + db + redis)
├── deploy/                     # Guide + scripts de déploiement VPS (Caddy, backup, rollback)
├── drizzle.config.ts           # Config Drizzle Kit
├── drizzle/                    # Migrations SQL versionnées
├── next.config.ts              # Redirige localhost → 127.0.0.1 (cookies OAuth)
├── scripts/                    # seed-demo-catalog, enqueue-enrich, enqueue-priority
├── src/
│   ├── app/                    # App Router — pages SSR + route handlers (/api/*)
│   ├── components/             # React UI (stats/, settings/, onboarding/, share/, ...)
│   ├── db/
│   │   ├── client.ts           # Drizzle client (postgres-js)
│   │   ├── schema.ts           # Tables + types inférés
│   │   └── queries/            # Helpers de requête (streams, stats, enrich, ...)
│   ├── lib/
│   │   ├── deezer/             # client.ts, search.ts, album.ts, catalog.ts (enrichissement)
│   │   ├── enrich/trigger.ts   # déclenche un enrich single fire-and-forget (guard Redis)
│   │   ├── ids/synthesize.ts   # IDs stables art_/alb_ (sha1 du nom)
│   │   ├── demo/               # fixtures du mode démo
│   │   ├── stripe.ts           # client Stripe + helpers billing
│   │   ├── redis.ts, log.ts, rate-limit.ts, utils.ts, ...
│   └── types/                  # Augmentations TS (NextAuth Session, ...)
└── worker/
    ├── index.ts                # Entrée : 4 Workers BullMQ + sweep au boot + scheduler self-heal
    ├── queue.ts                # Définition des 4 queues
    ├── schemas.ts              # Zod — validation des payloads worker
    └── jobs/                   # importHistory, enrichCatalog, enrichCatalogPriority, enrichCatalogSingle, enrichArtistImage
```

---

## Comment les pochettes arrivent (enrichissement Deezer)

Les tables `albums` / `artists` ont une colonne `deezer_id` (`integer`, nullable) qui pilote tout :

- **`NULL`** → jamais tenté. C'est ce que cible le sweep d'enrichissement.
- **`0` (sentinelle)** → tenté mais aucun match Deezer. Ne sera plus re-sélectionné (évite de boucler indéfiniment).
- **`> 0`** → l'ID Deezer trouvé ; `image_url` (et `release_date` pour les albums) sont renseignés.

Trois chemins, tous via `src/lib/deezer/catalog.ts` :

1. **Sweep de fond** (`enrich-catalog`) : `enrichCatalog()` sélectionne les lignes `WHERE deezer_id IS NULL` et les enrichit une par une. Un **scheduler self-heal** ré-enqueue le job toutes les heures s'il reste des covers manquantes.
2. **Priorité post-import** (`enrich-catalog-hot`) : juste après un import, on enrichit en premier les albums/artistes du top de l'utilisateur pour que son dashboard se peuple vite.
3. **À la demande** (`enrich-catalog-single`) : quand une page affiche une ligne sans `image_url`, `triggerSingleEnrich()` (guard Redis `NX` anti-thundering-herd) enqueue un enrich ciblé d'un seul item via `POST /api/enrich-single`.

> Sur un miss (artiste/album introuvable sur Deezer), l'UI tombe sur un placeholder (avatar à initiale / dégradé). Aucune autre source d'images n'est utilisée.

---

## Import de l'historique

L'utilisateur récupère son historique **depuis Spotify** (Compte → Confidentialité → *Télécharger mes données* → **Extended Streaming History**, livré par mail sous quelques jours), puis téléverse les fichiers `Streaming_History_Audio_*.json` sur la page `/import`.

Flux : `POST /api/import` valide les fichiers (`.json`, ≤ 50 Mo, ≤ 30 fichiers), les écrit dans `.import-tmp/<importId>/` (jamais via Redis), crée une ligne `imports` et enqueue le job. Le worker (`importHistory`) parse chaque entrée, **synthétise** les IDs artistes/albums (`art_`/`alb_` = sha1 du nom, idempotent entre imports), prend l'ID track depuis `spotify:track:<id>`, et insère les écoutes en batch (dédup via l'index unique `(user_id, played_at, track_id)`). Il enqueue ensuite l'enrichissement prioritaire des covers.

> Garde-fous au parse : noms tronqués à 500 chars, écoutes avant le 2008-10-07 (lancement de Spotify) ou > 24 h dans le futur rejetées comme corrompues.

---

## Modèle de données

9 tables, gérées par Drizzle ([src/db/schema.ts](src/db/schema.ts)).

| Table | Rôle | Particularité |
|---|---|---|
| `users` | Profils | `email` unique (Google), `username` opt-in pour le profil public, `profile_settings` (jsonb), 4 colonnes Stripe (`stripe_customer_id` unique, `stripe_subscription_id`, `premium_status`, `premium_until`) |
| `artists` | Catalogue artistes | **Mutualisé entre tous les users** ; `deezer_id` (index) pilote l'enrichissement |
| `albums` | Catalogue albums | idem ; `deezer_id`, `release_date`, `total_tracks` |
| `tracks` | Catalogue tracks | `album_id` (FK, `set null` à la suppression) |
| `track_artists` | Junction tracks ↔ artistes | `position` pour l'ordre des featurings |
| `album_artists` | Junction albums ↔ artistes | |
| `streams` | **Table de faits** : 1 ligne = 1 écoute | Index `(user_id, played_at DESC)` ; unique `(user_id, played_at, track_id)` pour dédup ; `source` (origine de l'import) |
| `imports` | État des imports | `status`, `files_count`, `rows_imported`, `error_message` |
| `top_cache` | Agrégats pré-calculés | Clé `(user_id, kind, period)` |

À 10 k users × ~30 streams/jour, on parle d'environ **100 M lignes/an** dans `streams` — Postgres encaisse avec les index actuels, et un partitionnement par `RANGE(played_at)` mensuel pourra être ajouté plus tard sans casser l'API.

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
# 5. Appliquer localement (et en prod, via le même script au déploiement)
pnpm db:migrate
```

### ⚠️ `pnpm db:push` est réservé au prototypage local

`drizzle-kit push` **diffe le schéma et applique les changements en direct, sans créer de fichier de migration**. Il peut `DROP` une colonne sans confirmation et désynchronise l'historique versionné. **Ne jamais le pointer sur une base de production.** Sinon, toujours `db:generate` + revue + `db:migrate`.

---

## Déploiement

Cible : `loopstat.tech` sur un VPS, derrière Caddy, le tout en Docker (`docker-compose.prod.yml`). La procédure complète (DNS, redirect URI prod Google, `.env.production`, build, Caddy, seed démo, backups, rollback) est dans **[`deploy/README.md`](deploy/README.md)**.

Env prod : voir [`.env.production.example`](.env.production.example) — Google + `AUTH_*` + `POSTGRES_PASSWORD` + clés Stripe (Deezer ne demande rien).

---

## Dépannage

### « Au login, je reviens immédiatement sur `/login` »

Tu as ouvert l'app sur `http://localhost:3000`. Le callback OAuth Google est figé sur `http://127.0.0.1:3000`, donc le cookie de session est posé sur `127.0.0.1` et **invisible** depuis `localhost`.
→ **Ouvre `http://127.0.0.1:3000`.**

### « Mon import reste à `pending` / `processing` indéfiniment »

Le worker BullMQ n'est pas lancé. Démarre-le : `pnpm worker`. Au prochain boot, le worker effectue un **sweep** : tout import bloqué au-delà du seuil (1 h en `pending`, 6 h en `processing`) repasse en `failed`, et les dossiers `.import-tmp/<id>/` orphelins sont nettoyés. Tu peux ensuite relancer un import propre.

### « `AccessDenied` juste après l'autorisation Google »

Le callback NextAuth a échoué à écrire la session — quasi toujours parce que **Postgres n'est pas joignable**. Vérifie :

```bash
pnpm db:up
docker ps          # le container loopstat_postgres doit être "Up"
```

Si Docker Desktop n'est pas démarré : `open -a Docker`, attendre la baleine verte, puis `pnpm db:up`.

### `redirect_uri_mismatch` lors du callback Google

Le redirect URI ne matche pas exactement ce qui est enregistré dans Google Cloud Console. Il doit être strictement `http://127.0.0.1:3000/api/auth/callback/google` (port 3000, `http`, `127.0.0.1`, pas de slash final). En prod, ajouter aussi `https://loopstat.tech/api/auth/callback/google`.

### Les pochettes ne s'affichent pas

L'enrichissement Deezer tourne dans le worker, en tâche de fond. Vérifie que `pnpm worker` est lancé ; le sweep + le scheduler horaire finissent par remplir les covers. Un placeholder (initiale / dégradé) s'affiche tant qu'une image manque ou si Deezer n'a pas de match (`deezer_id = 0`).

### Drizzle `Interactive prompts require a TTY terminal`

N'utilise pas `pnpm db:push` en CI ni en prod. Préférer `db:generate` + `db:migrate` (voir [Migrations](#migrations)).

---

## Licence

MIT — fais-en ce que tu veux.

---

> Construit avec ☕ par [@judescha](https://github.com/judescha) (et Claude Code).
