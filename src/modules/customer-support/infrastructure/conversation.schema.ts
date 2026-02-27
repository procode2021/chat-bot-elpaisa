import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { ChatMessage } from '../domain/chat';

@Schema({ _id: false })
export class ConversationMessage {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ required: true })
  content!: string;

  @Prop({ required: true })
  at!: Date;
}

export const ConversationMessageSchema = SchemaFactory.createForClass(ConversationMessage);

@Schema({ collection: 'conversations', timestamps: true })
export class ConversationDoc {
  @Prop({ required: true, unique: true, index: true })
  user!: string;

  @Prop({ type: [ConversationMessageSchema], default: [] })
  messages!: ChatMessage[];
}

export type ConversationDocument = HydratedDocument<ConversationDoc>;
export const ConversationSchema = SchemaFactory.createForClass(ConversationDoc);

