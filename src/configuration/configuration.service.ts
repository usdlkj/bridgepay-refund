import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

export interface ConfigurationValue {
  configName: string;
  configValue: string;
}

const CORE_TIMEOUT_MS = 5000;

// Settings such as REFUND_TRY_COUNT live in Core's `configurations` table and are edited in the Backoffice.
// Refund has no such table (its own database is separate), so it asks Core. A caller treats null as
// "use the default", so a Core or broker problem never stops a refund callback from being processed.
@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(
    @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,
  ) {}

  async findByConfigName(name: string): Promise<ConfigurationValue | null> {
    try {
      const row = await firstValueFrom(
        this.coreService
          .send({ cmd: 'get-config-data' }, { configName: name })
          .pipe(timeout(CORE_TIMEOUT_MS)),
      );
      return row ?? null;
    } catch (error) {
      this.logger.warn({
        event: 'config-read-failed',
        configName: name,
        message: (error as Error)?.message,
      });
      return null;
    }
  }
}
