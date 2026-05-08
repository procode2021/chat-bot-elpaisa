import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatMessage } from '../domain/chat';
import type { BusinessLocation } from '../domain/location';
import type { BusinessInfoRepository, ConversationRepository, LlmClient } from '../domain/ports';
import { TOKENS } from '../customer-support.tokens';
import { AppointmentFlowService } from '../../appointments/application/appointment-flow.service';

export interface InboundResult {
  replyText: string;
  location?: BusinessLocation;
}

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getLocationKeywords(businessData: any): string[] {
  const defaults = ['ubicacion', 'direccion', 'donde queda', 'maps', 'google maps', 'como llego', 'como llegar'];
  const raw = businessData?.bot?.locationFlow?.keywords;
  if (!Array.isArray(raw)) return defaults;
  const normalized = raw
    .map((x: unknown) => normalize(String(x || '')))
    .filter((x: string) => x.length > 0);
  return normalized.length ? normalized : defaults;
}

function isLocationRequest(text: string, businessData: any): boolean {
  const t = normalize(text);
  const keywords = getLocationKeywords(businessData);
  return keywords.some((k) => t.includes(k));
}

function detectSede(text: string, businessData: any): string | null {
  const t = normalize(text);
  const locations = businessData?.business?.locations ?? {};
  for (const [key, value] of Object.entries(locations)) {
    const keyText = normalize(String(key));
    const nameText = normalize(String((value as any)?.name ?? key));
    if (t.includes(keyText) || t.includes(nameText)) return String(key);
  }
  return null;
}

function getLocationForSede(businessData: any, sede: string): BusinessLocation | undefined {
  const loc = businessData?.business?.locations?.[sede];
  if (!loc) return undefined;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return {
    lat,
    lng,
    address: loc.address,
    name: loc.name ?? sede,
  };
}

function buildLocationsPrompt(businessData: any): string {
  const locations = businessData?.business?.locations ?? {};
  const keys = Object.keys(locations);
  if (!keys.length) {
    return 'No tenemos sedes configuradas en este momento. Deseas que te contacte un asesor?';
  }

  const intro =
    String(businessData?.bot?.locationFlow?.introMessage || '').trim() ||
    'Hola, gracias por preferirnos. Contamos con estas sedes:';
  const question =
    String(businessData?.bot?.locationFlow?.questionMessage || '').trim() ||
    'A cual sede deseas que te enviemos la ubicacion en el mapa?';

  const lines: string[] = [intro, ''];
  for (const key of keys) {
    const item = locations[key] ?? {};
    const name = String(item.name ?? key);
    const address = String(item.address ?? '').trim();
    const phone = String(item.phone ?? '').trim();
    lines.push(`?? *${name}:* ${address || 'Direccion por confirmar'}${phone ? `\n?? ${phone}` : ''}\n`);
  }
  lines.push(question);
  return lines.join('\n');
}

@Injectable()
export class HandleInboundMessageUseCase {
  constructor(
    private readonly config: ConfigService,
    @Inject(TOKENS.LlmClient) private readonly llm: LlmClient,
    @Inject(TOKENS.BusinessInfoRepository) private readonly business: BusinessInfoRepository,
    @Inject(TOKENS.ConversationRepository) private readonly conversation: ConversationRepository,
    private readonly appointmentFlow: AppointmentFlowService,
  ) {}

  async execute(from: string, text: string): Promise<InboundResult> {
    const maxMessages = Number(this.config.get('CONTEXT_MAX_MESSAGES') ?? 10);
    const maxStore = Math.max(20, maxMessages * 2);

    const userMsg: ChatMessage = { role: 'user', content: text, at: new Date() };
    await this.conversation.append(from, userMsg, maxStore);

    const apptFlow = await this.appointmentFlow.tryHandle(from, text);
    if (apptFlow.handled && apptFlow.replyText) {
      const assistantMsg: ChatMessage = { role: 'assistant', content: apptFlow.replyText, at: new Date() };
      await this.conversation.append(from, assistantMsg, maxStore);
      return { replyText: apptFlow.replyText };
    }

    const businessData = (await this.business.getBusinessInfo()) as any;

    if (isLocationRequest(text, businessData)) {
      const sede = detectSede(text, businessData);

      if (sede) {
        const location = getLocationForSede(businessData, sede);
        const sedeData = businessData?.business?.locations?.[sede];
        const address = sedeData?.address ?? '';
        const phone = sedeData?.phone ?? '';
        const replyText = `?? *Sede ${sedeData?.name ?? sede}*\n${address}${phone ? '\n?? ' + phone : ''}`;
        const assistantMsg: ChatMessage = { role: 'assistant', content: replyText, at: new Date() };
        await this.conversation.append(from, assistantMsg, maxStore);
        return { replyText, location };
      }

      const replyText = buildLocationsPrompt(businessData);
      const assistantMsg: ChatMessage = { role: 'assistant', content: replyText, at: new Date() };
      await this.conversation.append(from, assistantMsg, maxStore);
      return { replyText };
    }

    const context = await this.conversation.getLast(from, maxMessages);
    let replyText = await this.llm.reply({ message: text, context, business: businessData });

    if (this.appointmentFlow.shouldOfferActions(text)) {
      replyText = `${replyText}\n${this.appointmentFlow.buildActionPrompt()}`;
    }

    const assistantMsg: ChatMessage = { role: 'assistant', content: replyText, at: new Date() };
    await this.conversation.append(from, assistantMsg, maxStore);

    return { replyText };
  }
}
