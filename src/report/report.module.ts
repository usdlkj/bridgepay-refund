import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { ReportDataRow } from './entities/report-data-row.entity';
import { Refund } from 'src/refund/entities/refund.entity';
import { IlumaCallLog } from 'src/iluma/entities/iluma-call-log.entity';
import { CronService } from './cron.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportDataRow, Refund, IlumaCallLog]),
    AuthModule,
  ],
  providers: [ReportService,CronService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}
