/*
 * Copyright (c) 2008-2022, Hazelcast, Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const RC = require('../../RC');
const TestUtil = require('../../../TestUtil');
const { GenericContainer, StartedNetwork } = require('testcontainers');

/**
 * Verifies lock operations behavior in advanced scenarios.
 */
describe('notimportant', function () {
    let dockerCluster;
    let container;

    before(async function () {
        TestUtil.markClientVersionAtLeast(this, '4.1');
        dockerCluster = await RC.createDockerCluster('hazelcast/hazelcast:latest',
            '/Users/serkan/forked/hazelcast-nodejs-client/config.xml', process.env['HAZELCAST_ENTERPRISE_KEY']);
        const member1 = await RC.startDockerMember(dockerCluster.id);
        const member2 = await RC.startDockerMember(dockerCluster.id);
        const member3 = await RC.startDockerMember(dockerCluster.id);
        const member4 = await RC.startDockerMember(dockerCluster.id);
        const member5 = await RC.startDockerMember(dockerCluster.id);

        const network = new StartedNetwork(dockerCluster.networkId, {
            name: 'hazelcast-network-' + dockerCluster.id,
        });
        container = await new GenericContainer('nodejs-docker-splitbrain-image')
                    .withNetwork(network)
                    .withExtraHosts([{
                        host: 'host.docker.internal',
                        ipAddress: 'host-gateway'
                    }])
                    .withEnvironment({
                        DOCKER_CLUSTER_ID: dockerCluster.id,
                        DOCKER_MEMBER_1_ID: member1.containerId,
                        DOCKER_MEMBER_1_HOST: member1.host,
                        DOCKER_MEMBER_2_ID: member2.containerId,
                        DOCKER_MEMBER_2_HOST: member2.host,
                        DOCKER_MEMBER_3_ID: member3.containerId,
                        DOCKER_MEMBER_3_HOST: member3.host,
                        DOCKER_MEMBER_4_ID: member4.containerId,
                        DOCKER_MEMBER_4_HOST: member4.host,
                        DOCKER_MEMBER_5_ID: member5.containerId,
                        DOCKER_MEMBER_5_HOST: member5.host,
                        DOCKER_ENV: 'true',
                        HAZELCAST_ENTERPRISE_KEY: process.env.HAZELCAST_ENTERPRISE_KEY
                    }).start();
    });

    it('should be able to split brain and merge clusters', async function () {
        await TestUtil.promiseWaitMilliseconds(20000000);
    });

    after(async function () {
        await RC.shutdownDockerCluster(dockerCluster.id);
        await container.stop();
    });
});
