# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Stage 1: install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: build Next.js app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: minimal runtime image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Runtime backend target for Next.js rewrites.
# Override this in docker-compose/Kubernetes as needed.
ENV API_URL=http://localhost:5073

RUN addgroup --system --gid 1001 nodejs \
	&& adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
