export interface RuntimeConfig {
  auth0Domain: string;
  auth0ClientId: string;
  apiBaseUrl: string;
}

export interface AppConfig extends RuntimeConfig {
  demoMode: boolean;
}
