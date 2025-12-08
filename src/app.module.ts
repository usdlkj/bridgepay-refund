import { ReportModule } from './report/report.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CacheableMemory, Keyv } from 'cacheable';
import KeyvRedis from '@keyv/redis';
import { isDevOrTest } from './utils/env.utils';
import { IlumaModule } from './iluma/iluma.module';
import { RefundModule } from './refund/refund.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { ApiLogDebugModule } from './api-log-debug/api-log-debug.module';
import { readFileSync } from 'fs';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import rabbitmqConfig from './config/rabbitmq.config';
import refundConfig from './config/refund.config';

const resolveReaderDbConfig = (config: ConfigService) => {
  const hasReplicaConfig =
    config.get('reader.host') &&
    config.get('reader.username') &&
    config.get('reader.password');

  if (!hasReplicaConfig) {
    console.warn(
      '[TypeORM] Read replica config missing; using primary DB for reader connection',
    );
  }

  return {
    host: hasReplicaConfig
      ? config.get('reader.host')
      : config.get('database.host'),
    port: hasReplicaConfig
      ? config.get<number>('reader.port')
      : config.get<number>('database.port'),
    username: hasReplicaConfig
      ? config.get('reader.username')
      : config.get('database.username'),
    password: hasReplicaConfig
      ? config.get('reader.password')
      : config.get('database.password'),
  };
};

const loadDbSsl = (config: ConfigService) => {
  const isProd = ['staging', 'production'].includes(
    config.get<string>('nodeEnv') || '',
  );
  if (!isProd) return undefined;

  const caPath = config.get<string>('database.caPath');
  if (!caPath) return { rejectUnauthorized: false };

  try {
    const ca = readFileSync(caPath);
    return {
      rejectUnauthorized: false,
      ca,
    };
  } catch {
    console.warn(
      `Could not read Database CA at ${caPath}; proceeding without custom CA`,
    );
    return { rejectUnauthorized: false };
  }
};
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, rabbitmqConfig, refundConfig],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('nodeEnv');
        const logsFolder = configService.get<string>('logsFolder');
        return {
          pinoHttp: {
            customLogLevel: (req, res, err) => {
              const excludedRoutes = [
                '/health',
                '/metrics',
                '/health/liveness',
              ];
              if (excludedRoutes.includes(req.url)) return 'silent';
              return err || res.statusCode >= 500 ? 'error' : 'info';
            },
            transport: isDevOrTest(env)
              ? logsFolder !== ''
                ? {
                    target: 'pino-rotate',
                    options: {
                      file: `${logsFolder}/bridgepay-refund-%YYYY-MM-DD%.log`,
                      limit: '7d',
                    },
                  }
                : { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        /** OLD LOGIC */
        // const isEnabled = ['staging', 'production'].includes(config.get('nodeEnv') || '');

        const isEnabled = config.get('redisUrl') !== '';
        if (isEnabled) {
          const keyvRedis = new KeyvRedis(config.get('redisUrl'));
          const keyv = new Keyv({
            store: keyvRedis,
            namespace: 'bridgepay',
            ttl: 300000,
          });
          // Health check at startup
          try {
            await keyv.set('init-check', 'ok', 1000);
            console.log('[Redis] Connected and operational');
            return { stores: [keyv] };
          } catch (err) {
            console.warn(
              '[Redis] Connection failed at startup, falling back to memory:',
              err.message,
            );
            return {
              stores: [
                new Keyv({
                  store: new CacheableMemory({ ttl: 300000, lruSize: 5000 }),
                }),
              ],
            };
          }
        } else {
          return {
            stores: [
              new Keyv({
                store: new CacheableMemory({ ttl: 5000, lruSize: 5000 }),
              }),
            ],
          };
        }
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          type: 'postgres',
          host: config.get('database.host'),
          port: config.get<number>('database.port'),
          username: config.get('database.username'),
          password: config.get('database.password'),
          database: config.get('database.name'),
          autoLoadEntities: true,
          logging: false,
          ssl: loadDbSsl(config),
          synchronize: true,
        };
      },
    }),

    // For replication / read-only queries (only in production)
    ...(process.env.NODE_ENV === 'production'
      ? [
          TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => {
              const readerDb = resolveReaderDbConfig(config);
              return {
                type: 'postgres',
                host: readerDb.host,
                port: readerDb.port,
                username: readerDb.username,
                password: readerDb.password,
                database: config.get('database.name'),
                autoLoadEntities: true,
                logging: false,
                name: 'reader',
                ssl: loadDbSsl(config),
                synchronize: true,
              };
            },
          }),
        ]
      : []),
    IlumaModule,
    RefundModule,
    ReportModule,
    ConfigurationModule,
    ApiLogDebugModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
