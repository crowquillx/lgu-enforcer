FROM node:latest
# create directory
RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot
# copy and install bot
COPY package.json /usr/src/bot
RUN npm install
COPY . /usr/src/bot
# begin
CMD ["node", "index.js"]
