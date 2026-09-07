FROM node:24-slim

WORKDIR /google-doc-authors/server

COPY ./server/package*.json .
RUN npm install

COPY .env ..
COPY ./server .
CMD ["sh", "-c", "npm run seed-database && npm run server"]
