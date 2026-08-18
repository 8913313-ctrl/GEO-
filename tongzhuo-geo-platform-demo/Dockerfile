FROM node:24-alpine

RUN apk add --no-cache su-exec

ENV NODE_ENV=production \
    TZ_BIND_HOST=0.0.0.0 \
    PORT=44127 \
    TZ_DATA_DIR=/app/data \
    TZ_DATABASE_PATH=/app/data/tongzhuo-production.sqlite \
    TZ_LOG_DIR=/app/data/logs \
    TZ_BACKUP_DIR=/app/data/backups

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --ignore-scripts; else npm install --omit=dev --ignore-scripts; fi

COPY . .
RUN chmod 755 /app/deploy/geo-admin-entrypoint.sh \
    && mkdir -p /app/data/logs /app/data/backups /app/data/secrets \
    && chown -R node:node /app

USER node
EXPOSE 44127
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:44127/health/ready >/dev/null || exit 1

ENTRYPOINT ["/app/deploy/geo-admin-entrypoint.sh"]
CMD ["npm", "start"]
