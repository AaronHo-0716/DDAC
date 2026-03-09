# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install libc compat for Alpine (needed by some native modules)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: Build the Next.js application ───────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# API_URL is NOT baked in here — it's only needed at runtime via docker-compose.
# The build produces a standalone server output (see next.config.ts).
RUN npm run build

# ─── Stage 3: Production runtime (smallest possible image) ────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Add a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy only what the standalone server needs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# API_URL will be injected here at container start time by docker-compose,
# so the same image works in dev, staging, and production.
CMD ["node", "server.js"]
