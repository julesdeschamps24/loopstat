# Scénarios de test — états utilisateur

Un seul compte loopstat suffit pour couvrir tous les états. On jongle entre :
- **DB directe** (psql / Drizzle Studio) pour l'import et le profil
- **Stripe Checkout + Customer Portal** pour le premium
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
| **Premium** | `users.premium_status` + `premium_until` | free / trialing / active / past_due / canceled |
| **Profil** | `users.username` + `is_public` + `profile_settings` | privé / public sans perso / public personnalisé |

---

## Scénarios de base (à tester systématiquement)

### S1 — User fresh (rien fait)
**État** : connecté, pas d'import, free, profil privé
**Comment l'obtenir** :
```sql
DELETE FROM imports WHERE user_id = '<id>';
UPDATE users SET
  premium_status = NULL, premium_until = NULL,
  stripe_subscription_id = NULL,
  is_public = false, username = NULL,
  profile_settings = '{}'::jsonb,
  last_synced_at = NULL
WHERE id = '<id>';
```
**À vérifier** :
- Bandeau "Importe ton historique" visible
- Pages stats vides ou état "no data"
- Page Premium accessible, CTA "S'abonner" visible
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
- `/settings` → options d'apparence grisées avec badge Premium
- Share card contient le watermark "loopstat"

### S5 — Profil public sans perso
```sql
UPDATE users SET is_public = true WHERE id = '<id>';
-- déclenche aussi la persistance du username au prochain accès UI
```
**À vérifier** :
- `/u/<username>` accessible publiquement (logout + visite)
- OG image générée
- Pas de personnalisation (free)

### S6 — Trial premium (14 jours)
**Comment l'obtenir** : faire un checkout normal avec `4242 4242 4242 4242` → Stripe crée auto un trial 14j (cf. [api/checkout/route.ts:44-46](../src/app/api/checkout/route.ts#L44-L46))
**À vérifier** :
- Badge "Premium (essai)" dans `/settings/billing`
- Perso de profil débloquée (background + accent)
- Watermark share card retiré
- `premium_status='trialing'`, `premium_until` ≈ now + 14j

### S7 — Premium actif (post-trial)
**Comment l'obtenir** :
- **Méthode propre** : Stripe Test Clock (avancer 15j après le checkout S6)
- **Méthode rapide** :
```sql
UPDATE users SET premium_status='active',
  premium_until = now() + interval '30 days'
WHERE id = '<id>';
```
**À vérifier** : badge "Premium", facture visible dans Portal, renouvellement automatique mentionné

### S8 — Past due (échec de paiement)
**Comment l'obtenir** :
- **Propre** : checkout avec `4000 0000 0000 0341` (carte qui passe au checkout mais refuse au renouvellement) + Test Clock
- **Rapide** :
```sql
UPDATE users SET premium_status='past_due' WHERE id = '<id>';
```
**À vérifier** :
- Accès Premium maintenu tant que `premium_until > now()` (cf. [billing.ts:19-30](../src/db/queries/billing.ts#L19-L30))
- Bannière "Mettre à jour le moyen de paiement"

### S9 — Annulé (fin d'accès programmée)
**Comment l'obtenir** : Customer Portal → "Annuler l'abonnement" → en fin de période
**À vérifier** :
- `premium_status='canceled'` mais features Premium **toujours actives** jusqu'à `premium_until`
- Message "Votre abonnement se termine le XX"

### S10 — Retour Free après annulation
**Comment l'obtenir** : attendre la fin de période OU :
```sql
UPDATE users SET premium_until = now() - interval '1 day' WHERE id = '<id>';
```
**À vérifier** :
- `profile_settings` **conservé en DB** (au cas où le user se réabonne) mais **plus appliqué** au rendu de `/u/<username>` : fond et accent retombent sur `mesh` + `violet` (gating ajouté dans [u/[username]/page.tsx:86-89](../src/app/u/[username]/page.tsx#L86-L89))
- Watermark de retour sur share card (déjà gated via `isPremium` dans [share-card/route.tsx:160](../src/app/api/share-card/route.tsx#L160) et [opengraph-image.tsx:48](../src/app/u/[username]/opengraph-image.tsx#L48))
- CTA "Se réabonner"
- Note : les share cards et l'OG image n'appliquent pas la personnalisation de profil (couleurs hardcodées) — pas de fuite Premium côté images partagées.

---

## Cartes de test utiles

| Cas | Numéro |
|---|---|
| Paiement OK | `4242 4242 4242 4242` |
| Refusé immédiatement | `4000 0000 0000 0002` |
| 3DS requis (auth forte) | `4000 0025 0000 3155` |
| Passe au checkout, échoue au renouvellement | `4000 0000 0000 0341` |
| Fonds insuffisants | `4000 0000 0000 9995` |

Toutes : date future, CVC `123`, code postal `75001`.

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
- [ ] S5 → checkout → S6 (achat Premium en trial)
- [ ] S6 → Portal → S9 (annulation)
- [ ] S9 → S10 (retour Free)
