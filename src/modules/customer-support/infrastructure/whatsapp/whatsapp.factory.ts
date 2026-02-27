import { ConfigService } from '@nestjs/config';
import type { WhatsAppProvider } from '../../domain/ports';
import { WhatsAppCloudProvider } from './cloud.provider';
import { WhatsAppWebJsProvider } from './webjs.provider';

export function createWhatsAppProvider(config: ConfigService): WhatsAppProvider {
  const provider = (config.get<string>('WHATSAPP_PROVIDER') ?? 'cloud').toLowerCase();
  if (provider === 'web' || provider === 'webjs' || provider === 'whatsappweb') {
    return new WhatsAppWebJsProvider(config);
  }
  return new WhatsAppCloudProvider(config);
}

