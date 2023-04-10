FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y nodejs
RUN apt-get install -y npm
RUN apt-get install -y openjdk-8-jdk
RUN apt-get install -y maven

RUN mkdir /app
WORKDIR /app

COPY package.json /app
COPY lib /app/lib
COPY test /app/test
COPY hazelcast-remote-controller-0.8-SNAPSHOT.jar /app
COPY scripts /app/scripts

RUN npm install

CMD ["npm", "test", "SplitBrainRCTest"]
