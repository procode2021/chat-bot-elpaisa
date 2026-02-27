import { Inject, Injectable } from '@nestjs/common';
import type { AppointmentDraft } from '../domain/appointment';
import type { AppointmentRepository, UserSessionRepository } from '../domain/ports';
import { APPOINTMENTS_TOKENS } from '../appointments.tokens';

export interface AppointmentFlowResult {
  handled: boolean;
  replyText?: string;
}

function isAppointmentIntent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('cita') ||
    t.includes('agendar') ||
    t.includes('agenda') ||
    t.includes('agend') ||
    t.includes('turno') ||
    t.includes('examen') ||
    t.includes('optometr') ||
    t.includes('consulta')
  );
}

function parseAppointmentDraftFromText(text: string): AppointmentDraft {
  const t = String(text || '');

  const pick = (re: RegExp) => {
    const m = t.match(re);
    return m && m[1] ? String(m[1]).trim() : undefined;
  };

  const name = pick(/(?:^|\n)\s*nombre\s*[:\-]\s*(.+)\s*$/im);
  const cc = pick(/(?:^|\n)\s*(?:cc|c\.c\.|cedula|cédula|documento)\s*[:\-]\s*(.+)\s*$/im);
  const phone =
    pick(/(?:^|\n)\s*(?:tel(?:efono|éfono)?|cel(?:ular)?|whatsapp)\s*[:\-]\s*(.+)\s*$/im) ??
    pick(/(\+?\d[\d\s\-]{6,}\d)/);
  const day = pick(/(?:^|\n)\s*(?:d[ií]a|fecha)\s*(?:de\s*la\s*cita)?\s*[:\-]\s*(.+)\s*$/im);
  const time = pick(/(?:^|\n)\s*(?:hora|horario)\s*[:\-]\s*(.+)\s*$/im);

  return {
    ...(name ? { name } : {}),
    ...(cc ? { cc } : {}),
    ...(phone ? { phone } : {}),
    ...(day ? { day } : {}),
    ...(time ? { time } : {}),
    rawText: t.trim() || undefined
  };
}

function mergeDraft(a: AppointmentDraft | null, b: AppointmentDraft): AppointmentDraft {
  return {
    name: b.name ?? a?.name,
    cc: b.cc ?? a?.cc,
    phone: b.phone ?? a?.phone,
    day: b.day ?? a?.day,
    time: b.time ?? a?.time,
    rawText: b.rawText ?? a?.rawText
  };
}

function missingDraftFields(draft: AppointmentDraft): string[] {
  const missing: string[] = [];
  if (!draft.name) missing.push('Nombre');
  if (!draft.cc) missing.push('Cc');
  if (!draft.phone) missing.push('Teléfono');
  if (!draft.day) missing.push('Día de la cita');
  if (!draft.time) missing.push('Hora');
  return missing;
}

function appointmentTemplate(missing?: string[]): string {
  const header = '¡Claro! ¿Desea le agendemos la cita!';
  const fields = [
    'Datos 📋',
    `Nombre:${missing && missing.includes('Nombre') ? ' (faltante)' : ''}`,
    `Cc:${missing && missing.includes('Cc') ? ' (faltante)' : ''}`,
    `Teléfono:${missing && missing.includes('Teléfono') ? ' (faltante)' : ''}`,
    `Día de la cita:${missing && missing.includes('Día de la cita') ? ' (faltante)' : ''}`,
    `Hora:${missing && missing.includes('Hora') ? ' (faltante)' : ''}`
  ].join('\n');
  return `${header}\n\n${fields}`;
}

@Injectable()
export class AppointmentFlowService {
  constructor(
    @Inject(APPOINTMENTS_TOKENS.UserSessionRepository) private readonly sessions: UserSessionRepository,
    @Inject(APPOINTMENTS_TOKENS.AppointmentRepository) private readonly appointments: AppointmentRepository
  ) {}

  async tryHandle(from: string, text: string): Promise<AppointmentFlowResult> {
    const existingDraft = await this.sessions.getAppointmentDraft(from);
    if (existingDraft) {
      const parsed = parseAppointmentDraftFromText(text);
      const merged = mergeDraft(existingDraft, parsed);
      const missing = missingDraftFields(merged);

      if (missing.length > 0) {
        await this.sessions.setAppointmentDraft(from, merged);
        return { handled: true, replyText: `${appointmentTemplate(missing)}\n\nFaltan: ${missing.join(', ')}.` };
      }

      const appt = await this.appointments.create({
        user: from,
        name: merged.name!,
        cc: merged.cc!,
        phone: merged.phone!,
        day: merged.day!,
        time: merged.time!,
        rawText: merged.rawText
      });
      await this.sessions.clearAppointmentDraft(from);

      return {
        handled: true,
        replyText: `¡Listo! Tu cita quedó agendada.\n\nNombre: ${appt.name}\nCc: ${appt.cc}\nTeléfono: ${appt.phone}\nDía: ${appt.day}\nHora: ${appt.time}`
      };
    }

    if (isAppointmentIntent(text)) {
      await this.sessions.setAppointmentDraft(from, { rawText: text });
      return { handled: true, replyText: appointmentTemplate() };
    }

    return { handled: false };
  }
}

