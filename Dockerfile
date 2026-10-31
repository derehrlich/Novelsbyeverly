FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8888 DATA_DIR=/data TZ=Europe/Berlin
RUN apk add --no-cache tzdata
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY public ./public
COPY server ./server
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8888
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8888/healthz || exit 1
USER node
CMD ["node", "server/index.mjs"]
