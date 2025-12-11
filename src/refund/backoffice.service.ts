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
import { ConfigurationService } from 'src/configuration/configuration.service';
import { RefundService } from './refund.service';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundLog } from './entities/refund-log.entity';
import { Logger } from 'nestjs-pino';
import axios from 'axios';
const listType = ['string', 'json', 'number', 'date', 'enum', 'date'];
const field = [
  'refund_ga_number',
  "refund_data->'reqData'->'account'->>'name'",
  'refund_amount',
  'created_at',
  'refund_status',
  'refund_date',
];
const listTypeLog = ['string', 'string', 'string', 'string', 'date'];
const fieldLog = ['type', 'location', 'msg', 'notes', 'created_at'];

@Injectable()
export class BackofficeService {
  private env: string;

  constructor(
    private helper: Helper,
    @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,

    @InjectRepository(Refund)
    private repositoryRefund: Repository<Refund>,

    @InjectRepository(RefundLog)
    private repositoryRefundLog: Repository<RefundLog>,

    private readonly configService: ConfigService,
    private readonly refundService: RefundService,
    private readonly searchRefundStatus: SearchRefundStatus,
    private readonly configurationService: ConfigurationService,
    private readonly logger: Logger,
  ) {
    this.env = getEnv(this.configService);
  }

  async list(columns: any) {
    try {
      const qb = this.repositoryRefund.createQueryBuilder('refund');

      if (columns && Array.isArray(columns)) {
        for (let i = 0; i < columns.length; i++) {
          const row = columns[i];
          const search = row?.search?.value;
          const index = row?.data;

          if (!search && search !== 0) {
            continue;
          }

          const fieldName = field[index];
          const type = listType[index];
          const paramKey = `search_${index}_${i}`;

          if (!fieldName || !type) {
            continue;
          }

          if (type === 'string') {
            qb.andWhere(`${fieldName} ILIKE :${paramKey}`, {
              [paramKey]: `%${search}%`,
            });
          } else if (type === 'fixed') {
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: search,
            });
          } else if (type === 'number') {
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: Number(search),
            });
          } else if (type === 'enum') {
            const statusSearch = await this.searchRefundStatus.get(
              String(search).toLowerCase(),
            );
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: statusSearch,
            });
          } else if (type === 'json') {
            // For JSON fields, keep equality but still parameterized
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: search,
            });
          } else if (type === 'date') {
            const date = moment.tz(
              String(search),
              'DD-MM-YYYY',
              'Asia/Jakarta',
            );
            if (!date.isValid()) {
              continue;
            }
            const startDate = date.startOf('day').toISOString();
            const endDate = date.endOf('day').toISOString();

            qb.andWhere(
              `${fieldName} BETWEEN :start_${paramKey} AND :end_${paramKey}`,
              {
                [`start_${paramKey}`]: startDate,
                [`end_${paramKey}`]: endDate,
              },
            );
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
    const refund = await this.repositoryRefund
      .createQueryBuilder('refund')
      .leftJoinAndMapOne(
        'refund.refundDetail',
        RefundDetail,
        'detail',
        'detail.refund_mw_id = refund.id', // **NOTE:** Adjust this condition based on your actual FK structure
      )
      .leftJoinAndSelect('detail.ticketData', 'ticket')
      .where('refund.id= :id', { id: id })
      .getOne();

    return refund;
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
      const tryCount =
        await this.configurationService.findByConfigName('REFUND_TRY_COUNT');
      let config = 1;
      if (tryCount) {
        config = parseInt(tryCount.configValue);
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
      if (check.refundStatus !== RefundStatus.FAIL) {
        throw new Error('Retry allowed only for fail status');
      }
      const retryAttempt = check.retryAttempt ? check.retryAttempt.length : 0;
      if (failAttempt == retryAttempt) {
        throw new Error('Max Attempt to retry');
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

      // get xendit credential from bridgepay-core
      const credential = await this.helper.getXenditCredential(
        this.coreService,
        this.logger,
        this.env,
      );

      const payloadDisbursement = {
        data: generatePayload.payloadRefund,
        token: credential.secretKey,
      };

      const xendit = await this.callXenditDisbursement(payloadDisbursement);
      if (xendit.status === 200) {
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

  private async callXenditDisbursement(payload) {
    try {
      const auth = payload.token + ':';
      const key = Buffer.from(auth).toString('base64');
      const disbursement = await axios.post(
        'https://api.xendit.co/v2/payouts',
        payload.data,
        {
          headers: {
            Authorization: 'Basic ' + key,
            'Content-Type': 'application/json',
            'Idempotency-key': payload.data?.idempotencyKey,
          },
        },
      );
      return {
        status: disbursement.status,
        data: disbursement.data,
      };
    } catch (e) {
      return {
        status: e.response?.status ?? 500,
        data: e.response?.data ?? e.message,
      };
    }
  }

  async refundLog(columns) {
    try {
      const qb = this.repositoryRefundLog.createQueryBuilder('refundLog');

      if (columns && Array.isArray(columns)) {
        for (let i = 0; i < columns.length; i++) {
          const row = columns[i];
          const search = row?.search?.value;
          const index = row?.data;

          if (!search && search !== 0) {
            continue;
          }

          const fieldName = fieldLog[index];
          const type = listTypeLog[index];
          const paramKey = `log_${index}_${i}`;

          if (!fieldName || !type) {
            continue;
          }

          if (type === 'string') {
            qb.andWhere(`${fieldName} ILIKE :${paramKey}`, {
              [paramKey]: `%${search}%`,
            });
          } else if (type === 'fixed') {
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: search,
            });
          } else if (type === 'number') {
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: Number(search),
            });
          } else if (type === 'enum') {
            const statusSearch = await this.searchRefundStatus.get(
              String(search).toLowerCase(),
            );
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: statusSearch,
            });
          } else if (type === 'json') {
            qb.andWhere(`${fieldName} = :${paramKey}`, {
              [paramKey]: search,
            });
          } else if (type === 'date') {
            const date = moment.tz(
              String(search),
              'DD-MM-YYYY',
              'Asia/Jakarta',
            );
            if (!date.isValid()) {
              continue;
            }
            const startDate = date.startOf('day').toISOString();
            const endDate = date.endOf('day').toISOString();

            qb.andWhere(
              `${fieldName} BETWEEN :start_${paramKey} AND :end_${paramKey}`,
              {
                [`start_${paramKey}`]: startDate,
                [`end_${paramKey}`]: endDate,
              },
            );
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
}
