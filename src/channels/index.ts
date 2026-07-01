/**
 * Channels — communication layer.
 *
 * Abstraction between the agent and external communication platforms.
 */

export { BaseChannel, type ChannelConfig, type ChannelMessage, type ChannelSendResult, type ChannelStatus } from "./types";
export { ChannelRegistry, type ChannelState } from "./registry";
export { WebSocketChannel, type WebSocketOptions } from "./websocket";
