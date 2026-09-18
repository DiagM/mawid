import { headers } from 'next/headers';

/**
 * Origine publique de la requête (`https://mawid.dz`), reconstruite côté
 * serveur.
 *
 * Pourquoi pas `window.location.origin` côté client : lire `window` impose un
 * effet puis un `setState`, ce que React interdit désormais (règle
 * `react-hooks/set-state-in-effect`), et le lien de gestion serait absent au
 * premier rendu. Le serveur connaît déjà l'information.
 *
 * `x-forwarded-proto` est renseigné par le reverse proxy (voir
 * `TRUST_PROXY_HOPS`) ; on retombe sur `http` en développement, où l'on accède
 * directement au conteneur.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const protocol =
    headerList.get('x-forwarded-proto') ??
    (host?.startsWith('localhost') ? 'http' : 'https');

  return host ? `${protocol}://${host}` : '';
}
