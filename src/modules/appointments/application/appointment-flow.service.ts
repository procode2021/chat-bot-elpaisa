import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppointmentFlowResult {
  handled: boolean;
  replyText?: string;
}

const DEFAULT_FORM_URL = 'https://opticaelpaisa.com.co';
const DEFAULT_ADVISOR_PHONE = '573205894045';
const ADVISOR_MESSAGE = 'quiero apartar una cita';

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function includesAny(text: string, words: string[]): boolean {
  return words.some(word => text.includes(word));
}

function wantsAppointmentLink(text: string): boolean {
  const t = normalize(text);
  return (
    t === '1' ||
    includesAny(t, [
      'apartar cita',
      'apartar una cita',
      'agendar cita',
      'sacar cita',
      'pedir cita',
      'formulario',
      'quiero cita',
      'quiero apartar'
    ])
  );
}

function wantsAdvisor(text: string): boolean {
  const t = normalize(text);
  return (
    t === '2' ||
    includesAny(t, [
      'asesor',
      'humano',
      'persona',
      'vendedor',
      'atencion',
      'hablar con alguien',
      'whatsapp'
    ])
  );
}

function shouldOfferNextStep(text: string): boolean {
  const t = normalize(text);
  return includesAny(t, [
    'precio',
    'precios',
    'cuanto vale',
    'cuanto cuesta',
    'cotizar',
    'cotizacion',
    'promocion',
    'promociones',
    'lentes',
    'montura',
    'monturas',
    'examen',
    'optometr',
    'consulta',
    'cita',
    'agendar',
    'apartar'
  ]);
}

function buildAdvisorUrl(rawUrl: string | undefined, rawPhone: string | undefined): string {
  if (rawUrl?.trim()) return rawUrl.trim();

  const phone = (rawPhone?.trim() || DEFAULT_ADVISOR_PHONE).replace(/[^\d]/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(ADVISOR_MESSAGE)}`;
}

@Injectable()
export class AppointmentFlowService {
  constructor(private readonly config: ConfigService) {}

  async tryHandle(from: string, text: string): Promise<AppointmentFlowResult> {
    if (wantsAppointmentLink(text)) {
      return { handled: true, replyText: this.buildAppointmentLinkMessage() };
    }

    if (wantsAdvisor(text)) {
      return { handled: true, replyText: this.buildAdvisorMessage() };
    }

    return { handled: false };
  }

  shouldOfferActions(text: string): boolean {
    return shouldOfferNextStep(text);
  }

  buildActionPrompt(): string {
    return [
      '',
      'Si deseas apartar una cita, elige una opcion:',
      '',
      '1. Apartar una cita por formulario',
      '2. Hablar con un asesor por WhatsApp'
    ].join('\n');
  }

  buildAppointmentLinkMessage(): string {
    const formUrl = this.config.get<string>('APPOINTMENT_FORM_URL')?.trim() || DEFAULT_FORM_URL;
    return [
      'Para apartar tu cita, abre este formulario:',
      formUrl,
      '',
      'Tambien puedes responder 2 si prefieres hablar con un asesor.'
    ].join('\n');
  }

  buildAdvisorMessage(): string {
    const advisorUrl = buildAdvisorUrl(
      this.config.get<string>('ADVISOR_WHATSAPP_URL'),
      this.config.get<string>('ADVISOR_WHATSAPP_PHONE')
    );

    return [
      'Para hablar con un asesor, abre este chat:',
      advisorUrl,
      '',
      `El mensaje ya va preparado con: "${ADVISOR_MESSAGE}".`
    ].join('\n');
  }
}
