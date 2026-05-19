# ============================================
# Frontend Next.js — Dockerfile de développement
# ============================================
# Ce Dockerfile fonctionne dans 2 contextes :
#   1. Derrière un proxy d'entreprise (ex: Zscaler) avec certificat custom
#   2. Sans proxy (CI GitHub Actions, machine perso)
# ============================================
FROM node:22-alpine

# ---- Args proxy (vides en CI, remplis sur poste entreprise) ----
ARG http_proxy=""
ARG https_proxy=""
ENV http_proxy=$http_proxy
ENV https_proxy=$https_proxy

WORKDIR /app

# ---- Injection conditionnelle du certificat d'entreprise ----
# Le wildcard [t] permet au COPY de ne pas échouer si ca-bundle.crt est absent.
COPY ca-bundle.cr[t] /tmp/ca-bundle.crt.optional
RUN if [ -f /tmp/ca-bundle.crt.optional ]; then \
      echo "▶ Certificat d'entreprise détecté, injection dans le trust store..." && \
      cp /tmp/ca-bundle.crt.optional /etc/ssl/corporate-ca-bundle.crt && \
      cat /etc/ssl/corporate-ca-bundle.crt >> /etc/ssl/certs/ca-certificates.crt && \
      rm /tmp/ca-bundle.crt.optional ; \
    else \
      echo "▶ Pas de certificat d'entreprise — environnement standard (CI ou machine perso)" ; \
    fi

# ---- Variable Node.js pour utiliser le certif d'entreprise SI présent ----
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/corporate-ca-bundle.crt

# ---- Dépendances Node ----
COPY package*.json ./

# Configure le proxy npm SI une variable proxy est passée
RUN if [ -n "$http_proxy" ]; then \
      echo "▶ Proxy détecté, configuration de npm..." && \
      npm config set proxy "$http_proxy" && \
      npm config set https-proxy "$https_proxy" ; \
    else \
      echo "▶ Pas de proxy — npm en accès direct" ; \
    fi && \
    npm ci

# ---- Code source (sera écrasé par le bind mount en dev) ----
COPY . .

EXPOSE 3000

# -H 0.0.0.0 pour accepter les connexions depuis l'extérieur du conteneur
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
