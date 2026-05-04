import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage } from '../domain/chat';
import type { LlmClient } from '../domain/ports';

type QuickReply =
  | string
  | {
      trigger?: string;
      when?: string;
      reply?: string;
      text?: string;
      response?: string;
    };

function getQuickReplies(business: any): string[] {
  const raw = business?.bot?.quickReplies;
  if (!raw) return [];
  const list: QuickReply[] = Array.isArray(raw) ? raw : [raw];

  return list
    .map(item => {
      if (!item) return null;
      if (typeof item === 'string') return item.trim() || null;

      const trigger =
        typeof item.trigger === 'string'
          ? item.trigger.trim()
          : typeof item.when === 'string'
            ? item.when.trim()
            : '';
      const reply =
        typeof item.reply === 'string'
          ? item.reply.trim()
          : typeof item.text === 'string'
            ? item.text.trim()
            : typeof item.response === 'string'
              ? item.response.trim()
              : '';

      if (!trigger && !reply) return null;
      if (!trigger) return reply || null;
      if (!reply) return `Si el usuario pregunta: "${trigger}", responde apropiadamente.`;
      return `Si el usuario pregunta: "${trigger}", responde exactamente:\n${reply}`;
    })
    .filter((x): x is string => Boolean(x));
}

@Injectable()
export class GeminiAdapter implements LlmClient {
  private client: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new Error('Missing GEMINI_API_KEY');
    this.client = new GoogleGenerativeAI(key);
  }

  async reply(input: {
    message: string;
    context: ChatMessage[];
    business: unknown;
  }): Promise<string> {
    const modelName = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-1.5-flash';
    const model = this.client.getGenerativeModel({ model: modelName });

    const data: any = input.business as any;
    const instructions =
      typeof data?.bot?.instructions === 'string' && data.bot.instructions.trim()
        ? `\n\nInstrucciones del bot:\n${data.bot.instructions.trim()}\n`
        : '';

    const quickReplies = getQuickReplies(data);
    const quickRepliesText =
      quickReplies.length > 0
        ? `\n\nRespuestas rapidas (usalas cuando apliquen; si piden "agregar filtros digital", pregunta que filtro y cotiza adicional):\n- ${quickReplies.join('\n- ')}\n`
        : '';

    const prompt = `
Eres un asistente de WhatsApp para informacion general, promociones, precios y dudas frecuentes.
Responde SOLO usando estos datos. No inventes precios, sedes, horarios, garantias ni promociones.
Cuando exista una respuesta rapida aplicable, dale prioridad y responde de forma breve y clara.
No recojas datos personales para citas dentro del chat.

${JSON.stringify(input.business, null, 2)}
${instructions}${quickRepliesText}
Conversacion:
${input.context.map(c => `${c.role}: ${c.content}`).join('\n')}

Usuario: ${input.message}
`.trim();

    const result = await model.generateContent(prompt);
    return result.response.text() ?? 'No pude generar respuesta.';
  }
}
