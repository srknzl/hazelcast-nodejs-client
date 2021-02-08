/*
 * Copyright (c) 2008-2021, Hazelcast, Inc. All Rights Reserved.
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
/** @ignore *//** */

import * as Long from 'long';
import {RaftGroupId} from './RaftGroupId';
import {BaseCPProxy, ClientForBaseCPProxy} from './BaseCPProxy';
import {CPSubsystem, CPSubsystemImpl} from '../../CPSubsystem';
import {CPSessionManager} from './CPSessionManager';


export interface ClientForCPSessionAwareProxy extends ClientForBaseCPProxy {
    getCPSubsystem(): CPSubsystem;
}

/**
 * Common super class for CP Subsystem proxies that make use of Raft sessions.
 * @internal
 */
export abstract class CPSessionAwareProxy extends BaseCPProxy {

    protected readonly sessionManager: CPSessionManager;
    private threadIdSeq = 0;

    constructor(client: ClientForCPSessionAwareProxy,
                serviceName: string,
                groupId: RaftGroupId,
                proxyName: string,
                objectName: string) {
        super(client, serviceName, groupId, proxyName, objectName);
        this.sessionManager = (client.getCPSubsystem() as CPSubsystemImpl).getCPSessionManager();
    }

    /**
     * As Node.js client implements non-reentrant concurrent primitives,
     * we generate a new "thread id" per each acquire attempt.
     */
    protected nextThreadId(): number {
        return this.threadIdSeq++;
    }

    protected getSessionId(): Long {
        return this.sessionManager.getSessionId(this.groupId);
    }

    protected acquireSession(permits?: number): Promise<Long> {
        return this.sessionManager.acquireSession(this.groupId, permits);
    }

    protected releaseSession(sessionId: Long, permits?: number): void {
        return this.sessionManager.releaseSession(this.groupId, sessionId, permits);
    }

    protected invalidateSession(sessionId: Long): void {
        return this.sessionManager.invalidateSession(this.groupId, sessionId);
    }
}
