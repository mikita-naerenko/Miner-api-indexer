FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

# copy prisma schema for generate step
COPY libs/prisma ./libs/prisma

RUN npx prisma generate

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000 3001

CMD ["node", "dist/apps/api/src/main.js"]

