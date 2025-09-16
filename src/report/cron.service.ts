import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment-timezone';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { ConfigService } from '@nestjs/config';
import { ReportService } from './report.service';
import { reportType } from './entities/report.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository} from 'typeorm';
const TIMEZONE_WIB = 'Asia/Jakarta';
const REFUND_REPORT= '0 4 * * *';
const ILUMA_REPORT= '0 5 * * *';

@Injectable()
export class CronService {
    private env: string;
        
    constructor(
    private readonly configService: ConfigService,
    private reportService:ReportService

    ) {
    this.env = getEnv(this.configService);
    }

    @Cron(REFUND_REPORT, { timeZone: TIMEZONE_WIB })
    async dailyRefundReport() {
        let date=moment().tz("Asia/Jakarta").subtract(1,"days").format("YYYY-MM-DD");
        let payload = {
            date:date.toString(),
            type:reportType.REFUND
        }
        await this.reportService.create(payload)
    }

    @Cron(ILUMA_REPORT, { timeZone: TIMEZONE_WIB })
    async dailyIlumaReport() {
        let date=moment().tz("Asia/Jakarta").subtract(1,"days").format("YYYY-MM-DD");
        let payload = {
            date:date.toString(),
            type:reportType.ILUMA
        }
        await this.reportService.create(payload)
    }


}
