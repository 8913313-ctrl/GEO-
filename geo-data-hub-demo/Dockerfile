FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=44280 \
    TZ_RELAY_DATA_DIR=/srv/tongzhuo-relay/data \
    TZ_RELAY_DATABASE_PATH=/srv/tongzhuo-relay/data/tongzhuo-relay.sqlite

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY . ./
RUN mkdir -p /srv/tongzhuo-relay/data /srv/tongzhuo-relay/backups \
    && chown -R node:node /app /srv/tongzhuo-relay

USER node
EXPOSE 44280
CMD ["node", "server.mjs"]
