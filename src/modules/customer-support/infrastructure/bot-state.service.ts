import { Injectable } from '@nestjs/common';

@Injectable()
export class BotStateService {
  private enabled = true;

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

