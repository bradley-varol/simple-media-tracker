# syntax=docker/dockerfile:1

# PocketBase version used by every stage. Bump this and the checksums together.
ARG POCKETBASE_VERSION=0.40.4


# ---------------------------------------------------------------------------
# Fetch PocketBase from its GitHub release, pinned and checksum verified.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM alpine:3.24 AS pocketbase-download

ARG POCKETBASE_VERSION
# Provided automatically by BuildKit: "amd64", "arm64", ...
ARG TARGETARCH

# sha256 of pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip, taken from
# https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/checksums.txt
ARG POCKETBASE_SHA256_amd64=9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa
ARG POCKETBASE_SHA256_arm64=86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418

RUN apk add --no-cache ca-certificates curl unzip

RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) sha256="$POCKETBASE_SHA256_amd64" ;; \
      arm64) sha256="$POCKETBASE_SHA256_arm64" ;; \
      *) echo "Unsupported architecture: $TARGETARCH. Add its checksum to the Dockerfile." >&2; exit 1 ;; \
    esac; \
    archive="pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip"; \
    curl -fsSL -o "/tmp/$archive" \
      "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/$archive"; \
    echo "$sha256  /tmp/$archive" | sha256sum -c -; \
    unzip -q "/tmp/$archive" pocketbase -d /tmp; \
    chmod 755 /tmp/pocketbase


# ---------------------------------------------------------------------------
# Development web server (Vite). Local development only — never expose this
# beyond localhost. Used by compose.dev.yaml.
# ---------------------------------------------------------------------------
FROM node:24.21.0-alpine AS web-dev

WORKDIR /app

# compose.dev.yaml keeps node_modules in an anonymous volume seeded from this
# image, so the volume inherits the ownership the directory has here. Install as
# the user Vite runs as: as root it produces a node_modules the server cannot
# write, and dependency optimization fails at startup with EACCES on
# node_modules/.vite.
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]


# ---------------------------------------------------------------------------
# Production build of the frontend. Static files only — they are copied into
# the PocketBase stage below, which serves them.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:24.21.0-alpine AS web-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html components.json tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public

# Leave empty to talk to PocketBase over the same origin, which is how this is
# built to run: one server answers for the app and the API both. Only set this
# if you host the API elsewhere.
ARG VITE_POCKETBASE_URL=""
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

RUN npm run build


# ---------------------------------------------------------------------------
# The whole application: PocketBase serving the built frontend, the REST API
# and the superuser dashboard at /_/ from a single port. pb_hooks/http.pb.js
# adds the security headers and compression a static file server would.
# ---------------------------------------------------------------------------
FROM alpine:3.24 AS pocketbase

RUN apk add --no-cache ca-certificates \
    && adduser -D -u 1000 -h /home/pocketbase pocketbase \
    && mkdir -p /pb_data \
    && chown pocketbase:pocketbase /pb_data

COPY --from=pocketbase-download /tmp/pocketbase /usr/local/bin/pocketbase
COPY --from=web-build /app/dist /pb_public
COPY pb_migrations /pb_migrations
COPY pb_hooks /pb_hooks
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER pocketbase
EXPOSE 8091
VOLUME ["/pb_data"]

# Checks that /pb_data is writable and says so in words if it is not. Without
# it an unwritable mount surfaces only as SQLite's "unable to open database
# file (14)", which names neither the directory nor the ownership at fault.
ENTRYPOINT ["docker-entrypoint.sh"]

# hooksWatch off: the hooks are baked into the image and never change under a
# running container, so the watcher would only ever restart the app for nothing.
CMD ["pocketbase", "serve", "--http=0.0.0.0:8091", "--dir=/pb_data", "--publicDir=/pb_public", "--migrationsDir=/pb_migrations", "--hooksDir=/pb_hooks", "--hooksWatch=false"]
