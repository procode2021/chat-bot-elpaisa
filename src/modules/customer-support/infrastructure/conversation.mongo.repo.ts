import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ChatMessage } from '../domain/chat';
import type { ConversationRepository } from '../domain/ports';
import { ConversationDoc } from './conversation.schema';

@Injectable()
export class ConversationMongoRepository implements ConversationRepository {
  constructor(@InjectModel(ConversationDoc.name) private readonly model: Model<ConversationDoc>) {}

  async getLast(user: string, limit: number): Promise<ChatMessage[]> {
    const doc = await this.model
      .findOne({ user }, { messages: { $slice: -Math.max(0, limit) } })
      .lean()
      .exec();
    return (doc?.messages ?? []) as ChatMessage[];
  }

  async append(user: string, msg: ChatMessage, maxSize = 200): Promise<void> {
    const slice = -Math.max(1, maxSize);
    await this.model
      .updateOne(
        { user },
        {
          $setOnInsert: { user },
          $push: { messages: { $each: [msg], $slice: slice } }
        },
        { upsert: true }
      )
      .exec();
  }
}
