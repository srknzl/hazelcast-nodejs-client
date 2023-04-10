A split brain test has a runner and the test code itself. The test code creates a client and runs in a container. The runner is responsible for creating members in containers and passing their id to the test code. Then, test code controls the created members: split them, merge them and terminate them.

The test code connects to the already started remote controller instance on the host by using the address 'host.docker.internal' if a certain environment variable is set (DOCKER_ENV=true in this case). This environment varialbe is set in the test runner code, while creating the client test container. You need to edit
your client's RC start script to not start a new RC instance if one is running. You need to change your test's code's thrift connection code as well. It should use the host 'host.docker.internal' in a docker container if the environment variable is set.

The test code is [here](./test/integration/backward_compatible/parallel/a.js). The runner is [here](./test/integration/backward_compatible/parallel/aRunner.js).

Running a split brain test requires depending on the testcontainers package. It's not available for cpp, other languages have it. You can
see how testcontainers is used in the test code.

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
