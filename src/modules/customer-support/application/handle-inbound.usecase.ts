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

function isLocationRequest(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('ubicacion') ||
    t.includes('ubicación') ||
    t.includes('direccion') ||
    t.includes('dirección') ||
    t.includes('donde queda') ||
    t.includes('dónde queda') ||
    t.includes('maps') ||
    t.includes('google maps') ||
    t.includes('como llego') ||
    t.includes('cómo llego')
  );
}

function getBusinessLocation(businessData: any): BusinessLocation | undefined {
  const location =
    businessData?.business?.location ??
    businessData?.location ??
    (businessData?.latitud != null && businessData?.longitud != null
      ? {
          address: businessData?.ubicacion,
          lat: Number(businessData?.latitud),
          lng: Number(businessData?.longitud)
        }
      : undefined);

  if (!location) return undefined;

  const lat = Number(location.lat ?? location.latitude ?? location.latitud);
  const lng = Number(location.lng ?? location.longitude ?? location.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

  const address = typeof location.address === 'string' ? location.address : undefined;
  const name =
    typeof location.name === 'string'
      ? location.name
      : typeof businessData?.business?.name === 'string'
        ? businessData.business.name
        : undefined;

  return { lat, lng, address, name };
}

@Injectable()
export class HandleInboundMessageUseCase {
  constructor(
    private readonly config: ConfigService,
    @Inject(TOKENS.LlmClient) private readonly llm: LlmClient,
    @Inject(TOKENS.BusinessInfoRepository) private readonly business: BusinessInfoRepository,
    @Inject(TOKENS.ConversationRepository) private readonly conversation: ConversationRepository,
    private readonly appointmentFlow: AppointmentFlowService
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

    const businessData = await this.business.getBusinessInfo();
    const location = isLocationRequest(text) ? getBusinessLocation(businessData) : undefined;

    if (location) {
      const addressText = location.address ? `\nDirección: ${location.address}` : '';
      const replyText = `Aquí está nuestra ubicación.${addressText}`;

      const assistantMsg: ChatMessage = { role: 'assistant', content: replyText, at: new Date() };
      await this.conversation.append(from, assistantMsg, maxStore);

      return { replyText, location };
    }

    const context = await this.conversation.getLast(from, maxMessages);
    const replyText = await this.llm.reply({ message: text, context, business: businessData });

    const assistantMsg: ChatMessage = { role: 'assistant', content: replyText, at: new Date() };
    await this.conversation.append(from, assistantMsg, maxStore);

    return { replyText };
  }
}
