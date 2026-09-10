# ---- base ----
# node:20 is below pnpm@11's minimum Node version (>=22.13), so use node:22
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /app

# ---- builder: install all deps and compile TypeScript ----
# Uses pnpm-lock.yaml (the maintained lockfile) - package-lock.json in this
# repo is stale and out of sync with package.json.
FROM base AS builder
# Force devDependencies to install even if NODE_ENV=production leaks in as a build arg
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ---- runner: production image ----
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
RUN mkdir -p uploads

EXPOSE 5000
ENV PORT=5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT}/ || exit 1

# Apply any pending migrations, then start the API server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./src/prisma/schema.prisma && node dist/index.js"]
