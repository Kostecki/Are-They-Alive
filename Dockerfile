# Base for dev/build
FROM node:26-slim AS base
RUN npm install -g pnpm
WORKDIR /are-they-alive

# Install all (dev) deps
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Use a cache for the pnpm store to speed subsequent builds
RUN --mount=type=cache,target=/root/.pnpm-store \
  pnpm install --frozen-lockfile

# Build the app (frontend + backend)
FROM deps AS build
COPY src/ ./src
COPY public/ ./public
COPY vite.config.ts tsconfig.json postcss.config.cjs ./
COPY package.json pnpm-lock.yaml ./

ARG VITE_UMAMI_SRC_URL
ARG VITE_UMAMI_WEBSITE_ID

ENV VITE_UMAMI_SRC_URL=$VITE_UMAMI_SRC_URL
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID

RUN mkdir -p dist
RUN pnpm run build

# Prune dev deps to production-only
FROM deps AS prod-deps
RUN pnpm prune --prod

# Final runtime image
FROM node:26-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /are-they-alive

# Copy runtime artifacts
COPY --from=prod-deps /are-they-alive/node_modules ./node_modules
COPY --from=build /are-they-alive/.output ./.output
COPY package.json pnpm-lock.yaml ./

ENTRYPOINT ["/usr/bin/tini", "--"]
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]