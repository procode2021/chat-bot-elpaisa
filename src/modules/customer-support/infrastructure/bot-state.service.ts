import { Injectable } from '@nestjs/common';

@Injectable()
export class BotStateService {
  private enabled = true;
  private qrCode: string | null = null;

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getQrCode(): string | null {
    return this.qrCode;
  }

  setQrCode(qr: string | null): void {
    this.qrCode = qr;
  }
}

