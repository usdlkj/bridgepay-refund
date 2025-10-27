import { ReportModule } from './report/report.module';
import { ScheduleModule } from '@nestjs/schedule';
import { Module ,MiddlewareConsumer,RequestMethod } from '@nestjs/common';
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
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import rabbitmqConfig from './config/rabbitmq.config';
import refundConfig from './config/refund.config';
import { RefundMiddleware } from './refund/refund.middleware';
import { RefundController } from './refund/refund.controller';
import { IlumaController } from './iluma/iluma.controller';
import { PaymentGatewayModule } from './payment-gateway/payment-gateway.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { ApiLogDebugModule } from './api-log-debug/api-log-debug.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, rabbitmqConfig,refundConfig],
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
              const excludedRoutes = ['/health', '/metrics', '/health/liveness'];
              if (excludedRoutes.includes(req.url)) return 'silent';
              return err || res.statusCode >= 500 ? 'error' : 'info';
            },
            transport:
              isDevOrTest(env)
                ? logsFolder !== ''
                  ? {
                    target: 'pino-rotate',
                    options: {
                      file: `${logsFolder}/bridgepay-core-%YYYY-MM-DD%.log`,
                      limit: '7d',
                    },
                  }
                  : { target: 'pino-pretty', options: { singleLine: true }}
                : undefined,
          }
        }
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
          const keyv = new Keyv({ store: keyvRedis, namespace: 'bridgepay', ttl: 300000 });
          // Health check at startup
          try {
            await keyv.set('init-check', 'ok', 1000);
            console.log('[Redis] Connected and operational');
            return { stores: [keyv] };
          } catch (err) {
            console.warn('[Redis] Connection failed at startup, falling back to memory:', err.message);
            return {
              stores: [
                new Keyv({ store: new CacheableMemory({ ttl: 300000, lruSize: 5000 }) }),
              ],
            };
          }
        } else {
          return { stores: [new Keyv({ store: new CacheableMemory({ ttl: 5000, lruSize: 5000 })})]};
        }
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const isProd = ['staging', 'production'].includes(config.get<string>('nodeEnv') || '');

        if (isProd) {
          return {
            type: 'postgres',
            replication: {
              master: {
                host: config.get('database.master.host'),
                port: config.get<number>('database.master.port'),
                username: config.get('database.master.username'),
                password: config.get('database.master.password'),
                database: config.get('database.name'),
              },
              slaves: config.get('database.replicas'),
            },
            autoLoadEntities: true,
            logging: false,
          };
        }

        // fallback for dev/local
        return {
          type: 'postgres',
          host: config.get('database.host'),
          port: config.get<number>('database.port'),
          username: config.get('database.username'),
          password: config.get('database.password'),
          database: config.get('database.name'),
          autoLoadEntities: true,
          logging: config.get('nodeEnv') === 'development',
        };
      },
    }),
    ScheduleModule.forRoot(),
    IlumaModule,
    RefundModule,
    ReportModule,
    PaymentGatewayModule,
    ConfigurationModule,
    ApiLogDebugModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RefundMiddleware)
      .exclude({path:'/api/v2/bankCodes',method:RequestMethod.GET})
      .exclude({path:'/api/v2/webhook/iluma/bank-validator',method:RequestMethod.POST})
      .exclude({path:'/api/v2/webhook/xendit/disbursement',method:RequestMethod.POST})
      .forRoutes(RefundController,IlumaController); // Applies middleware to all routes in PostsController
  }
}
