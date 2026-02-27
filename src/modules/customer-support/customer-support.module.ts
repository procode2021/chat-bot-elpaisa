import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HandleInboundMessageUseCase } from './application/handle-inbound.usecase';
import { TOKENS } from './customer-support.tokens';
import { AdminController } from './interface/admin.controller';
import { WhatsAppWebhookController } from './interface/whatsapp-webhook.controller';
import { BusinessInfoJsonRepository } from './infrastructure/business.repo';
import { BotStateService } from './infrastructure/bot-state.service';
import { ConversationMongoRepository } from './infrastructure/conversation.mongo.repo';
import { GeminiAdapter } from './infrastructure/gemini.adapter';
import { ConversationDoc, ConversationSchema } from './infrastructure/conversation.schema';
import { createWhatsAppProvider } from './infrastructure/whatsapp/whatsapp.factory';
import { WhatsAppRuntime } from './infrastructure/whatsapp/whatsapp.runtime';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    AppointmentsModule,
    MongooseModule.forFeature([
      { name: ConversationDoc.name, schema: ConversationSchema }
    ])
  ],
  controllers: [AdminController, WhatsAppWebhookController],
  providers: [
    HandleInboundMessageUseCase,
    BotStateService,
    WhatsAppRuntime,
    { provide: TOKENS.LlmClient, useClass: GeminiAdapter },
    { provide: TOKENS.BusinessInfoRepository, useClass: BusinessInfoJsonRepository },
    { provide: TOKENS.ConversationRepository, useClass: ConversationMongoRepository },
    {
      provide: TOKENS.WhatsAppProvider,
      inject: [ConfigService],
      useFactory: createWhatsAppProvider
    }
  ]
})
export class CustomerSupportModule {}
