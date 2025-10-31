import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { getEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Refund,
  RefundStatus,
  SearchRefundStatus,
} from './entities/refund.entity';
import { RefundService } from './refund.service';
const listType = ['string', 'json', 'number', 'date', 'enum', 'date'];
const field = [
  'refund_id',
  "refund_data->'reqData'->'account'->>'name'",
  'refund_amount',
  'created_at',
  'refund_status',
  'refund_date',
];

@Injectable()
export class BackofficeService {
  private env: string;

  constructor(
    private helper: Helper,
    @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,

    @InjectRepository(Refund)
    private repositoryRefund: Repository<Refund>,

    private readonly configService: ConfigService,
    private readonly refundService: RefundService,
    private readonly searchRefundStatus: SearchRefundStatus,
  ) {
    this.env = getEnv(this.configService);
  }

  async list(columns) {
    try {
      const qb = await this.repositoryRefund.createQueryBuilder('refund');
      if (columns) {
        for (const row of columns) {
          const search = row.search.value;
          const index = row.data;
          if (search != '') {
            if (listType[index] == 'string') {
              qb.andWhere(`"${field[index]}" iLike '%${search}%'`);
            } else if (listType[index] == 'fixed') {
              qb.andWhere(`"${field[index]}" = '${search}'`);
            } else if (listType[index] == 'number') {
              qb.andWhere(`"${field[index]}" = '${search}'`);
            } else if (listType[index] == 'enum') {
              const statusSearch = await this.searchRefundStatus.get(
                search.toLowerCase(),
              );
              qb.andWhere(`"${field[index]}" = '${statusSearch}'`);
            } else if (listType[index] == 'json') {
              qb.andWhere(`${field[index]} = '${search}'`);
            } else {
              const date = moment.tz(search, 'DD-MM-YYYY', 'Asia/Jakarta');
              const startDate = date.toISOString();
              const endDate = date.add(1, 'day').toISOString();
              qb.andWhere(
                `"${field[index]}" BETWEEN '${startDate}' AND '${endDate}'`,
              );
            }
          }
        }
      }
      const data = await qb.getMany();
      return data;
    } catch (e) {
      throw new HttpException(
        { status: 500, message: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async view(id) {
    return await this.repositoryRefund.findOne({
      where: {
        id: id,
      },
    });
  }
  async pgCallback(id) {
    return await this.repositoryRefund.findOne({
      where: {
        id: id,
      },
      select: {
        pgCallback: true,
      },
    });
  }

  async refundDetail(id) {
    return await this.repositoryRefund.findOne({
      where: {
        id: id,
      },
      relations: {
        refundDetail: {
          ticketData: true,
        },
      },
    });
  }

  async retryDisbursement(refundId) {
    try {
      const whereConfig = {
        configName: 'REFUND_TRY_COUNT',
      };
      const tryCount = await this.coreService
        .send({ cmd: 'get-config-data' }, whereConfig)
        .toPromise();
      let config = 1;
      if (tryCount) {
        config = tryCount.configValue;
      }
      const failAttempt = config || 1;
      const _where = {
        where: {
          refundId: refundId,
          refundStatus: RefundStatus.FAIL,
        },
      };
      const check = await this.repositoryRefund.findOne(_where);

      if (!check) {
        throw new Error('Refund not found');
      }
      const retryAttempt = check.retryAttempt ? check.retryAttempt.length : 0;
      if (failAttempt == retryAttempt) {
        throw new Error('Max Attempt to retry');
      }

      const pgCallback = check.pgCallback;
      const requestData = check.requestData;
      const lastIdxCallback = pgCallback ? pgCallback.length - 1 : 0;
      const lastIdxRequest = requestData ? requestData.length - 1 : 0;
      if (
        requestData &&
        pgCallback &&
        requestData[lastIdxRequest].external_id !=
          pgCallback[lastIdxCallback].pgCallback.external_id
      ) {
        throw new Error(
          'This order has 1 request not have received from payment gateway. Please try again later',
        );
      }

      const sequenceData = check.retryAttempt ? check.retryAttempt : [];
      sequenceData.push(moment().format('YYYY-MM-DD HH:mm:ss'));
      await this.repositoryRefund.update(check.id, {
        retryAttempt: sequenceData,
      });
      const generatePayload =
        await this.refundService.generateXenditRefundPayload(check);
      await this.repositoryRefund.update(check.id, {
        requestData: generatePayload.requestData,
      });
      const credential = await this.#getXenditToken();
      const payloadDisbursement = {
        provider: 'xendit',
        func: 'disbursement',
        data: generatePayload.payloadRefund,
        token: credential.secretKey,
      };

      const xendit = await this.coreService
        .send({ cmd: 'refund-core-service' }, payloadDisbursement)
        .toPromise();
      if (xendit.status == 200) {
        await this.repositoryRefund.update(check.id, {
          refundStatus: RefundStatus.RETRY,
        });
      } else {
        throw new Error('Failed Xendit disbursement');
      }
    } catch (e) {
      console.log(e);
      throw new Error(e.message);
    }
  }

  async #getXenditToken() {
    const pgData = await this.coreService
      .send({ cmd: 'get-payment-gateway-like-name' }, { pgName: 'xendit' })
      .toPromise();
    const credentialData = JSON.parse(pgData.credential);
    // console.log(credentialData);
    const credential = credentialData[await this.configService.get('nodeEnv')];
    return credential;
  }
}
