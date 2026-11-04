FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
