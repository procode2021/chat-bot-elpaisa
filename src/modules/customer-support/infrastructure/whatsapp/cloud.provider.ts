import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { InboundMessage } from '../../domain/chat';
import type { WhatsAppProvider } from '../../domain/ports';

@Injectable()
export class WhatsAppCloudProvider implements WhatsAppProvider {
  constructor(private readonly config: ConfigService) {}

  async start(): Promise<void> {
    return;
  }

  async resetSession(): Promise<void> {
    return;
  }

  parseInbound(payload: unknown): InboundMessage | null {
    const body: any = payload;
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = msg?.from;
    const text = msg?.text?.body;
    if (typeof from !== 'string' || typeof text !== 'string') return null;
    return { from, text, raw: payload };
  }

  async sendMessage(to: string, text: string): Promise<void> {
    const accessToken = this.config.get<string>('WA_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WA_PHONE_NUMBER_ID');
    const version = this.config.get<string>('WA_GRAPH_VERSION') ?? 'v20.0';
    if (!accessToken || !phoneNumberId) return;

    await axios.post(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15_000
      }
    );
  }

  async sendLocation(input: {
    to: string;
    lat: number;
    lng: number;
    address?: string;
    name?: string;
  }): Promise<void> {
    const accessToken = this.config.get<string>('WA_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WA_PHONE_NUMBER_ID');
    const version = this.config.get<string>('WA_GRAPH_VERSION') ?? 'v20.0';
    if (!accessToken || !phoneNumberId) return;

    await axios.post(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'location',
        location: {
          latitude: input.lat,
          longitude: input.lng,
          ...(input.name ? { name: input.name } : {}),
          ...(input.address ? { address: input.address } : {})
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15_000
      }
    );
  }
}
