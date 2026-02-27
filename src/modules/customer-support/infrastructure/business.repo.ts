import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import type { BusinessInfoRepository } from '../domain/ports';

@Injectable()
export class BusinessInfoJsonRepository implements BusinessInfoRepository {
  constructor(private readonly config: ConfigService) {}

  async getBusinessInfo(): Promise<unknown> {
    const path = this.config.get<string>('BUSINESS_INFO_PATH') ?? 'business-info.json';
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  }
}

