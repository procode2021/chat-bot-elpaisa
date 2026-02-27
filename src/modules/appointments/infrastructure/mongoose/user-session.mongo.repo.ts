import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AppointmentDraft } from '../../domain/appointment';
import type { UserSessionRepository } from '../../domain/ports';
import { UserSessionDoc } from './user-session.schema';

@Injectable()
export class UserSessionMongoRepository implements UserSessionRepository {
  constructor(@InjectModel(UserSessionDoc.name) private readonly model: Model<UserSessionDoc>) {}

  async getAppointmentDraft(user: string): Promise<AppointmentDraft | null> {
    const doc = await this.model.findOne({ user }, { appointmentDraft: 1 }).lean().exec();
    return (doc?.appointmentDraft ?? null) as AppointmentDraft | null;
  }

  async setAppointmentDraft(user: string, draft: AppointmentDraft): Promise<void> {
    await this.model
      .updateOne(
        { user },
        { $setOnInsert: { user }, $set: { appointmentDraft: draft } },
        { upsert: true }
      )
      .exec();
  }

  async clearAppointmentDraft(user: string): Promise<void> {
    await this.model
      .updateOne({ user }, { $setOnInsert: { user }, $set: { appointmentDraft: null } }, { upsert: true })
      .exec();
  }
}

