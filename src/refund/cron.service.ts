import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment-timezone';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { ConfigService } from '@nestjs/config';
import { Refund, RefundStatus } from './entities/refund.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Helper } from 'src/utils/helper';
import { BackofficeService } from './backoffice.service';
const TIMEZONE_WIB = 'Asia/Jakarta';
const TIMELAPSE_RETRY_REFUND = '*/10 * * * *';
@Injectable()
export class CronService {
  private env: string;

  constructor(
    @InjectRepository(Refund)
    private repositoryRefund: Repository<Refund>,

    private readonly configService: ConfigService,
    private backofficeService: BackofficeService,
  ) {
    this.env = getEnv(this.configService);
  }

  @Cron(TIMELAPSE_RETRY_REFUND, { timeZone: TIMEZONE_WIB })
  async retryRefund() {
    // console.log("retryRefund start")
    await this.#retry();
  }

  async #retry() {
    try {
      const date = moment().toISOString();
      const data = await this.repositoryRefund
        .createQueryBuilder('refund')
        .where('refund.retryDate IS NOT NULL')
        .andWhere('refund.retryDate between :startDate and :endDate', {
          endDate: date,
          startDate: moment().subtract(2, 'h').toISOString(),
        })
        .andWhere(`refund.refundStatus='fail'`)
        .getMany();
      if (data.length > 0) {
        for (const row of data) {
          const xendit = this.backofficeService.retryDisbursement(row.refundId);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
}
