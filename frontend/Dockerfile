FROM node:16-alpine as build

WORKDIR /usr/local/share/frontend

RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

RUN apk --update add libtool automake autoconf nasm gcc make g++ zlib-dev

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM danjellz/http-server:1.2

ENV PORT=3000
EXPOSE 3000

COPY --from=build /usr/local/share/frontend/public .
