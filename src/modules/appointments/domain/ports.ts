import type { Appointment, AppointmentDraft, AppointmentInput } from './appointment';

export interface AppointmentRepository {
  create(input: AppointmentInput): Promise<Appointment>;
  list(input?: { limit?: number }): Promise<Appointment[]>;
}

export interface UserSessionRepository {
  getAppointmentDraft(user: string): Promise<AppointmentDraft | null>;
  setAppointmentDraft(user: string, draft: AppointmentDraft): Promise<void>;
  clearAppointmentDraft(user: string): Promise<void>;
}

