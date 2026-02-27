import { Injectable } from '@nestjs/common';
import type { ChatMessage } from '../domain/chat';
import type { ConversationRepository } from '../domain/ports';

@Injectable()
export class ConversationMemoryRepository implements ConversationRepository {
  private store = new Map<string, ChatMessage[]>();

  async getLast(user: string, limit: number): Promise<ChatMessage[]> {
    const all = this.store.get(user) ?? [];
    return all.slice(-limit);
  }

  async append(user: string, msg: ChatMessage, maxSize = 200): Promise<void> {
    const all = this.store.get(user) ?? [];
    all.push(msg);
    this.store.set(user, all.length > maxSize ? all.slice(-maxSize) : all);
  }
}

