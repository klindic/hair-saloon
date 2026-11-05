import { Injectable, signal } from '@angular/core';
import { AppConfig, RuntimeConfig } from './app-config';

const DEMO_CONFIG: AppConfig = {
  auth0Domain: '',
  auth0ClientId: '',
  apiBaseUrl: '',
  demoMode: true,
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly configSignal = signal<AppConfig>(DEMO_CONFIG);

  readonly config = this.configSignal.asReadonly();

  async load(): Promise<void> {
    this.configSignal.set(await this.fetchConfig());
  }

  private async fetchConfig(): Promise<AppConfig> {
    try {
      const response = await fetch('assets/config.json');
      if (!response.ok) {
        return DEMO_CONFIG;
      }
      const raw: unknown = await response.json();
      return toAppConfig(raw);
    } catch {
      return DEMO_CONFIG;
    }
  }
}

function toAppConfig(raw: unknown): AppConfig {
  const candidate = (raw ?? {}) as Partial<Record<keyof RuntimeConfig, unknown>>;

  const auth0Domain = asTrimmedString(candidate.auth0Domain);
  const auth0ClientId = asTrimmedString(candidate.auth0ClientId);
  const apiBaseUrl = asTrimmedString(candidate.apiBaseUrl);

  const demoMode = auth0Domain === '' || auth0ClientId === '' || apiBaseUrl === '';

  return { auth0Domain, auth0ClientId, apiBaseUrl, demoMode };
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
