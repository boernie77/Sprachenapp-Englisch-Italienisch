FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure public and uploads dir exist
RUN mkdir -p /app/public /app/uploads

EXPOSE 3001

CMD ["node", "server.js"]
