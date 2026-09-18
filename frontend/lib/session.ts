import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * ============================================
 * Session du gérant
 * ============================================
 * Le backend émet un JWT ; on le range dans un cookie `httpOnly` plutôt que
 * dans `localStorage`.
 *
 * Pourquoi : un jeton lisible par JavaScript est récupérable par n'importe
 * quelle faille XSS, et ce jeton donne accès à l'agenda complet d'un salon et
 * aux numéros de téléphone de tous ses clients. Avec `httpOnly`, il ne touche
 * jamais le code client — seuls les composants serveur le lisent pour appeler
 * l'API.
 *
 * Conséquence d'architecture : toutes les pages du back-office sont des
 * composants serveur, et toutes les écritures passent par des Server Actions.
 */

const COOKIE_NAME = 'mawid_session';

/**
 * Durée alignée sur `JWT_EXPIRES_IN` (24 h côté backend). Un cookie qui
 * survivrait au jeton laisserait le gérant sur des écrans en erreur 401 sans
 * comprendre pourquoi.
 */
const MAX_AGE_SECONDS = 24 * 60 * 60;

export async function createSession(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // En dev, l'accès se fait en http : un cookie `secure` ne serait jamais
    // envoyé et la connexion échouerait sans message clair.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Jeton de session, ou redirection vers la connexion.
 *
 * À appeler dans CHAQUE page et CHAQUE Server Action du back-office : les
 * Server Actions sont joignables par un POST direct, sans passer par
 * l'interface. Un contrôle unique dans un layout ne protégerait donc rien.
 *
 * Ce contrôle ne vérifie que la présence du cookie ; l'autorisation réelle
 * reste faite par le backend, qui retrouve le salon via `ownerId` extrait du
 * JWT (docs/SECURITY.md §3).
 */
export async function requireSessionToken(): Promise<string> {
  const token = await getSessionToken();

  if (!token) {
    redirect('/pro/connexion');
  }

  return token;
}
