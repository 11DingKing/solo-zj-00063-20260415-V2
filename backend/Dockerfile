FROM node:18-alpine

WORKDIR /usr/local/share/backend

RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5000

CMD npm run start
