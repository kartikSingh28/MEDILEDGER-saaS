FROM node:20-bookworm-slim

# openssl is needed by the Prisma schema engine (migrations)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# prisma.config.ts reads DATABASE_URL; generate doesn't connect, so any URL works here
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
