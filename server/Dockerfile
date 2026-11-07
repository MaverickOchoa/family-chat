# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/seed_db.json ./seed_db.json

# Create storage directory for encrypted blobs
RUN mkdir -p data/encrypted_blobs

EXPOSE 3001

CMD ["node", "dist/index.js"]
