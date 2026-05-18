# Google OAuth setup (one-time)

Loopstat utilise Google Sign In comme provider d'identité unique (depuis le
pivot mai 2026, suite aux restrictions Spotify dev mode à 5 users max).

## Configuration

1. Va sur https://console.cloud.google.com/apis/credentials
2. Si pas de projet : crée-en un (nom au choix, ex. "loopstat")
3. **+ Create credentials → OAuth client ID**
   - Type : **Web application**
   - Name : `loopstat`
   - **Authorized redirect URIs** :
     - `http://127.0.0.1:3000/api/auth/callback/google` (dev)
     - `https://loopstat.tech/api/auth/callback/google` (prod)
4. Copie **Client ID** + **Client secret**
5. Configure le consent screen :
   - https://console.cloud.google.com/apis/credentials/consent
   - User Type : **External**, Publishing status : **Testing**
   - Scopes : `openid`, `email`, `profile` (par défaut)
   - Test users : ajoute ton email Google
6. Renseigne dans `.env.local` (et `.env.production` pour la prod) :
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

## Limites du mode Testing

- Jusqu'à **100 testeurs whitelistés** (ajoutés dans Test users du consent screen)
- Pas de verification Google requise
- Largement suffisant pour beta

## Passage en production

Quand prêt pour le launch public :
- Consent screen → **Publish app**
- Google review pendant 1-4 semaines (OAuth Verification)
- Conditions OAuth : moins strictes que Spotify (juste : privacy policy URL,
  app domain verified, scopes justifiés)
- Une fois validé : tous les Google users peuvent s'inscrire (pas de cap)
