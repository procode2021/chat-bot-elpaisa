export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  at: Date;
}

export interface InboundMessage {
  from: string;
  text: string;
  raw?: unknown;
}

