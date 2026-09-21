import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * 404 servie pour une URL qui ne correspond à AUCUNE route.
     *
     * Sans ce drapeau, Next rend `app/not-found.tsx` hors du layout racine :
     * la page sortait en production sans la moindre feuille de style, sans
     * `lang="fr"`, dans un `<html id="__next_error__">`. Vérifié sur le site
     * déployé avant d'ajouter ceci, pas supposé.
     *
     * ⚠️ Option expérimentale : à revérifier à chaque montée de version de
     * Next. Le jour où elle disparaît, la 404 redevient silencieusement
     * moche — rien ne casse, donc rien n'alerte.
     */
    globalNotFound: true,
  },
};

export default nextConfig;
