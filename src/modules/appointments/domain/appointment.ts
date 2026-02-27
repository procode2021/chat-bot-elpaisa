export interface AppointmentInput {
  user: string;
  name: string;
  cc: string;
  phone: string;
  day: string;
  time: string;
  rawText?: string;
}

export interface Appointment extends AppointmentInput {
  id: string;
  createdAt: Date;
}

export interface AppointmentDraft {
  name?: string;
  cc?: string;
  phone?: string;
  day?: string;
  time?: string;
  rawText?: string;
}

