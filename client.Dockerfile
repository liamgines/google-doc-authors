FROM node:24-slim

WORKDIR /google-doc-authors/client

COPY ./client/package*.json .
RUN npm install

COPY .env ..
COPY ./client .

EXPOSE 5173

CMD ["npm", "run", "client", "--", "--host", "0.0.0.0"]
