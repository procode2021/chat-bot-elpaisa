import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleInboundMessageUseCase } from '../application/handle-inbound.usecase';
import type { WhatsAppProvider } from '../domain/ports';
import { TOKENS } from '../customer-support.tokens';
import { BotStateService } from '../infrastructure/bot-state.service';

@Controller('webhook')
export class WhatsAppWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly botState: BotStateService,
    private readonly usecase: HandleInboundMessageUseCase,
    @Inject(TOKENS.WhatsAppProvider) private readonly provider: WhatsAppProvider
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string
  ) {
    const verifyToken = this.config.get<string>('WA_VERIFY_TOKEN');
    if (mode === 'subscribe' && verifyToken && token === verifyToken && challenge) {
      return challenge;
    }
    return 'OK';
  }

  @Post()
  async receive(@Body() body: unknown) {
    const inbound = this.provider.parseInbound(body);
    if (!inbound) return { ok: true };
    if (!this.botState.isEnabled()) return { ok: true, disabled: true };

    const result = await this.usecase.execute(inbound.from, inbound.text);
    if (result.location) {
      await this.provider.sendLocation({ to: inbound.from, ...result.location });
    }
    await this.provider.sendMessage(inbound.from, result.replyText);
    return { ok: true };
  }
}
