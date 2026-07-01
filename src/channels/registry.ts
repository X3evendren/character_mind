/**
 * ChannelRegistry — manage communication channels.
 *
 * Registers, connects, and monitors channels. Routes incoming messages
 * from all channels to the agent, and agent responses back to channels.
 */

import type { BaseChannel, ChannelMessage, ChannelStatus } from "./types";

export interface ChannelState {
  name: string;
  status: ChannelStatus;
  connectedAt?: number;
  error?: string;
  messageCount: number;
}

export class ChannelRegistry {
  private channels = new Map<string, BaseChannel>();
  private handlers: Array<(msg: ChannelMessage) => Promise<void>> = [];
  private _agentHandler: ((msg: ChannelMessage, channelName: string) => Promise<string>) | null = null;

  /** Register a channel */
  register(channel: BaseChannel): void {
    const name = channel.config.name;
    if (this.channels.has(name)) {
      throw new Error(`Channel "${name}" is already registered`);
    }
    this.channels.set(name, channel);

    // Wire up incoming messages → agent handler
    channel.onMessage(async (msg: ChannelMessage) => {
      for (const handler of this.handlers) {
        try {
          await handler(msg);
        } catch (err: any) {
          console.error(`[channel:${name}] handler error:`, err.message);
        }
      }

      // Route to agent
      if (this._agentHandler) {
        try {
          const reply = await this._agentHandler(msg, name);
          if (reply) {
            await channel.sendText(msg.chatId, reply);
          }
        } catch (err: any) {
          console.error(`[channel:${name}] agent handler error:`, err.message);
        }
      }
    });
  }

  /** Set the agent message handler (receives all incoming messages) */
  setAgentHandler(handler: (msg: ChannelMessage, channelName: string) => Promise<string>): void {
    this._agentHandler = handler;
  }

  /** Add a general message handler (for logging, monitoring, etc.) */
  addHandler(handler: (msg: ChannelMessage) => Promise<void>): void {
    this.handlers.push(handler);
  }

  /** Remove a handler */
  removeHandler(handler: (msg: ChannelMessage) => Promise<void>): void {
    this.handlers = this.handlers.filter(h => h !== handler);
  }

  /** Get a specific channel */
  get(name: string): BaseChannel | undefined {
    return this.channels.get(name);
  }

  /** Connect all channels with autoConnect enabled */
  async connectAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      if (channel.config.autoConnect) {
        try {
          await channel.connect();
        } catch (err: any) {
          console.error(`[channel:${channel.config.name}] connect error:`, err.message);
        }
      }
    }
  }

  /** Disconnect all channels */
  async disconnectAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      try {
        await channel.disconnect();
      } catch (err: any) {
        console.error(`[channel:${channel.config.name}] disconnect error:`, err.message);
      }
    }
  }

  /** Send a message to a specific channel */
  async sendTo(channelName: string, chatId: string, text: string): Promise<boolean> {
    const channel = this.channels.get(channelName);
    if (!channel) return false;
    const result = await channel.sendText(chatId, text);
    return result.success;
  }

  /** Get state of all channels for monitoring */
  getStates(): ChannelState[] {
    return [...this.channels.values()].map(ch => ({
      name: ch.config.name,
      status: ch.state,
      messageCount: 0,
    }));
  }
}
