# ============================================
# Frontend Next.js — Dockerfile de développement
# ============================================
FROM node:22-alpine

# Proxy Zscaler pour apk (résolution DNS)
ARG http_proxy
ARG https_proxy

# Injecter le CA Zscaler dans le trust store d'apk AVANT tout appel réseau
COPY ca-bundle.crt /etc/ssl/corporate-ca-bundle.crt
RUN cat /etc/ssl/corporate-ca-bundle.crt >> /etc/ssl/certs/ca-certificates.crt

# Node.js utilise le bundle corporate (fichier stable, jamais écrasé)
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/corporate-ca-bundle.crt

WORKDIR /app

COPY package*.json ./

RUN npm config set proxy ${http_proxy} && \
    npm config set https-proxy ${https_proxy} && \
    npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
