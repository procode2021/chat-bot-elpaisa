import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Appointment, AppointmentInput } from '../../domain/appointment';
import type { AppointmentRepository } from '../../domain/ports';
import { AppointmentDoc } from './appointment.schema';

@Injectable()
export class AppointmentMongoRepository implements AppointmentRepository {
  constructor(@InjectModel(AppointmentDoc.name) private readonly model: Model<AppointmentDoc>) {}

  async create(input: AppointmentInput): Promise<Appointment> {
    const created = await this.model.create({
      user: input.user,
      name: input.name,
      cc: input.cc,
      phone: input.phone,
      day: input.day,
      time: input.time,
      rawText: input.rawText
    });

    return {
      id: String((created as any)._id),
      user: created.user,
      name: created.name,
      cc: created.cc,
      phone: created.phone,
      day: created.day,
      time: created.time,
      rawText: created.rawText,
      createdAt: (created as any).createdAt ?? new Date()
    };
  }

  async list(input?: { limit?: number }): Promise<Appointment[]> {
    const limit = Math.min(2000, Math.max(1, Number(input?.limit ?? 200)));
    const docs = await this.model
      .find({}, {}, { sort: { createdAt: -1 }, limit })
      .lean()
      .exec();

    return docs.map((d: any) => ({
      id: String(d._id),
      user: String(d.user),
      name: String(d.name),
      cc: String(d.cc),
      phone: String(d.phone),
      day: String(d.day),
      time: String(d.time),
      rawText: typeof d.rawText === 'string' ? d.rawText : undefined,
      createdAt: d.createdAt ? new Date(d.createdAt) : new Date()
    }));
  }
}

