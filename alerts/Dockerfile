FROM node:16-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /app/
COPY . /app/

RUN npm install
RUN npm install -g nodemon
# If you are building your code for production
# RUN npm ci --only=production

EXPOSE 4000
CMD [ "nodemon", "start" ]