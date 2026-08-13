/**
 * Authentification de l'espace pro (gérant).
 *
 * Le backend n'utilise ni cookie ni session : un JWT est renvoyé au login et
 * doit être renvoyé dans l'en-tête `Authorization: Bearer <token>` sur
 * chaque appel protégé. On le garde en `localStorage` (acceptable pour ce
 * V1 : pas de refresh token, pas de httpOnly cookie — voir le rapport de la
 * session pour les limites de cette approche).
 */

import { api, type ProUser } from "./api";

const TOKEN_KEY = "mawid_pro_token";

/** Renvoie le token stocké, ou `null` (y compris côté serveur, où il n'y a pas de localStorage). */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

/** Supprime le token stocké (déconnexion). */
export function logout(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Vérification "légère" côté client : un token est présent. Ne garantit pas
 * qu'il soit encore valide (expiré, révoqué...) — c'est `GET /auth/me` qui
 * fait foi, à appeler une fois au montage de la coquille /pro.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Connecte le gérant et stocke le token en cas de succès.
 * Laisse remonter l'`ApiError` du backend en cas d'échec (401, etc.) pour
 * que l'appelant affiche le message adapté.
 */
export async function login(
  phone: string,
  password: string,
): Promise<ProUser> {
  const result = await api.login(phone, password);
  setToken(result.accessToken);
  return result.user;
}
