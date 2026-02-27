import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { AppointmentDraft } from '../../domain/appointment';

@Schema({ _id: false })
export class AppointmentDraftDoc {
  @Prop()
  name?: string;

  @Prop()
  cc?: string;

  @Prop()
  phone?: string;

  @Prop()
  day?: string;

  @Prop()
  time?: string;

  @Prop()
  rawText?: string;
}

export const AppointmentDraftSchema = SchemaFactory.createForClass(AppointmentDraftDoc);

@Schema({ collection: 'user_sessions', timestamps: true })
export class UserSessionDoc {
  @Prop({ required: true, unique: true, index: true })
  user!: string;

  @Prop({ type: AppointmentDraftSchema, default: null })
  appointmentDraft!: AppointmentDraft | null;
}

export type UserSessionDocument = HydratedDocument<UserSessionDoc>;
export const UserSessionSchema = SchemaFactory.createForClass(UserSessionDoc);

