
import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { ReportDataRow } from './entities/report-data-row.entity';
import { Refund } from 'src/refund/entities/refund.entity';
import { IlumaCallLog } from 'src/iluma/entities/iluma-call-log.entity';{}

@Module({
  imports: [TypeOrmModule.forFeature([Report, ReportDataRow,Refund,IlumaCallLog])],
  providers: [ReportService],
  controllers: [ReportController],
  exports: [ReportService]
})
export class ReportModule {}
