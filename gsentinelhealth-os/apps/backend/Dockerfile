FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN npm install

COPY . .

EXPOSE 4000
CMD ["sh", "-c", "npm run prisma:generate -w @gsentinelhealth/backend && npm run dev -w @gsentinelhealth/backend"]
