import {ClientConnection} from './ClientConnection';
import {ClientOfflineError, IOError, LoadBalancer, UUID} from '../core';
import {ConnectionStrategyConfig, ReconnectMode} from '../config';
import {ClientState, ClientStateEnum} from '../ClientState';

export interface ConnectionRegistry {
    /**
     * Returns if the registry active
     * @return Return true if the registry is active, false otherwise
     */
    isActive(): boolean;

    /**
     * Returns if the registry empty
     * @return true if the registry empty, false otherwise
     */
    isEmpty(): boolean;

    /**
     * Returns connection by UUID
     * @param uuid UUID that identifies the connection
     * @return ClientConnection if there is a connection with the UUID, undefined otherwise
     */
    getConnection(uuid: UUID): ClientConnection | undefined;

    /**
     * Returns all active connections in the registry
     * @return Array of ClientConnection objects
     */
    getConnections(): ClientConnection[];

    /**
     * Returns a random connection from active connections
     * @return ClientConnection if there is at least one connection, otherwise null
     */
    getRandomConnection(): ClientConnection | null;

    /**
     * Runs the given function for every active connection
     * @param fn A function that takes ClientConnection as arg, does not return anything
     */
    forEachConnection(fn: (conn: ClientConnection) => void): void;

    /**
     * Returns if invocation allowed. Invocation is allowed only if client state is {@link INITIALIZED_ON_CLUSTER}
     * and there is at least one active connection.
     * @return Error if invocation is not allowed, null otherwise
     */
    checkIfInvocationAllowed(): Error | null;

    /**
     * Delete connection from active connections
     * @param uuid UUID that identifies the connection
     */
    deleteConnection(uuid: UUID): void;

    /**
     * Adds or updates a client connection by uuid
     * @param uuid UUID to identify the connection
     * @param connection the ClientConnection to set
     */
    setConnection(uuid: UUID, connection: ClientConnection): void
}

export class ConnectionRegistryImpl implements ConnectionRegistry {

    private active = false;
    private activeConnections = new Map<string, ClientConnection>();
    private loadBalancer: LoadBalancer;
    private clientState: ClientState;
    private readonly smartRoutingEnabled: boolean;
    private readonly asyncStart: boolean;
    private readonly reconnectMode: ReconnectMode;

    constructor(connectionStrategy: ConnectionStrategyConfig, clientState: ClientState) {
        this.asyncStart = connectionStrategy.asyncStart;
        this.reconnectMode = connectionStrategy.reconnectMode;
    }

    isActive(): boolean {
        return this.active;
    }

    isEmpty(): boolean {
        return this.activeConnections.size === 0;
    }

    getConnections(): ClientConnection[] {
        return Array.from(this.activeConnections.values());
    }

    getConnection(uuid: UUID): ClientConnection | undefined {
        return this.activeConnections.get(uuid.toString());
    }

    getRandomConnection(): ClientConnection {
        if (this.smartRoutingEnabled) {
            const member = this.loadBalancer.next();
            if (member != null) {
                const connection = this.getConnection(member.uuid);
                if (connection != null) {
                    return connection;
                }
            }
        }

        const iterator = this.activeConnections.values();
        const next = iterator.next();
        if (!next.done) {
            return next.value;
        } else {
            return null;
        }
    }

    forEachConnection(fn: (conn: ClientConnection) => void): void {
        this.activeConnections.forEach(fn);
    }

    checkIfInvocationAllowed(): Error {
        const state = this.clientState.getState();
        if (state === ClientStateEnum.INITIALIZED_ON_CLUSTER && this.activeConnections.size > 0) {
            return null;
        }

        let error: Error;
        if (state === ClientStateEnum.INITIAL) {
            if (this.asyncStart) {
                error = new ClientOfflineError();
            } else {
                error = new IOError('No connection found to cluster since the client is starting.');
            }
        } else if (this.reconnectMode === ReconnectMode.ASYNC) {
            error = new ClientOfflineError();
        } else {
            error = new IOError('No connection found to cluster.');
        }
        return error;
    }

    deleteConnection(uuid: UUID): void {
        this.activeConnections.delete(uuid.toString());
    }

    setConnection(uuid: UUID, connection: ClientConnection): void {
        this.activeConnections.set(uuid.toString(), connection);
    }
}
