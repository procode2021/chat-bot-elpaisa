import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppProvider } from '../../domain/ports';
import { TOKENS } from '../../customer-support.tokens';
import { HandleInboundMessageUseCase } from '../../application/handle-inbound.usecase';
import { BotStateService } from '../bot-state.service';
import { WhatsAppWebJsProvider } from './webjs.provider';

@Injectable()
export class WhatsAppRuntime implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly usecase: HandleInboundMessageUseCase,
    private readonly botState: BotStateService,
    @Inject(TOKENS.WhatsAppProvider) private readonly provider: WhatsAppProvider
  ) { }

  async onModuleInit(): Promise<void> {
    const selected = (this.config.get<string>('WHATSAPP_PROVIDER') ?? 'cloud').toLowerCase();
    console.log(`[whatsapp] provider=${selected}`);

    try {
      await this.provider.start();
    } catch (err) {
      console.log('[whatsapp] provider start failed (server will keep running)', err);
      return;
    }

    const isWebJs = selected === 'web' || selected === 'webjs' || selected === 'whatsappweb';
    if (!isWebJs) return;

    const webProvider = this.provider as unknown as WhatsAppWebJsProvider;
    webProvider.onMessage(async (msg: any) => {
      try {
        const inbound = this.provider.parseInbound(msg);
        if (!inbound) return;

        // Avoid reacting to our own outgoing messages.
        const fromMe = Boolean((msg as any)?.fromMe);
        if (fromMe) return;

        if (!this.botState.isEnabled()) return;

        console.log(`[whatsapp-webjs] inbound event=message from=${inbound.from} text=${JSON.stringify(inbound.text)}`);

        const result = await this.usecase.execute(inbound.from, inbound.text);
        if (result.location) {
          await this.provider.sendLocation({ to: inbound.from, ...result.location });
        }
        await this.provider.sendMessage(inbound.from, result.replyText);
      } catch (err) {
        console.log('[whatsapp-webjs] message handler error', err);
      }
    });
  }
}
