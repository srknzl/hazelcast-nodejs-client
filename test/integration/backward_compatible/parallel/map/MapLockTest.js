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

const RC = require('../../../RC');
const TestUtil = require('../../../../TestUtil');
const { Client } = require('../../../../../lib');

/**
 * Verifies lock operations behavior in advanced scenarios.
 */
describe('SplitBrainRCTest', function () {
    let dockerCluster;
    let client1;
    let dockerMember1, dockerMember2, dockerMember3, dockerMember4, dockerMember5;

    before(async function () {
        TestUtil.markClientVersionAtLeast(this, '4.1');
        dockerCluster = await RC.createDockerCluster('hazelcast/hazelcast:5.2.2-SNAPSHOT',
            '/Users/serkan/forked/hazelcast-nodejs-client/config.xml');
        dockerMember1 = await RC.startDockerMember(dockerCluster.id);
        dockerMember2 = await RC.startDockerMember(dockerCluster.id);
        dockerMember3 = await RC.startDockerMember(dockerCluster.id);
        dockerMember4 = await RC.startDockerMember(dockerCluster.id);
        dockerMember5 = await RC.startDockerMember(dockerCluster.id);

        client1 = await Client.newHazelcastClient({
            network: {
                clusterMembers: [`${dockerMember1.host}:${dockerMember1.port}`,`${dockerMember2.host}:${dockerMember2.port}`,
                `${dockerMember3.host}:${dockerMember3.port}`,`${dockerMember5.host}:${dockerMember5.port}`,
                `${dockerMember4.host}:${dockerMember4.port}`,],
            },
            membershipListeners: [{
                memberAdded: (membershipEvent) => {
                    console.log('member added', membershipEvent.member.toString());
                },
                memberRemoved: (membershipEvent) => {
                    console.log('member removed', membershipEvent.member.toString());
                }
            }],
            properties: {
                'hazelcast.logging.level': 'trace'
            }
        });
    });

    after(async function () {
        await RC.shutdownDockerCluster(dockerCluster.id);
        await TestUtil.promiseWaitMilliseconds(50000);
        if (client1) {
            await client1.shutdown();
        }
    });

    it('should be able to split brain and merge clusters', async function () {
        const map = await client1.getMap('map');
        await TestUtil.promiseWaitMilliseconds(6000);
        await map.put('key', 'value');
        await map.put('key2', 'value2');
        await map.put('key3', 'value3');
        await map.put('key4', 'value4');
        await map.put('key5', 'value5');

        await RC.splitClusterAs(dockerCluster.id, [dockerMember1, dockerMember2], [dockerMember3, dockerMember4, dockerMember5]);
        await TestUtil.promiseWaitMilliseconds(50000);
        await RC.mergeCluster(dockerCluster.id);
        await TestUtil.promiseWaitMilliseconds(50000);
    });
});
