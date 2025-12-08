import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

async function bootstrap() {
  // -------------------------------
  // PHASE 1 — CREATE APP
  // -------------------------------
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Logger, Helmet, CORS
  app.useLogger(app.get(Logger));
  app.use(helmet());

  // Basic CORS — safe mode
  const corsOrigins =
    config.get<string>('cors.allowedOrigins') ?? 'http://localhost:3000';
  const allowedOrigins = corsOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // -------------------------------
  // PHASE 2 — INIT MODULE GRAPH
  // (runs TypeORM, onModuleInit, etc.)
  // -------------------------------
  await app.init();

  // -------------------------------
  // PHASE 3 — START HTTP SERVER
  // -------------------------------
  const port = config.get<number>('port', 3000);
  await app.listen(port, '0.0.0.0');

  // -------------------------------
  // PHASE 4 — START MICROSERVICE
  // (RMQ errors will not kill the app)
  // -------------------------------
  try {
    const nodeEnv = config.get<string>('nodeEnv');
    const isProd = nodeEnv === 'production';
    let socketOptions: Record<string, unknown> | undefined;

    if (isProd) {
      const caPath = config.get<string>('rabbitmq.caPath');
      try {
        const ca = readFileSync(caPath);
        socketOptions = {
          rejectUnauthorized: true,
          ca: [ca],
        };
      } catch {
        console.warn(
          `Could not read RabbitMQ CA at ${caPath}; proceeding without custom CA`,
        );
        socketOptions = { rejectUnauthorized: true };
      }
    }

    const rmqUrl = config.get('rabbitmq.url');
    const rmqQueue = config.get('rabbitmq.refundQueue');

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: rmqUrl,
        queue: rmqQueue,
        queueOptions: { durable: true },
        socketOptions,
        noAck: true,
      },
    });

    await app.startAllMicroservices();
  } catch (err) {
    console.error('>>> Failed to start microservices:', err);
  }

  // -------------------------------
  // PHASE 5 — SHUTDOWN HOOKS
  // -------------------------------
  app.enableShutdownHooks();

  const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
  shutdownSignals.forEach((signal) => {
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
  });
}

bootstrap();
