import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RefundDeliveryService } from './refund-delivery.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ClientsModule.registerAsync([
      // ----------------------------
      // Refund → Core Client
      // ----------------------------
      {
        name: 'RefundToCoreClient',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672',
            ],
            queue: config.get<string>('rabbitmq.coreQueue') ?? 'bridgepay-core',
            persistent: true,
            queueOptions: {
              durable: true,
            },
          },
        }),
      },

      // ----------------------------
      // Refund → Refund worker client
      // ----------------------------
      // The Iluma polling fallback is handled by this service's own RMQ
      // consumer, not by bridgepay-core.
      {
        name: 'RefundToRefundWorkerClient',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672',
            ],
            queue:
              config.get<string>('rabbitmq.refundQueue') ??
              'bridgepay-refund',
            persistent: true,
            queueOptions: {
              durable: true,
            },
          },
        }),
      },

      // ----------------------------
      // Refund → Encryptor Client
      // ----------------------------
      {
        name: 'RefundToEncryptorClient',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('rabbitmq.url') ?? 'amqp://localhost:5672',
            ],
            queue:
              config.get<string>('rabbitmq.encryptorQueue') ??
              'bridgepay-encryptor',
            persistent: true,
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  providers: [RefundDeliveryService],
  exports: [ClientsModule, RefundDeliveryService],
})
export class BrokerModule {}
