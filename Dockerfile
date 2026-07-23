FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        libc6-dev \
        libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY lab/package.json ./lab/package.json

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "httpmcpserver/http_server.js"]
