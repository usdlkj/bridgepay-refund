import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class BrokerModule {}
