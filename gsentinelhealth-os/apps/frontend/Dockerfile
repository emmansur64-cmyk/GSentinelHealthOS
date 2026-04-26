FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/ui/package*.json ./packages/ui/
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "@gsentinelhealth/frontend"]
