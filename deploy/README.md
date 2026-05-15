# Déploiement loopstat → VPS Hetzner

> Cible : `loopstat.tech` derrière Caddy sur le VPS `204.168.178.52` (Ubuntu).
> Stack : Next.js 16 + BullMQ worker + Postgres 16 + Redis 7, le tout dans Docker.

## Prérequis (à faire avant le déploiement)

1. **DNS** : ajoute un enregistrement A à ton registrar
   ```
   loopstat.tech.   A   204.168.178.52
   ```
   Vérifie la propagation : `dig +short loopstat.tech A` doit renvoyer `204.168.178.52`.
2. **Spotify Dashboard** ([developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)) :
   ouvre ton app, **Settings → Edit**, ajoute le redirect URI prod :
   ```
   https://loopstat.tech/api/auth/callback/spotify
   ```
   (Garde celui de dev `http://127.0.0.1:3000/api/auth/callback/spotify` à côté.)
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
avec Spotify », autorise. Tu dois atterrir sur `/dashboard`.

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

```sh
ssh root@204.168.178.52 'cd /opt/loopstat && \
  docker compose -f docker-compose.prod.yml down'
```

Les volumes `postgres_data` et `redis_data` survivent. Pour repartir
complètement à zéro (DESTRUCTIF) :

```sh
ssh root@204.168.178.52 'cd /opt/loopstat && \
  docker compose -f docker-compose.prod.yml down -v'
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
