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

/** Detecta si el usuario mencionó una sede específica */
function detectSede(text: string): 'monteria' | 'lorica' | null {
  const t = text.toLowerCase();
  if (t.includes('monteria') || t.includes('montería')) return 'monteria';
  if (t.includes('lorica') || t.includes('lórica')) return 'lorica';
  return null;
}

function getLocationForSede(businessData: any, sede: 'monteria' | 'lorica'): BusinessLocation | undefined {
  const loc = businessData?.business?.locations?.[sede];
  if (!loc) return undefined;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return {
    lat,
    lng,
    address: loc.address,
    name: loc.name ?? sede
  };
}

@Injectable()
export class HandleInboundMessageUseCase {
  constructor(
    private readonly config: ConfigService,
    @Inject(TOKENS.LlmClient) private readonly llm: LlmClient,
    @Inject(TOKENS.BusinessInfoRepository) private readonly business: BusinessInfoRepository,
    @Inject(TOKENS.ConversationRepository) private readonly conversation: ConversationRepository,
    private readonly appointmentFlow: AppointmentFlowService
  ) { }

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

    if (isLocationRequest(text)) {
      const sede = detectSede(text);

      if (sede) {
        // El usuario ya indicó la sede → enviar ubicación con mapa
        const location = getLocationForSede(businessData, sede);
        const sedeData = businessData?.business?.locations?.[sede];
        const address = sedeData?.address ?? '';
        const phone = sedeData?.phone ?? '';
        const replyText = `📍 *Sede ${sedeData?.name ?? sede}*\n${address}${phone ? '\n📞 ' + phone : ''}`;
        const assistantMsg: ChatMessage = { role: 'assistant', content: replyText, at: new Date() };
        await this.conversation.append(from, assistantMsg, maxStore);
        return { replyText, location };
      } else {
        // El usuario NO indicó sede → preguntar cuál
        const replyText =
          'Hola, gracias por preferirnos 🤓 Contamos con dos sedes:\n\n' +
          '📍 *Montería:* Cra 2 #29-29 Centro, Montería\n📞 +57 320 589 4045\n\n' +
          '📍 *Lorica:* Calle Principal #12-34, Lorica\n📞 +57 310 411 7433\n\n' +
          '¿A cuál sede desea que le enviemos la ubicación en el mapa? 🗺️';
        const assistantMsg: ChatMessage = { role: 'assistant', content: replyText, at: new Date() };
        await this.conversation.append(from, assistantMsg, maxStore);
        return { replyText };
      }
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
