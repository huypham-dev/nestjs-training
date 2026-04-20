# ================================
# Stage 1: Build
# ================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN HUSKY=0 pnpm install --frozen-lockfile --shamefully-hoist

COPY . .

RUN pnpm build

# ================================
# Stage 2: Production
# ================================
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 8000

CMD ["node", "dist/main"]
