// src/common/encryptor.client.ts
import {
  ClientProxyFactory,
  Transport,
  ClientProxy,
} from '@nestjs/microservices';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';

@Injectable()
export class EncryptorClient implements OnModuleInit, OnModuleDestroy {
  private client: ClientProxy;
  private readonly logger = new Logger(EncryptorClient.name);

  constructor(private configService: ConfigService) {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [this.configService.getOrThrow<string>('RABBITMQ_URL')],
        queue:
          this.configService.get<string>('RABBITMQ_ENCRYPTOR_QUEUE') ||
          'bridgepay-encryptor',
        queueOptions: { durable: true },
      },
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  /**
   * Safe send wrapper with timeout, error handling, and structured logs.
   */
  async send<TInput = any, TOutput = any>(
    pattern: string,
    payload: TInput,
    timeoutMs = 5000,
  ): Promise<TOutput> {
    try {
      const result = await firstValueFrom(
        this.client.send<TOutput>(pattern, payload).pipe(timeout(timeoutMs)),
      );
      return result;
    } catch (err: any) {
      if (err instanceof TimeoutError) {
        this.logger.error(`[${pattern}] Encryptor microservice timeout`);
        throw new Error(`Encryptor microservice timeout`);
      }

      // If the encryptor threw RpcException, it arrives as an object
      const message = err?.message || JSON.stringify(err);
      this.logger.error(
        `[${pattern}] Encryptor microservice error: ${message}`,
      );
      throw new Error(`Encryptor microservice error: ${message}`);
    }
  }

  get proxy(): ClientProxy {
    return this.client;
  }
}
