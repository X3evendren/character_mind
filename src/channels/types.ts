/**
 * Channel Types — communication channel system.
 *
 * Ported from nanobot/channels/base.py. Channels are the abstraction
 * between the agent and external communication platforms (WebSocket,
 * Telegram, 飞书, QQ, etc.).
 */

// ═══════════════════════════════════════════════════════════════
// Core types
// ═══════════════════════════════════════════════════════════════

export type ChannelStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ChannelMessage {
  /** Unique message ID from the platform */
  id: string;
  /** Text content (may include markdown) */
  text: string;
  /** Sender identifier (platform-specific) */
  senderId: string;
  /** Sender display name */
  senderName?: string;
  /** Chat/room/thread ID */
  chatId: string;
  /** Timestamp (Unix ms) */
  timestamp: number;
  /** Platform-specific metadata */
  metadata?: Record<string, unknown>;
  /** Attachments (files, images, etc.) */
  attachments?: Array<{
    type: "image" | "file" | "audio" | "video";
    url?: string;
    mimeType?: string;
    data?: Buffer;
    name?: string;
    size?: number;
  }>;
}

export interface ChannelSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ChannelConfig {
  /** Unique channel name (e.g., "websocket", "telegram") */
  name: string;
  /** Whether to auto-connect on agent startup */
  autoConnect: boolean;
  /** Reconnect interval in ms (0 = no reconnect) */
  reconnectMs: number;
  /** Max message length (truncation applied by channel) */
  maxMessageLength: number;
  /** Platform-specific options */
  options?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// Base class (abstract)
// ═══════════════════════════════════════════════════════════════

export abstract class BaseChannel {
  abstract readonly config: ChannelConfig;
  protected status: ChannelStatus = "disconnected";

  get isConnected(): boolean {
    return this.status === "connected";
  }

  get state(): ChannelStatus {
    return this.status;
  }

  /** Connect to the platform */
  abstract connect(): Promise<void>;

  /** Disconnect gracefully */
  abstract disconnect(): Promise<void>;

  /** Send a message from the agent to the channel */
  abstract sendText(chatId: string, text: string): Promise<ChannelSendResult>;

  /** Send a message with attachments */
  async sendMessage(msg: Omit<ChannelMessage, "id" | "timestamp" | "senderId">): Promise<ChannelSendResult> {
    // Default implementation: send text, ignore attachments
    return this.sendText(msg.chatId, msg.text);
  }

  /** Register a callback for incoming messages */
  abstract onMessage(handler: (msg: ChannelMessage) => Promise<void>): void;

  /** Remove a message handler */
  abstract offMessage(handler: (msg: ChannelMessage) => Promise<void>): void;
}
