# ============================================
# Backend NestJS — Dockerfile de développement
# ============================================
FROM node:22-alpine

# Proxy Zscaler pour apk (résolution DNS)
ARG http_proxy
ARG https_proxy

# Injecter le CA Zscaler dans le trust store d'apk AVANT tout appel réseau
COPY ca-bundle.crt /etc/ssl/corporate-ca-bundle.crt
RUN cat /etc/ssl/corporate-ca-bundle.crt >> /etc/ssl/certs/ca-certificates.crt

# openssl requis par Prisma — apk fait maintenant confiance à Zscaler
RUN apk add --no-cache openssl

WORKDIR /app

ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Node.js utilise le bundle corporate (fichier stable, jamais écrasé)
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/corporate-ca-bundle.crt

COPY package*.json ./

RUN npm config set proxy ${http_proxy} && \
    npm config set https-proxy ${https_proxy} && \
    npm ci

COPY . .

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
