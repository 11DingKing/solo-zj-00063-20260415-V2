FROM node:18-alpine

WORKDIR /usr/local/share/backend

RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5000

CMD npm run start
