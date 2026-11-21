FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV PORT=4000 DATA_FILE=/data/db.json
VOLUME /data
EXPOSE 4000
CMD ["node", "src/server.js"]
