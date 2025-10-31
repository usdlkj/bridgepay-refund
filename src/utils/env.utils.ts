import { ConfigService } from '@nestjs/config';

export function getEnv(configService: ConfigService): string {
  return configService.get<string>('nodeEnv') || 'development';
}

export function isDevOrTest(env: string): boolean {
  return env === 'development' || env === 'test';
}

export function getCredentialForEnv(credential: any, env: string): any {
  return isDevOrTest(env) ? credential.development : credential.production;
}
