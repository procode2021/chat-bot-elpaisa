import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'appointments', timestamps: true })
export class AppointmentDoc {
  @Prop({ required: true, index: true })
  user!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  cc!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  day!: string;

  @Prop({ required: true })
  time!: string;

  @Prop()
  rawText?: string;
}

export type AppointmentDocument = HydratedDocument<AppointmentDoc>;
export const AppointmentSchema = SchemaFactory.createForClass(AppointmentDoc);

