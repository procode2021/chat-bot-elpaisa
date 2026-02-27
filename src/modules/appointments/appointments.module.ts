import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APPOINTMENTS_TOKENS } from './appointments.tokens';
import { AppointmentFlowService } from './application/appointment-flow.service';
import { AppointmentMongoRepository } from './infrastructure/mongoose/appointment.mongo.repo';
import { AppointmentDoc, AppointmentSchema } from './infrastructure/mongoose/appointment.schema';
import { UserSessionMongoRepository } from './infrastructure/mongoose/user-session.mongo.repo';
import { UserSessionDoc, UserSessionSchema } from './infrastructure/mongoose/user-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppointmentDoc.name, schema: AppointmentSchema },
      { name: UserSessionDoc.name, schema: UserSessionSchema }
    ])
  ],
  providers: [
    AppointmentFlowService,
    { provide: APPOINTMENTS_TOKENS.AppointmentRepository, useClass: AppointmentMongoRepository },
    { provide: APPOINTMENTS_TOKENS.UserSessionRepository, useClass: UserSessionMongoRepository }
  ],
  exports: [AppointmentFlowService, APPOINTMENTS_TOKENS.AppointmentRepository, APPOINTMENTS_TOKENS.UserSessionRepository]
})
export class AppointmentsModule {}

