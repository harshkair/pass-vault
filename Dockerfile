# Production-ready multi-stage Dockerfile for Next.js

FROM node:18-alpine AS builder
WORKDIR /app

# install deps
COPY package.json package-lock.json ./
RUN npm ci --production=false

# copy sources and build
COPY . .
RUN npm run build

# production image
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# copy only what we need
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
CMD ["npm","start"]
