FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/gym-partner.sqlite
EXPOSE 3000
VOLUME /data
CMD ["node","src/server.js"]
