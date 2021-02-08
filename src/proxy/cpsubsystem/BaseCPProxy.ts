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

import {ClientMessage} from '../../protocol/ClientMessage';
import {RaftGroupId} from './RaftGroupId';
import {CPGroupDestroyCPObjectCodec} from '../../codec/CPGroupDestroyCPObjectCodec';
import {UnsupportedOperationError} from '../../core';
import {Data} from '../../serialization';
import {SerializationService} from "../../serialization/SerializationService";
import {InvocationService} from "../../invocation/InvocationService";


export interface ClientForBaseCPProxy {
    getSerializationService(): SerializationService;

    getInvocationService(): InvocationService;
}

/**
 * Common super class for any CP Subsystem proxy.
 * @internal
 */
export abstract class BaseCPProxy {

    protected client: ClientForBaseCPProxy;
    protected readonly proxyName: string;
    protected readonly serviceName: string;
    protected readonly groupId: RaftGroupId;
    protected readonly objectName: string;

    constructor(client: ClientForBaseCPProxy,
                serviceName: string,
                groupId: RaftGroupId,
                proxyName: string,
                objectName: string) {
        this.client = client;
        this.serviceName = serviceName;
        this.groupId = groupId;
        this.proxyName = proxyName;
        this.objectName = objectName;
    }

    getPartitionKey(): string {
        throw new UnsupportedOperationError('This operation is not supported by CP Subsystem');
    }

    getName(): string {
        return this.proxyName;
    }

    getServiceName(): string {
        return this.serviceName;
    }

    getGroupId(): RaftGroupId {
        return this.groupId;
    }

    destroy(): Promise<void> {
        return this.encodeInvokeOnRandomTarget(
            CPGroupDestroyCPObjectCodec, this.groupId, this.serviceName, this.objectName
        ).then(() => {});
    }

    protected toData(object: any): Data {
        return this.client.getSerializationService().toData(object);
    }

    protected toObject(data: Data): any {
        return this.client.getSerializationService().toObject(data);
    }

    /**
     * Encodes a request from a codec and invokes it on any node.
     * @param codec
     * @param codecArguments
     * @returns response message
     */
    protected encodeInvokeOnRandomTarget(codec: any, ...codecArguments: any[]): Promise<ClientMessage> {
        const clientMessage = codec.encodeRequest(...codecArguments);
        return this.client.getInvocationService().invokeOnRandomTarget(clientMessage);
    }
}
