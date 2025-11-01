import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.get(Logger);
  // Attach the microservice listener to the main application instance.
  // This is the key change.
  // app.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.RMQ,
  //   options: {
  //     urls: configService.get('rabbitmq.url'),
  //     queue: configService.get('rabbitmq.refundQueue'),
  //     queueOptions: { durable: true },
  //   },
  // });

  // app.useLogger(logger);
  // Start both the microservice listener and the HTTP server.
  // await app.startAllMicroservices();
  await app.listen(configService.get('port'));
}
bootstrap();
