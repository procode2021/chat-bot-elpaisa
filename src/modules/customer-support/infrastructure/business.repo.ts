import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, writeFile } from 'fs/promises';
import axios from 'axios';
import type { BusinessInfoRepository } from '../domain/ports';

@Injectable()
export class BusinessInfoJsonRepository implements BusinessInfoRepository {
  constructor(private readonly config: ConfigService) {}

  async getBusinessInfo(): Promise<unknown> {
    const path = this.config.get<string>('BUSINESS_INFO_PATH') ?? 'business-info.json';
    const raw = await readFile(path, 'utf-8');
    const json = JSON.parse(raw);
    const synced = await this.syncBranchesIntoBusinessInfo(json);
    if (synced.changed) {
      await writeFile(path, JSON.stringify(synced.data, null, 2) + '\n', 'utf-8');
    }
    return synced.data;
  }

  private resolveApiBaseCandidates(): string[] {
    const explicit = this.config.get<string>('ELPAISA_API_BASE')?.trim();
    const defaultLocal = 'http://localhost/elpaisa/api';
    const values = [explicit || '', defaultLocal];
    const out: string[] = [];
    for (const v of values) {
      const cleaned = String(v || '').replace(/\/$/, '');
      if (!cleaned || out.includes(cleaned)) continue;
      out.push(cleaned);
    }
    return out;
  }

  private parseLatLngFromMapUrl(url: string | null | undefined): { lat?: number; lng?: number } {
    const text = String(url || '');
    if (!text) return {};
    const m = text.match(/q=([-0-9.]+),([-0-9.]+)/i);
    if (!m) return {};
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
    return { lat, lng };
  }

  private async fetchBranchesFromApi(): Promise<any[]> {
    const candidates = this.resolveApiBaseCandidates();
    for (const base of candidates) {
      try {
        const res = await axios.get(`${base}/public/branches`, { timeout: 5000 });
        const branches = Array.isArray(res.data?.branches) ? res.data.branches : [];
        if (res.data?.ok && branches.length > 0) return branches;
      } catch {
        // try next candidate
      }
    }
    return [];
  }

  private async syncBranchesIntoBusinessInfo(data: any): Promise<{ changed: boolean; data: any }> {
    const branches = await this.fetchBranchesFromApi();
    if (!branches.length) return { changed: false, data };

    const next = data && typeof data === 'object' ? { ...data } : {};
    next.business = next.business && typeof next.business === 'object' ? { ...next.business } : {};
    const currentLocations = next.business.locations && typeof next.business.locations === 'object' ? next.business.locations : {};
    const newLocations: Record<string, any> = {};

    for (const b of branches) {
      const key = String(b.key || '').trim().toLowerCase();
      if (!key) continue;
      const prev = currentLocations[key] && typeof currentLocations[key] === 'object' ? currentLocations[key] : {};
      const parsed = this.parseLatLngFromMapUrl(b.map);
      newLocations[key] = {
        name: b.name || prev.name || key,
        address: b.address || prev.address || '',
        phone: b.phone || prev.phone || '',
        whatsapp: b.whatsapp || prev.whatsapp || '',
        lat: Number.isFinite(parsed.lat as number) ? parsed.lat : prev.lat,
        lng: Number.isFinite(parsed.lng as number) ? parsed.lng : prev.lng,
      };
    }

    if (!Object.keys(newLocations).length) return { changed: false, data };

    next.business.locations = newLocations;

    // Keep contact in sync with first branch if missing/old.
    const firstKey = Object.keys(newLocations)[0];
    const first = newLocations[firstKey];
    next.business.contact = next.business.contact && typeof next.business.contact === 'object' ? { ...next.business.contact } : {};
    next.business.contact.phone = first.phone || next.business.contact.phone || '';
    next.business.contact.whatsapp = first.whatsapp || next.business.contact.whatsapp || '';

    const changed = JSON.stringify(next.business.locations) !== JSON.stringify(currentLocations);
    return { changed, data: next };
  }
}
