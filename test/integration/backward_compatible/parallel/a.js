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
const { Client } = require('../../../../lib');

/**
 * Verifies lock operations behavior in advanced scenarios.
 */
describe('SplitBrainRCTest', function () {
    let dockerClusterId;
    let client;
    let container;
    let dockerMember1Id, dockerMember2Id, dockerMember3Id, dockerMember4Id, dockerMember5Id;

    before(async function () {
        TestUtil.markClientVersionAtLeast(this, '4.1');
        dockerMember1Id = process.env['DOCKER_MEMBER_1_ID'];
        const dockerMember1Host = process.env['DOCKER_MEMBER_1_HOST'];
        dockerMember2Id = process.env['DOCKER_MEMBER_2_ID'];
        const dockerMember2Host = process.env['DOCKER_MEMBER_2_HOST'];
        dockerMember3Id = process.env['DOCKER_MEMBER_3_ID'];
        const dockerMember3Host = process.env['DOCKER_MEMBER_3_HOST'];
        dockerMember4Id = process.env['DOCKER_MEMBER_4_ID'];
        const dockerMember4Host = process.env['DOCKER_MEMBER_4_HOST'];
        dockerMember5Id = process.env['DOCKER_MEMBER_5_ID'];
        const dockerMember5Host = process.env['DOCKER_MEMBER_5_HOST'];
        dockerClusterId = process.env['DOCKER_CLUSTER_ID'];

        client = await Client.newHazelcastClient({
            network: {
                clusterMembers: [`${dockerMember1Host}:5701`, `${dockerMember2Host}:5701`, `${dockerMember3Host}:5701`,
                 `${dockerMember4Host}:5701`, `${dockerMember5Host}:5701`
                ],
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
        await RC.shutdownDockerCluster(dockerClusterId);
        await container.stop();
    });

    it('should be able to split brain and merge clusters', async function () {
        const map = await client.getMap('map');
        await TestUtil.promiseWaitMilliseconds(6000);
        await map.put('key', 'value');
        await map.put('key2', 'value2');
        await map.put('key3', 'value3');
        await map.put('key4', 'value4');
        await map.put('key5', 'value5');

        await RC.splitClusterAs(dockerClusterId, [dockerMember1Id, dockerMember2Id],
            [dockerMember3Id, dockerMember4Id, dockerMember5Id]);
        await TestUtil.promiseWaitMilliseconds(20000);
        await RC.mergeCluster(dockerClusterId);
        await TestUtil.promiseWaitMilliseconds(20000);
    });
});
