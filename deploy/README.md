# Déploiement loopstat → VPS Hetzner

> Cible : `loopstat.tech` derrière Caddy sur le VPS `204.168.178.52` (Ubuntu).
> Stack : Next.js 16 + BullMQ worker + Postgres 16 + Redis 7, le tout dans Docker.

## Prérequis (à faire avant le déploiement)

1. **DNS** : ajoute un enregistrement A à ton registrar
   ```
   loopstat.tech.   A   204.168.178.52
   ```
   Vérifie la propagation : `dig +short loopstat.tech A` doit renvoyer `204.168.178.52`.
2. **Google Cloud Console** ([console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)) :
   ouvre ton projet OAuth, ajoute le redirect URI prod aux **Authorized redirect URIs** :
   ```
   https://loopstat.tech/api/auth/callback/google
   ```
   (Garde celui de dev `http://127.0.0.1:3000/api/auth/callback/google` à côté.)
   Si l'app est encore en "Testing" status, ajoute aussi ton email dans **Test users**.
3. **`.env.production`** : copie `.env.production.example` en `.env.production` et remplis
   les valeurs (jamais commit). Génère les secrets manquants :
   ```sh
   openssl rand -base64 32   # AUTH_SECRET
   openssl rand -hex 24      # POSTGRES_PASSWORD
   openssl rand -hex 32      # TOKEN_ENC_KEY (32 bytes pour AES-256-GCM)
   ```

## Déploiement initial

Toutes les commandes sont à lancer depuis le repo local (les `ssh ... 'commande'`
s'exécutent sur le VPS).

### 1. Pousser le code sur le VPS

```sh
ssh root@204.168.178.52 'mkdir -p /opt/loopstat'
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude .import-tmp --exclude .claude --exclude .agents \
  --exclude '.env*' \
  ./ root@204.168.178.52:/opt/loopstat/
```

### 2. Copier le `.env.production` (en évitant `rsync` global qui exclut les `.env*`)

```sh
scp .env.production root@204.168.178.52:/opt/loopstat/.env.production
```

### 3. Construire et lancer la stack

```sh
ssh root@204.168.178.52 'cd /opt/loopstat && \
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build'
```

Premier lancement : build de l'image (~2-3 min), pull des images Postgres/Redis,
puis `drizzle-kit migrate` crée le schéma, puis l'app démarre.

### 4. Vérifier que ça tourne

```sh
ssh root@204.168.178.52 'cd /opt/loopstat && docker compose -f docker-compose.prod.yml ps'
# Toutes les lignes doivent être "running" / "healthy"

ssh root@204.168.178.52 'curl -sI http://127.0.0.1:3001 | head -2'
# HTTP/1.1 307 (redirect vers /login = normal)
```

### 5. Ajouter le bloc Caddy

```sh
scp deploy/Caddyfile.snippet root@204.168.178.52:/tmp/loopstat-caddy
ssh root@204.168.178.52 'cat /tmp/loopstat-caddy >> /etc/caddy/Caddyfile && \
  caddy fmt --overwrite /etc/caddy/Caddyfile && \
  caddy validate --config /etc/caddy/Caddyfile && \
  systemctl reload caddy'
```

Caddy obtient le cert Let's Encrypt automatiquement (besoin que le DNS soit
déjà propagé). Vérifie :

```sh
curl -sI https://loopstat.tech | head -3
# HTTP/2 307 — redirect vers /login = prod opérationnelle
```

### 6. Tester le flow OAuth complet

Ouvre `https://loopstat.tech/login` dans un navigateur, clique « Se connecter
avec Google », autorise. Tu dois atterrir sur `/dashboard`.

### 7. (Premier déploiement uniquement) Seeder le catalog démo

Le mode démo (nouveaux users avant import) affiche les top tracks/artistes
populaires avec vraies covers. Le catalog en prod est vide au premier deploy
donc il faut le seeder avec les ~15 albums + 15 artistes + 30 tracks démo.

```sh
ssh root@204.168.178.52 'cd /opt/loopstat && \
  docker compose -f docker-compose.prod.yml exec app \
  pnpm exec dotenv -e .env.production -- tsx scripts/seed-demo-catalog.ts'
```

Durée : ~2 min (~15 albums × 1.1s MBz + ~15 artistes × 2.2s MBz+TADB).
Idempotent : ré-exécutable sans danger, skip ce qui est déjà enrichi.

