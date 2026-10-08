# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- build stage
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma
COPY prisma7.config.ts ./
# The Prisma client is generated from the schema, not committed.
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ----------------------------------------------------------------- run stage
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# bcrypt and Prisma need a libc shim on Alpine.
RUN apk add --no-cache libc6-compat tini

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

# Local object storage lives here when STORAGE_DRIVER=LOCAL; mount a volume so
# encrypted records survive a container replacement.
RUN mkdir -p /app/storage && chown -R node:node /app/storage
VOLUME ["/app/storage"]

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombies and forwards SIGTERM, so the graceful shutdown in
# src/index.ts actually runs.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
