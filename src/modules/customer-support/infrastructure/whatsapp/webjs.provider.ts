import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qrcode from 'qrcode-terminal';
import { Client, LocalAuth, Location, type Message } from 'whatsapp-web.js';
import { existsSync } from 'fs';
import { BotStateService } from '../bot-state.service';
import type { InboundMessage } from '../../domain/chat';
import type { WhatsAppProvider } from '../../domain/ports';

@Injectable()
export class WhatsAppWebJsProvider implements WhatsAppProvider {
  private client: Client | null = null;
  private authenticatedOnce = false;
  private readyOnce = false;
  private readyWatchdog: NodeJS.Timeout | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly botState: BotStateService
  ) { }

  private resolveBrowserExecutablePath(): string | undefined {
    const explicit = this.config.get<string>('WA_WEB_EXECUTABLE_PATH') || undefined;
    if (explicit && existsSync(explicit)) return explicit;

    const candidates = [
      // Chrome (64-bit)
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      // Chrome (32-bit)
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      // Edge (64-bit)
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      // Edge (32-bit)
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];

    for (const p of candidates) {
      if (existsSync(p)) return p;
    }

    return undefined;
  }

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async restart(reason: string): Promise<void> {
    console.log(`[whatsapp-webjs] restarting (${reason})`);
    if (this.readyWatchdog) clearTimeout(this.readyWatchdog);
    this.readyWatchdog = null;

    const c = this.client;
    this.client = null;
    this.authenticatedOnce = false;
    this.readyOnce = false;

    try {
      await (c as any)?.destroy?.();
    } catch { }
  }

  private async startInternal(): Promise<void> {
    if (this.client) return;

    const clientId = this.config.get<string>('WA_WEB_CLIENT_ID') ?? 'bot-1';
    console.log(`[whatsapp-webjs] starting (clientId=${clientId})`);

    const maxRetries = Math.min(10, Math.max(1, Number(this.config.get('WA_WEB_START_RETRIES') ?? 3)));
    const baseDelayMs = Math.min(30_000, Math.max(250, Number(this.config.get('WA_WEB_START_RETRY_DELAY_MS') ?? 1_000)));

    const executablePath = this.resolveBrowserExecutablePath();
    if (executablePath) console.log(`[whatsapp-webjs] browser=${executablePath}`);
    else console.log('[whatsapp-webjs] browser=auto (not found), relying on puppeteer defaults');

    const headlessRaw = String(this.config.get<string>('WA_WEB_HEADLESS') ?? 'true').toLowerCase();
    const headless = !(headlessRaw === '0' || headlessRaw === 'false' || headlessRaw === 'no');
    const readyTimeoutMs = Math.min(
      180_000,
      Math.max(10_000, Number(this.config.get('WA_WEB_READY_TIMEOUT_MS') ?? 60_000))
    );

    const makeClient = () =>
      new Client({
        authStrategy: new LocalAuth({ clientId }),
        restartOnAuthFail: true,
        webVersionCache: { type: 'none' },
        puppeteer: {
          ...(executablePath ? { executablePath } : {}),
          headless,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      } as any);

    const attachEvents = (client: Client) => {
      client.on('qr', (qr: string) => {
        try {
          console.log('[whatsapp-webjs] qr received');
          this.botState.setQrCode(qr);
          qrcode.generate(qr, { small: true });
        } catch (err) {
          console.log('[whatsapp-webjs] qr render error', err);
        }
      });
      client.on('authenticated', () => {
        this.authenticatedOnce = true;
        this.botState.setQrCode(null);
        console.log('[whatsapp-webjs] authenticated');

        if (this.readyWatchdog) clearTimeout(this.readyWatchdog);
        this.readyWatchdog = setTimeout(() => {
          if (this.readyOnce) return;
          void this.restart(`ready timeout after ${readyTimeoutMs}ms`).then(() => void this.start());
        }, readyTimeoutMs);
      });
      client.on('auth_failure', (msg: string) => console.log(`[whatsapp-webjs] auth_failure: ${msg}`));
      client.on('disconnected', (reason: string) => console.log(`[whatsapp-webjs] disconnected: ${reason}`));
      client.on('ready', () => {
        this.readyOnce = true;
        this.botState.setQrCode(null);
        if (this.readyWatchdog) clearTimeout(this.readyWatchdog);
        this.readyWatchdog = null;
        console.log('[whatsapp-webjs] ready');
      });
      client.on('change_state', (state: string) => console.log(`[whatsapp-webjs] change_state=${state}`));
      client.on('loading_screen', (percent: number, message: string) =>
        console.log(`[whatsapp-webjs] loading_screen=${percent}% ${message}`)
      );
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.authenticatedOnce = false;
      this.readyOnce = false;
      this.client = makeClient();
      attachEvents(this.client);

      try {
        await this.client.initialize();
        return;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        console.log(`[whatsapp-webjs] initialize error (attempt ${attempt}/${maxRetries})`, err);

        // Common transient Puppeteer error: "Execution context was destroyed."
        // Before authentication, it's safe to recreate the client.
        if (!this.authenticatedOnce) {
          await this.restart(`initialize failed: ${msg}`);
        }

        const delay = Math.min(60_000, baseDelayMs * attempt);
        console.log(`[whatsapp-webjs] retrying in ${delay}ms (${msg})`);
        await new Promise(res => setTimeout(res, delay));
      }
    }

    throw new Error('[whatsapp-webjs] failed to initialize after retries');
  }

  parseInbound(payload: unknown): InboundMessage | null {
    const msg = payload as Message;
    const from = (msg as any)?.from;
    const text = (msg as any)?.body;
    if (typeof from !== 'string' || typeof text !== 'string') return null;
    return { from, text, raw: payload };
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.client) return;
    await this.client.sendMessage(to, text);
  }

  async sendLocation(input: {
    to: string;
    lat: number;
    lng: number;
    address?: string;
    name?: string;
  }): Promise<void> {
    if (!this.client) return;
    const options =
      input.name || input.address
        ? {
          ...(input.name ? { name: input.name } : {}),
          ...(input.address ? { address: input.address } : {})
        }
        : undefined;
    await this.client.sendMessage(input.to, new Location(input.lat, input.lng, options));
  }

  onMessage(handler: (msg: Message) => void) {
    this.client?.on('message', handler);
  }

  onMessageCreate(handler: (msg: Message) => void) {
    this.client?.on('message_create', handler as any);
  }

  onAnyMessage(handler: (msg: Message, meta: { event: 'message' | 'message_create' }) => void) {
    this.client?.on('message', (m: Message) => handler(m, { event: 'message' }));
    this.client?.on('message_create', (m: Message) => handler(m, { event: 'message_create' }));
  }
}
