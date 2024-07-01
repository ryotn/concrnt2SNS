FROM node:20

WORKDIR /app

COPY . /app
RUN npm i

CMD ["node", "concrnt2SNS.js"]

