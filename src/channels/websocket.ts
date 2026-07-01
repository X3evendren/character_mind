/**
 * WebSocket Channel — real-time bidirectional communication.
 *
 * Connects to a WebSocket server for live agent interaction.
 * Used by TUI and future Web UI clients.
 *
 * Protocol:
 *   → Incoming: { type: "message", text: string, chatId: string, senderId: string, ... }
 *   ← Outgoing: { type: "message", text: string, chatId: string, messageId: string, ... }
 */

import type { ChannelConfig, ChannelMessage, ChannelSendResult } from "./types";
import { BaseChannel } from "./types";

export interface WebSocketOptions {
  /** WebSocket server URL */
  url: string;
  /** Reconnection backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Max reconnection interval in ms (default: 30_000) */
  maxReconnectInterval?: number;
}

export class WebSocketChannel extends BaseChannel {
  public config: ChannelConfig;
  private options: WebSocketOptions;
  private ws: WebSocket | null = null;
  private handlers: Array<(msg: ChannelMessage) => Promise<void>> = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentReconnectMs: number;

  constructor(options: WebSocketOptions, config?: Partial<ChannelConfig>) {
    super();
    this.options = options;
    this.currentReconnectMs = config?.reconnectMs ?? 1000;
    this.config = {
      name: config?.name ?? "websocket",
      autoConnect: config?.autoConnect ?? true,
      reconnectMs: config?.reconnectMs ?? 2000,
      maxMessageLength: config?.maxMessageLength ?? 10000,
      options: { ...options },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.status = "connecting";

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.url);

      const timeout = setTimeout(() => {
        this.status = "error";
        reject(new Error("WebSocket connection timeout"));
      }, 15_000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.status = "connected";
        this.currentReconnectMs = this.config.reconnectMs; // reset backoff
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === "message") {
            const msg: ChannelMessage = {
              id: data.messageId ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              text: data.text ?? "",
              senderId: data.senderId ?? "unknown",
              senderName: data.senderName,
              chatId: data.chatId ?? "default",
              timestamp: data.timestamp ?? Date.now(),
              metadata: data.metadata,
              attachments: data.attachments,
            };
            this.handlers.forEach(h => h(msg).catch(() => {}));
          }
        } catch {
          // Non-JSON data — ignore
        }
      };

      this.ws.onerror = (err) => {
        clearTimeout(timeout);
        this.status = "error";
        console.error(`[ws] Connection error:`, err);
        this.scheduleReconnect();
      };

      this.ws.onclose = () => {
        this.status = "disconnected";
        this.ws = null;
        if (this.config.reconnectMs > 0) {
          this.scheduleReconnect();
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.clearReconnect();
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close(1000, "agent shutting down");
      this.ws = null;
    }
    this.status = "disconnected";
  }

  // ═══════════════════════════════════════════════════════════
  // Messaging
  // ═══════════════════════════════════════════════════════════

  async sendText(chatId: string, text: string): Promise<ChannelSendResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { success: false, error: "WebSocket not connected" };
    }

    const maxLen = this.config.maxMessageLength;
    const payload = text.length > maxLen
      ? text.slice(0, maxLen) + "\n\n[... truncated]"
      : text;

    try {
      const messageId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.ws.send(JSON.stringify({
        type: "message",
        text: payload,
        chatId,
        messageId,
        timestamp: Date.now(),
      }));
      return { success: true, messageId };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "send failed" };
    }
  }

  onMessage(handler: (msg: ChannelMessage) => Promise<void>): void {
    this.handlers.push(handler);
  }

  offMessage(handler: (msg: ChannelMessage) => Promise<void>): void {
    this.handlers = this.handlers.filter(h => h !== handler);
  }

  // ═══════════════════════════════════════════════════════════
  // Reconnection
  // ═══════════════════════════════════════════════════════════

  private scheduleReconnect(): void {
    this.clearReconnect();

    const backoff = this.options.backoffMultiplier ?? 1.5;
    const maxInterval = this.options.maxReconnectInterval ?? 30_000;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Silently fail — scheduleReconnect will be called by onerror/onclose
      });
      this.currentReconnectMs = Math.min(
        maxInterval,
        Math.round(this.currentReconnectMs * backoff),
      );
    }, this.currentReconnectMs);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
