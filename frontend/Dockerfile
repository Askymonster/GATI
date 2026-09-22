FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# O --host permite que o Vite seja acessado fora do contêiner
CMD ["npm", "run", "dev", "--", "--host"]