À relancer si :
- La DB Postgres est wipée / restaurée d'un backup ancien.
- On ajoute de nouvelles fixtures à `src/lib/demo/data.ts` (le script enrichit
  seulement les nouvelles entrées au re-run).

## Mises à jour ultérieures

Après un push local :

```sh
rsync -az --delete --exclude node_modules --exclude .next --exclude .git \
  --exclude .import-tmp --exclude '.env*' \
  ./ root@204.168.178.52:/opt/loopstat/

ssh root@204.168.178.52 'cd /opt/loopstat && \
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build'
```

`drizzle-kit migrate` se rejoue automatiquement à chaque démarrage de l'app
(idempotent si pas de nouvelle migration).

## Logs et debug

```sh
# Tail temps réel
ssh root@204.168.178.52 'cd /opt/loopstat && docker compose -f docker-compose.prod.yml logs -f --tail=100'

# Juste l'app
ssh root@204.168.178.52 'docker logs -f --tail=100 loopstat_app'

# Juste le worker
ssh root@204.168.178.52 'docker logs -f --tail=100 loopstat_worker'

# Logs Caddy (le reverse proxy)
ssh root@204.168.178.52 'journalctl -u caddy -n 100 --no-pager'
```

## Rollback

Use `deploy/rollback.sh` from your local repo. It reverts the VPS to any
previous git ref (commit SHA, tag, or `HEAD~N`).

```sh
./deploy/rollback.sh HEAD~1        # previous commit
./deploy/rollback.sh 4ccbb85       # specific SHA
```

The script asks for confirmation, syncs the chosen ref, rebuilds the
stack, then smoke-tests `/api/health`. Volumes `postgres_data` and
`redis_data` are NOT touched.

To stop everything (preserves data):

```sh
ssh root@204.168.178.52 'cd /opt/loopstat && \
  docker compose -f docker-compose.prod.yml down'
```

DESTRUCTIVE — wipe the DB too:

```sh
ssh root@204.168.178.52 'cd /opt/loopstat && \
  docker compose -f docker-compose.prod.yml down -v'
```

## Sauvegardes Postgres

Daily backup script : `deploy/backup-postgres.sh`. Installation on the
VPS, as root :

```sh
scp deploy/backup-postgres.sh root@204.168.178.52:/opt/loopstat/deploy/
ssh root@204.168.178.52 'chmod +x /opt/loopstat/deploy/backup-postgres.sh && \
  echo "17 3 * * * /opt/loopstat/deploy/backup-postgres.sh >> /var/log/loopstat-backup.log 2>&1" \
  | crontab -'
```

Backups land in `/var/backups/loopstat/loopstat-<timestamp>.sql.gz`,
retention 7 days. For off-VPS copy (recommended), set `RSYNC_DEST` in
the cron entry:

```cron
17 3 * * * RSYNC_DEST="user@your-host:/backups/loopstat/" /opt/loopstat/deploy/backup-postgres.sh ...
```

Restore from a backup:

```sh
gunzip < /var/backups/loopstat/loopstat-20260601-031700.sql.gz | \
  docker exec -i loopstat_postgres psql -U loopstat -d loopstat
```

## Healthcheck

The Dockerfile declares a `HEALTHCHECK` that polls `/api/health` every
30 s. The endpoint pings Postgres + Redis; returns 200 only if both
respond. Docker restarts the container after 3 consecutive failures.

Inspect from the VPS:

```sh
docker inspect --format='{{.State.Health.Status}}' loopstat_app
```

## Sécurité — points d'attention

- **Postgres et Redis ne sont pas exposés** publiquement (pas de `ports:` mappés
  vers l'hôte). Ils ne sont accessibles qu'à l'intérieur du réseau Docker.
- **App bindée à `127.0.0.1:3001`** : seul Caddy local peut l'atteindre.
- **`.env.production`** contient les secrets — `chmod 600` recommandé.
- **Mises à jour OS** : `apt update && apt upgrade` régulier. Reboot après
  mises à jour du noyau (Docker reprendra les containers `restart: unless-stopped`).
- **Sauvegardes Postgres** : à mettre en place (pas dans ce guide). Au minimum
  un `pg_dump` cron-é hors-VPS.
