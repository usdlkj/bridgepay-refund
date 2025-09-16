import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Attach the microservice listener to the main application instance.
  // This is the key change.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: configService.get('rabbitmq.url'),
      queue: configService.get('rabbitmq.refundQueue'),
      queueOptions: { durable: true },
    },
  });

  // Start both the microservice listener and the HTTP server.
  await app.startAllMicroservices();
  await app.init();
  await app.listen(configService.get('port') || 3000);
  
  console.log(`Gateway is running on: ${await app.getUrl()}`);
}
bootstrap();