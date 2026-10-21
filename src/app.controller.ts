import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Static: answering proves the event loop is responsive. No dependency
  // checks, so an outage can never restart a healthy pod.
  @Get('health/liveness')
  liveness() {
    return { status: 'ok' };
  }

  // main.ts opens the HTTP port only after the RabbitMQ consumer has started,
  // so a reachable port already means the consumer is up; this adds the DB.
  // shortcut: a broker connection lost after startup is not detected, upgrade
  // when the consumer exposes its connection state.
  @Get('health/readiness')
  async readiness() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok' };
  }
}
