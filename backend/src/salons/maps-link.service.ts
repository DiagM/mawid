import { Injectable, Logger } from '@nestjs/common';
import {
  Coordinates,
  isGoogleMapsHost,
  isMapsShortLink,
  parseMapsCoordinates,
} from './maps-url';

/**
 * ============================================
 * Résolution d'un lien Google Maps en coordonnées
 * ============================================
 * Les liens partagés depuis l'application mobile sont courts
 * (`maps.app.goo.gl/AbCd`) et ne contiennent AUCUNE coordonnée : il faut
 * suivre leur redirection pour obtenir l'URL complète.
 *
 * ⚠️ Cette classe fait donc partir une requête réseau vers une adresse
 * fournie par un utilisateur — exactement le schéma d'une SSRF. Trois
 * garde-fous, et aucun n'est optionnel :
 *   1. chaque saut est vérifié contre la liste blanche Google, y compris
 *      l'adresse d'arrivée : une redirection vers `169.254.169.254` (les
 *      métadonnées d'instance chez la plupart des hébergeurs) est refusée ;
 *   2. les redirections ne sont PAS suivies par `fetch` mais lues une par
 *      une, sinon le contrôle ne porterait que sur le premier saut ;
 *   3. le corps de la réponse n'est jamais lu, et un délai borne l'attente.
 */
@Injectable()
export class MapsLinkService {
  private readonly logger = new Logger(MapsLinkService.name);

  /** Au-delà, c'est une boucle ou un service qui ne veut pas coopérer. */
  private static readonly MAX_HOPS = 3;

  /** Un gérant attend sa réponse : mieux vaut échouer vite que bloquer. */
  private static readonly TIMEOUT_MS = 5000;

  /**
   * Renvoie le point désigné par `input`, ou `null` si rien n'est
   * exploitable. Ne lève jamais : un service de cartographie indisponible ne
   * doit pas empêcher un gérant d'enregistrer le reste de sa fiche.
   */
  async resolve(input: string): Promise<Coordinates | null> {
    const direct = parseMapsCoordinates(input);
    if (direct) {
      return direct;
    }

    if (!isMapsShortLink(input)) {
      return null;
    }

    const expanded = await this.followRedirects(input);
    return expanded ? parseMapsCoordinates(expanded) : null;
  }

  private async followRedirects(start: string): Promise<string | null> {
    let current = start;

    for (let hop = 0; hop < MapsLinkService.MAX_HOPS; hop += 1) {
      const url = this.safeUrl(current);
      if (!url) {
        return null;
      }

      let response: Response;
      try {
        response = await fetch(url, {
          // Sans ça, `fetch` suivrait les redirections lui-même et la
          // vérification d'hôte ne porterait que sur le premier saut.
          redirect: 'manual',
          // HEAD suffit : on ne veut que l'en-tête `Location`, jamais le
          // corps. Un serveur hostile ne peut donc pas nous faire télécharger
          // un fichier de plusieurs gigaoctets.
          method: 'HEAD',
          signal: AbortSignal.timeout(MapsLinkService.TIMEOUT_MS),
        });
      } catch (error) {
        this.logger.warn(
          `Lien Maps injoignable : ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }

      const location = response.headers.get('location');
      if (!location) {
        // Plus de redirection : l'adresse courante est l'adresse finale.
        return current;
      }

      // Une redirection peut être relative ; on la résout contre l'adresse
      // courante avant de contrôler l'hôte.
      current = new URL(location, url).toString();
    }

    this.logger.warn('Lien Maps : trop de redirections');
    return null;
  }

  /** `null` dès que l'adresse sort de la liste blanche Google. */
  private safeUrl(input: string): URL | null {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return null;
    }

    if (url.protocol !== 'https:' || !isGoogleMapsHost(url.hostname)) {
      this.logger.warn(`Lien Maps refusé : hôte ${url.hostname}`);
      return null;
    }

    return url;
  }
}
