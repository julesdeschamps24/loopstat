# Scénarios de test — états utilisateur

Un seul compte loopstat suffit pour couvrir tous les états. On jongle entre :
- **DB directe** (psql / Drizzle Studio) pour l'import et le profil
- **Re-login Spotify** pour réinitialiser l'auth

## Connexion rapide à la DB

```bash
docker exec -it loopstat-postgres-1 psql -U loopstat -d loopstat
# ou Drizzle Studio :
pnpm drizzle-kit studio
```

User ID de référence (à remplacer dans les requêtes ci-dessous) :
```sql
SELECT id, spotify_id, username FROM users;
```

---

## Les 4 dimensions d'état

| Dimension | Champs DB | Valeurs |
|---|---|---|
| **Auth** | session NextAuth | logged out / logged in |
| **Import** | `imports.status` + `rows_imported` | jamais / pending / processing / completed / failed |
| **Profil** | `users.username` + `is_public` + `profile_settings` | privé / public sans perso / public personnalisé |

---

## Scénarios de base (à tester systématiquement)

### S1 — User fresh (rien fait)
**État** : connecté, pas d'import, free, profil privé
**Comment l'obtenir** :
```sql
DELETE FROM imports WHERE user_id = '<id>';
UPDATE users SET
  is_public = false, username = NULL,
  profile_settings = '{}'::jsonb,
  last_synced_at = NULL
WHERE id = '<id>';
```
**À vérifier** :
- Bandeau "Importe ton historique" visible
- Pages stats vides ou état "no data"
- `/u/<spotifyId>` renvoie 404

### S2 — Import en cours
**État** : import lancé, encore en `processing`
**Comment l'obtenir** : démarrer un import puis pause le worker (`docker stop loopstat-worker-1`) avant qu'il finisse — OU forcer en DB :
```sql
INSERT INTO imports (user_id, status, files_count, started_at)
VALUES ('<id>', 'processing', 3, now());
```
**À vérifier** : bandeau "Import en cours", spinner, pas de stats encore

### S3 — Import échoué
```sql
UPDATE imports SET status = 'failed',
  error_message = 'Test: invalid JSON in file 2',
  completed_at = now()
WHERE user_id = '<id>' AND status = 'processing';
```
**À vérifier** : message d'erreur affiché, possibilité de re-uploader

### S4 — Import OK, free, profil privé
**État** : stats visibles, watermark sur share card, perso bloquée
**Comment l'obtenir** : faire un vrai import (le worker pose `status='completed'` + `rows_imported`)
**À vérifier** :
- Toutes les pages stats fonctionnent
- `/settings` → options d'apparence disponibles
- Share card contient le watermark "loopstat"

### S5 — Profil public sans perso
```sql
UPDATE users SET is_public = true WHERE id = '<id>';
-- déclenche aussi la persistance du username au prochain accès UI
```
**À vérifier** :
- `/u/<username>` accessible publiquement (logout + visite)
- OG image générée

---

## Tester sans changer de compte Spotify

Avantage : un seul compte Spotify whitelisté dans le dashboard dev suffit. Inconvénient : on ne teste pas la coexistence multi-users (collisions de username, profils croisés).

Pour les rares cas multi-user :
1. **2ème navigateur** (Firefox vs Chrome) ou onglet privé
2. **2ème compte Spotify** ajouté dans https://developer.spotify.com/dashboard → app → *Users and Access*

---

## Combo à tester avant chaque release

Checklist minimale (10 min) :
- [ ] S1 → import → S4 (parcours nouvel utilisateur)
- [ ] S4 → S5 (passage public)
