FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

# Copiar el resto del proyecto
COPY . .

EXPOSE 3000

# Aplica migraciones, siembra datos y arranca el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/server.js"]
