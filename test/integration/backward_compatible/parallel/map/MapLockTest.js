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
    let client1, client2;
    let dockerMember1, dockerMember2, dockerMember3, dockerMember4, dockerMember5;

    before(async function () {
        TestUtil.markClientVersionAtLeast(this, '4.1');
        dockerCluster = await RC.createDockerCluster('hazelcast/hazelcast:5.2.2-SNAPSHOT', null);
        dockerMember1 = await RC.startDockerMember(dockerCluster.id);
        dockerMember2 = await RC.startDockerMember(dockerCluster.id);
        dockerMember3 = await RC.startDockerMember(dockerCluster.id);
        dockerMember4 = await RC.startDockerMember(dockerCluster.id);
        dockerMember5 = await RC.startDockerMember(dockerCluster.id);

        client1 = await Client.newHazelcastClient({
            network: {
                clusterMembers: [`${dockerMember1.host}:${dockerMember1.port}`]
            },
            customLogger: {
                log(level, objectName, message, furtherInfo) {
                    console.log('client1: ', level, objectName, message, furtherInfo);
                },
                error(objectName, message, furtherInfo) {
                    console.log('client1: ', objectName, message, furtherInfo);
                },
                warn(objectName, message, furtherInfo) {
                    console.log('client1: ', objectName, message, furtherInfo);
                },
                info(objectName, message, furtherInfo) {
                    console.log('client1: ', objectName, message, furtherInfo);
                },
                debug(objectName, message, furtherInfo) {
                    console.log('client1: ', objectName, message, furtherInfo);
                },
                trace(objectName, message, furtherInfo) {
                    console.log('client1: ', objectName, message, furtherInfo);
                }
            }
        });

        client2 = await Client.newHazelcastClient({
            network: {
                clusterMembers: [`${dockerMember5.host}:${dockerMember5.port}`]
            },
            customLogger: {
                log(level, objectName, message, furtherInfo) {
                    console.log('client2: ', level, objectName, message, furtherInfo);
                },
                error(objectName, message, furtherInfo) {
                    console.log('client2: ', objectName, message, furtherInfo);
                },
                warn(objectName, message, furtherInfo) {
                    console.log('client2: ', objectName, message, furtherInfo);
                },
                info(objectName, message, furtherInfo) {
                    console.log('client2: ', objectName, message, furtherInfo);
                },
                debug(objectName, message, furtherInfo) {
                    console.log('client2: ', objectName, message, furtherInfo);
                },
                trace(objectName, message, furtherInfo) {
                    console.log('client2: ', objectName, message, furtherInfo);
                }
            }
        });
    });

    after(async function () {
        await RC.shutdownDockerCluster(dockerCluster.id);
        await TestUtil.promiseWaitMilliseconds(10000);
        await client1.shutdown();
        await client2.shutdown();
    });

    it('should be able to split brain and merge clusters', async function () {
        await RC.splitClusterAs(dockerCluster.id, [dockerMember1, dockerMember2], [dockerMember3, dockerMember4, dockerMember5]);
        await TestUtil.promiseWaitMilliseconds(30000);
        await RC.mergeCluster(dockerCluster.id);
        await TestUtil.promiseWaitMilliseconds(30000);
    });
});
