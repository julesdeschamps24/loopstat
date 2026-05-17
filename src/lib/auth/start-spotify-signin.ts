/**
 * Démarre le flow OAuth Spotify : récupère le CSRF token, puis POST vers
 * /api/auth/signin/spotify via form submit (le navigateur suit le 302 vers
 * Spotify en préservant les cookies).
 *
 * Doit être appelé uniquement côté client (utilise document/window).
 */
export async function startSpotifySignin(callbackPath: string): Promise<void> {
  const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/auth/signin/spotify";

  const csrfInput = document.createElement("input");
  csrfInput.type = "hidden";
  csrfInput.name = "csrfToken";
  csrfInput.value = csrfToken;
  form.appendChild(csrfInput);

  const cbInput = document.createElement("input");
  cbInput.type = "hidden";
  cbInput.name = "callbackUrl";
  cbInput.value = `${window.location.origin}${callbackPath}`;
  form.appendChild(cbInput);

  document.body.appendChild(form);
  form.submit();
}
