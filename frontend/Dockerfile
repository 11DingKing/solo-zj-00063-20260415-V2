FROM node:16-alpine as build

WORKDIR /usr/local/share/frontend

RUN npm config set registry https://registry.npmmirror.com

RUN apk --update add libtool automake autoconf nasm gcc make g++ zlib-dev

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM danjellz/http-server:1.2

ENV PORT=3000
EXPOSE 3000

COPY --from=build /usr/local/share/frontend/public .
