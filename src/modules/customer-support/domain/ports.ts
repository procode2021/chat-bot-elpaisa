import type { ChatMessage, InboundMessage } from './chat';

export interface LlmClient {
  reply(input: {
    message: string;
    context: ChatMessage[];
    business: unknown;
  }): Promise<string>;
}

export interface BusinessInfoRepository {
  getBusinessInfo(): Promise<unknown>;
}

export interface ConversationRepository {
  getLast(user: string, limit: number): Promise<ChatMessage[]>;
  append(user: string, msg: ChatMessage, maxSize?: number): Promise<void>;
}

export interface WhatsAppProvider {
  start(): Promise<void>;
  resetSession(): Promise<void>;
  parseInbound(payload: unknown): InboundMessage | null;
  sendMessage(to: string, text: string): Promise<void>;
  sendLocation(input: { to: string; lat: number; lng: number; address?: string; name?: string }): Promise<void>;
}
