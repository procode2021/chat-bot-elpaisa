# Build the NestJS application and keep only production dependencies in the image.
FROM node:20-bookworm-slim AS build

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build && pnpm prune --prod

# Chromium is installed from Debian because WhatsApp Web runs through Puppeteer.
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    APP_PORT=3080 \
    WA_WEB_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node business-info.json ./business-info.json

USER node
EXPOSE 3080

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
