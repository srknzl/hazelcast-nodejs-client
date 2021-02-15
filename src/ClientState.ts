export enum ClientStateEnum {
    /**
     * Clients start with this state. Once a client connects to a cluster,
     * it directly switches to {@link INITIALIZED_ON_CLUSTER} instead of
     * {@link CONNECTED_TO_CLUSTER} because on startup a client has no
     * local state to send to the cluster.
     */
    INITIAL = 0,

    /**
     * When a client switches to a new cluster, it moves to this state.
     * It means that the client has connected to a new cluster but not sent
     * its local state to the new cluster yet.
     */
    CONNECTED_TO_CLUSTER = 1,

    /**
     * When a client sends its local state to the cluster it has connected,
     * it switches to this state. When a client loses all connections to
     * the current cluster and connects to a new cluster, its state goes
     * back to {@link CONNECTED_TO_CLUSTER}.
     * <p>
     * Invocations are allowed in this state.
     */
    INITIALIZED_ON_CLUSTER = 2,
}

export interface ClientState {
    /**
     * Returns client state.
     * @return ClientStateEnum enum value
     */
    getState(): ClientStateEnum;

    /**
     * Sets the client state.
     * @param clientState ClientStateEnum enum value
     */
    setState(clientState: ClientStateEnum): void;
}

export class ClientStateImpl implements ClientState {

    private clientState = ClientStateEnum.INITIAL;

    constructor() {

    }

    getState(): ClientStateEnum {
        return this.clientState;
    }


    setState(clientState: ClientStateEnum): void {
        this.clientState = clientState;
    }
}
