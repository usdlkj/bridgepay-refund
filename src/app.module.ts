import { ReportModule } from './report/report.module';
import { ScheduleModule } from '@nestjs/schedule';
import { Module ,MiddlewareConsumer,RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IlumaModule } from './iluma/iluma.module';
import { RefundModule } from './refund/refund.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import rabbitmqConfig from './config/rabbitmq.config';
import refundConfig from './config/refund.config';
import { RefundMiddleware } from './refund/refund.middleware';
import { RefundController } from './refund/refund.controller';
import { IlumaController } from './iluma/iluma.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        rabbitmqConfig,
        refundConfig
      ],
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
          logging:["query","error"]
        };
      },
    }),
    ScheduleModule.forRoot(),
    IlumaModule,
    RefundModule,
    ReportModule,
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
      .forRoutes(RefundController,IlumaController); // Applies middleware to all routes in PostsController
  }
}
