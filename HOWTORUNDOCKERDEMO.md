## Intro

A split brain test has a test runner and the test code itself. The test code creates a client has the actual test logic. Test code runs in a container. The test runner is responsible for creating members  and passing their id to the actual test code. Then, test code controls the created members: split them, merge them and terminate them.

The test code should connect to the already started remote controller instance on the host machine. It does that by using the address 'host.docker.internal'. This is done in the client code by checking if a certain environment variable is set (DOCKER_ENV=true in this case). This environment variable is set in the test runner code, while creating the client test container. You need to edit
your client's RC starter script to not start a new RC instance if something is running on host:9701 (host can be either localhost or 'host.docker.internal'). You also need to change your thrift RC client connection code. It should use the host 'host.docker.internal' in a docker container environment depending on the env variable.

The test code is [here](./test/integration/backward_compatible/parallel/a.js). The runner is [here](./test/integration/backward_compatible/parallel/aRunner.js).

Running a split brain test requires depending on the testcontainers package. It's not available for cpp, other languages have it. You can
see how testcontainers is used in the test code.

## Running


To run it, you need to build the docker image.

First, install dependencies and compile using newer versions of nodejs(currently min node 14):

```
npm install
npm run compile
```

Do it by running the following in the root folder:

```text
docker build -t nodejs-docker-splitbrain-image .
```

The image name is important and used by the runner script. You can find the dockerfile [here](./Dockerfile).

After building the image, make sure you copy the remote controller jar that is modified for the split brain tests to the root path. (next to this file)

After these are done, start RC instance by:

```text
npm run startrc
```

The last command starts the RC. The others are prerequisites. Leave RC running in the background.

In another terminal, run the following:

```text
npm run test notimportant
```

`notimportant` is the name of the test in the test runner. (aRunner.js) This command runs tests that match the given regex, in this case, only our runner.

## Future work

Currently it is not certain how to detech a test is passed or failed in the test runner code. 
