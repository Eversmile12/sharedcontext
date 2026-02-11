"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIbcExtension = void 0;
const query_1 = require("cosmjs-types/ibc/applications/transfer/v1/query");
const query_2 = require("cosmjs-types/ibc/core/channel/v1/query");
const query_3 = require("cosmjs-types/ibc/core/client/v1/query");
const query_4 = require("cosmjs-types/ibc/core/connection/v1/query");
const tendermint_1 = require("cosmjs-types/ibc/lightclients/tendermint/v1/tendermint");
const queryclient_1 = require("../../queryclient");
function decodeTendermintClientStateAny(clientState) {
    if (clientState?.typeUrl !== "/ibc.lightclients.tendermint.v1.ClientState") {
        throw new Error(`Unexpected client state type: ${clientState?.typeUrl}`);
    }
    return tendermint_1.ClientState.decode(clientState.value);
}
function decodeTendermintConsensusStateAny(clientState) {
    if (clientState?.typeUrl !== "/ibc.lightclients.tendermint.v1.ConsensusState") {
        throw new Error(`Unexpected client state type: ${clientState?.typeUrl}`);
    }
    return tendermint_1.ConsensusState.decode(clientState.value);
}
function setupIbcExtension(base) {
    const rpc = (0, queryclient_1.createProtobufRpcClient)(base);
    // Use these services to get easy typed access to query methods
    // These cannot be used for proof verification
    const channelQueryService = new query_2.QueryClientImpl(rpc);
    const clientQueryService = new query_3.QueryClientImpl(rpc);
    const connectionQueryService = new query_4.QueryClientImpl(rpc);
    const transferQueryService = new query_1.QueryClientImpl(rpc);
    return {
        ibc: {
            channel: {
                channel: async (portId, channelId) => channelQueryService.Channel({
                    portId: portId,
                    channelId: channelId,
                }),
                channels: async (paginationKey) => channelQueryService.Channels({
                    pagination: (0, queryclient_1.createPagination)(paginationKey),
                }),
                allChannels: async () => {
                    const channels = [];
                    let response;
                    let key;
                    do {
                        response = await channelQueryService.Channels({
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        channels.push(...response.channels);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_2.QueryChannelsResponse.fromPartial({
                        channels: channels,
                        height: response.height,
                    });
                },
                connectionChannels: async (connection, paginationKey) => channelQueryService.ConnectionChannels({
                    connection: connection,
                    pagination: (0, queryclient_1.createPagination)(paginationKey),
                }),
                allConnectionChannels: async (connection) => {
                    const channels = [];
                    let response;
                    let key;
                    do {
                        response = await channelQueryService.ConnectionChannels({
                            connection: connection,
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        channels.push(...response.channels);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_2.QueryConnectionChannelsResponse.fromPartial({
                        channels: channels,
                        height: response.height,
                    });
                },
                clientState: async (portId, channelId) => channelQueryService.ChannelClientState({
                    portId: portId,
                    channelId: channelId,
                }),
                consensusState: async (portId, channelId, revisionNumber, revisionHeight) => channelQueryService.ChannelConsensusState({
                    portId: portId,
                    channelId: channelId,
                    revisionNumber: BigInt(revisionNumber),
                    revisionHeight: BigInt(revisionHeight),
                }),
                packetCommitment: async (portId, channelId, sequence) => channelQueryService.PacketCommitment({
                    portId: portId,
                    channelId: channelId,
                    sequence: (0, queryclient_1.longify)(sequence),
                }),
                packetCommitments: async (portId, channelId, paginationKey) => channelQueryService.PacketCommitments({
                    channelId: channelId,
                    portId: portId,
                    pagination: (0, queryclient_1.createPagination)(paginationKey),
                }),
                allPacketCommitments: async (portId, channelId) => {
                    const commitments = [];
                    let response;
                    let key;
                    do {
                        response = await channelQueryService.PacketCommitments({
                            channelId: channelId,
                            portId: portId,
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        commitments.push(...response.commitments);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_2.QueryPacketCommitmentsResponse.fromPartial({
                        commitments: commitments,
                        height: response.height,
                    });
                },
                packetReceipt: async (portId, channelId, sequence) => channelQueryService.PacketReceipt({
                    portId: portId,
                    channelId: channelId,
                    sequence: (0, queryclient_1.longify)(sequence),
                }),
                packetAcknowledgement: async (portId, channelId, sequence) => channelQueryService.PacketAcknowledgement({
                    portId: portId,
                    channelId: channelId,
                    sequence: (0, queryclient_1.longify)(sequence),
                }),
                packetAcknowledgements: async (portId, channelId, paginationKey) => {
                    const request = query_2.QueryPacketAcknowledgementsRequest.fromPartial({
                        portId: portId,
                        channelId: channelId,
                        pagination: (0, queryclient_1.createPagination)(paginationKey),
                    });
                    return channelQueryService.PacketAcknowledgements(request);
                },
                allPacketAcknowledgements: async (portId, channelId) => {
                    const acknowledgements = [];
                    let response;
                    let key;
                    do {
                        const request = query_2.QueryPacketAcknowledgementsRequest.fromPartial({
                            channelId: channelId,
                            portId: portId,
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        response = await channelQueryService.PacketAcknowledgements(request);
                        acknowledgements.push(...response.acknowledgements);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_2.QueryPacketAcknowledgementsResponse.fromPartial({
                        acknowledgements: acknowledgements,
                        height: response.height,
                    });
                },
                unreceivedPackets: async (portId, channelId, packetCommitmentSequences) => channelQueryService.UnreceivedPackets({
                    portId: portId,
                    channelId: channelId,
                    packetCommitmentSequences: packetCommitmentSequences.map((s) => BigInt(s)),
                }),
                unreceivedAcks: async (portId, channelId, packetAckSequences) => channelQueryService.UnreceivedAcks({
                    portId: portId,
                    channelId: channelId,
                    packetAckSequences: packetAckSequences.map((s) => BigInt(s)),
                }),
                nextSequenceReceive: async (portId, channelId) => channelQueryService.NextSequenceReceive({
                    portId: portId,
                    channelId: channelId,
                }),
            },
            client: {
                state: async (clientId) => clientQueryService.ClientState({ clientId }),
                states: async (paginationKey) => clientQueryService.ClientStates({
                    pagination: (0, queryclient_1.createPagination)(paginationKey),
                }),
                allStates: async () => {
                    const clientStates = [];
                    let response;
                    let key;
                    do {
                        response = await clientQueryService.ClientStates({
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        clientStates.push(...response.clientStates);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_3.QueryClientStatesResponse.fromPartial({
                        clientStates: clientStates,
                    });
                },
                consensusState: async (clientId, consensusHeight) => clientQueryService.ConsensusState(query_3.QueryConsensusStateRequest.fromPartial({
                    clientId: clientId,
                    revisionHeight: consensusHeight !== undefined ? BigInt(consensusHeight) : undefined,
                    latestHeight: consensusHeight === undefined,
                })),
                consensusStates: async (clientId, paginationKey) => clientQueryService.ConsensusStates({
                    clientId: clientId,
                    pagination: (0, queryclient_1.createPagination)(paginationKey),
                }),
                allConsensusStates: async (clientId) => {
                    const consensusStates = [];
                    let response;
                    let key;
                    do {
                        response = await clientQueryService.ConsensusStates({
                            clientId: clientId,
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        consensusStates.push(...response.consensusStates);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_3.QueryConsensusStatesResponse.fromPartial({
                        consensusStates: consensusStates,
                    });
                },
                params: async () => clientQueryService.ClientParams({}),
                stateTm: async (clientId) => {
                    const response = await clientQueryService.ClientState({ clientId });
                    return decodeTendermintClientStateAny(response.clientState);
                },
                statesTm: async (paginationKey) => {
                    const { clientStates } = await clientQueryService.ClientStates({
                        pagination: (0, queryclient_1.createPagination)(paginationKey),
                    });
                    return clientStates.map(({ clientState }) => decodeTendermintClientStateAny(clientState));
                },
                allStatesTm: async () => {
                    const clientStates = [];
                    let response;
                    let key;
                    do {
                        response = await clientQueryService.ClientStates({
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        clientStates.push(...response.clientStates);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return clientStates.map(({ clientState }) => decodeTendermintClientStateAny(clientState));
                },
                consensusStateTm: async (clientId, consensusHeight) => {
                    const response = await clientQueryService.ConsensusState(query_3.QueryConsensusStateRequest.fromPartial({
                        clientId: clientId,
                        revisionHeight: consensusHeight?.revisionHeight,
                        revisionNumber: consensusHeight?.revisionNumber,
                        latestHeight: consensusHeight === undefined,
                    }));
                    return decodeTendermintConsensusStateAny(response.consensusState);
                },
            },
            connection: {
                connection: async (connectionId) => connectionQueryService.Connection({
                    connectionId: connectionId,
                }),
                connections: async (paginationKey) => connectionQueryService.Connections({
                    pagination: (0, queryclient_1.createPagination)(paginationKey),
                }),
                allConnections: async () => {
                    const connections = [];
                    let response;
                    let key;
                    do {
                        response = await connectionQueryService.Connections({
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        connections.push(...response.connections);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_4.QueryConnectionsResponse.fromPartial({
                        connections: connections,
                        height: response.height,
                    });
                },
                clientConnections: async (clientId) => connectionQueryService.ClientConnections({
                    clientId: clientId,
                }),
                clientState: async (connectionId) => connectionQueryService.ConnectionClientState({
                    connectionId: connectionId,
                }),
                consensusState: async (connectionId, revisionHeight) => connectionQueryService.ConnectionConsensusState(query_4.QueryConnectionConsensusStateRequest.fromPartial({
                    connectionId: connectionId,
                    revisionHeight: BigInt(revisionHeight),
                })),
            },
            transfer: {
                denomTrace: async (hash) => transferQueryService.DenomTrace({ hash: hash }),
                denomTraces: async (paginationKey) => transferQueryService.DenomTraces({
                    pagination: (0, queryclient_1.createPagination)(paginationKey),
                }),
                allDenomTraces: async () => {
                    const denomTraces = [];
                    let response;
                    let key;
                    do {
                        response = await transferQueryService.DenomTraces({
                            pagination: (0, queryclient_1.createPagination)(key),
                        });
                        denomTraces.push(...response.denomTraces);
                        key = response.pagination?.nextKey;
                    } while (key && key.length);
                    return query_1.QueryDenomTracesResponse.fromPartial({
                        denomTraces: denomTraces,
                    });
                },
                params: async () => transferQueryService.Params({}),
            },
        },
    };
}
exports.setupIbcExtension = setupIbcExtension;
//# sourceMappingURL=queries.js.map