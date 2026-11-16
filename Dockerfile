FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --chown=node:node server.js ./
COPY --chown=node:node navdata-store.js ./
COPY --chown=node:node navdata-bootstrap.js ./
COPY --chown=node:node public ./public
COPY --chown=node:node runtime ./runtime
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node","server.js"]
