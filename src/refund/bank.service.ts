import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { getEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import {
  RefundBank,
  SearchBankStatus,
} from 'src/refund/entities/refund-bank.entity';
import { UpdateRefundBankDto } from './dto/update-refund-bank.dto';
import { IlumaCallLog } from 'src/iluma/entities/iluma-call-log.entity';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { Payout as PayoutClient } from 'xendit-node';
import { Channel, ChannelCategory } from 'xendit-node/payout/models';

type BankFilterKind = 'string' | 'fixed' | 'number' | 'enum' | 'date';

interface BankFilterConfig {
  field: string; // database column name
  type: BankFilterKind;
}

const BANK_FILTER_CONFIG: Record<number, BankFilterConfig> = {
  0: { field: 'bank_name', type: 'string' },
  1: { field: 'xendit_code', type: 'string' },
  2: { field: 'bank_status', type: 'fixed' },
};

interface BankListColumn {
  data: number; // index that maps to BANK_FILTER_CONFIG
  search: {
    value: string;
  };
}

@Injectable()
export class BankService {
  private env: string;

  constructor(
    @Inject('RefundToCoreClient')
    private readonly coreService: ClientProxy,
    private readonly configService: ConfigService,
    private readonly logger: Logger,

    private helper: Helper,
    @InjectRepository(RefundBank)
    private repositoryRefundBank: Repository<RefundBank>,
    private searchBankStatus: SearchBankStatus,
    @InjectRepository(IlumaCallLog)
    private repositoryCallLog: Repository<IlumaCallLog>,

    private readonly yggdrasilService: YggdrasilService,
  ) {
    this.env = getEnv(this.configService);
  }

  async list(columns?: BankListColumn[]): Promise<RefundBank[]> {
    try {
      const qb = this.repositoryRefundBank.createQueryBuilder('refundBank');

      if (Array.isArray(columns) && columns.length > 0) {
        for (const row of columns) {
          const searchRaw = row?.search?.value?.toString() ?? '';
          if (!searchRaw) {
            continue;
          }

          const index = Number(row.data);
          const config = BANK_FILTER_CONFIG[index];
          if (!config) {
            // Unknown column index, skip silently
            continue;
          }

          const { field, type } = config;
          const paramName = `p_${field}_${index}`;

          if (type === 'string') {
            qb.andWhere(`refundBank."${field}" ILIKE :${paramName}`, {
              [paramName]: `%${searchRaw}%`,
            });
          } else if (type === 'fixed') {
            qb.andWhere(`refundBank."${field}" = :${paramName}`, {
              [paramName]: searchRaw,
            });
          } else if (type === 'number') {
            const numericValue = Number(searchRaw);
            if (!Number.isFinite(numericValue)) {
              // Invalid number search, skip this condition
              continue;
            }
            qb.andWhere(`refundBank."${field}" = :${paramName}`, {
              [paramName]: numericValue,
            });
          } else if (type === 'enum') {
            const statusSearch = await this.searchBankStatus.get(
              searchRaw.toLowerCase(),
            );
            if (!statusSearch) {
              // If the mapping is unknown, skip this filter
              continue;
            }
            qb.andWhere(`refundBank."${field}" = :${paramName}`, {
              [paramName]: statusSearch,
            });
          } else {
            // Treat as a date filter covering the full day in Asia/Jakarta
            const date = moment.tz(searchRaw, 'DD-MM-YYYY', 'Asia/Jakarta');
            if (!date.isValid()) {
              // Invalid date input, skip this filter
              continue;
            }

            const startDate = date.toISOString();
            const endDate = date.add(1, 'day').toISOString();

            const startParam = `${paramName}_start`;
            const endParam = `${paramName}_end`;

            qb.andWhere(
              `refundBank."${field}" BETWEEN :${startParam} AND :${endParam}`,
              {
                [startParam]: startDate,
                [endParam]: endDate,
              },
            );
          }
        }
      }

      const data = await qb.getMany();
      return data;
    } catch (e) {
      this.logger.error('Error fetching refund bank list', e);
      throw new HttpException(
        { status: 500, message: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async view(id: string): Promise<RefundBank> {
    try {
      const bank = await this.repositoryRefundBank.findOne({ where: { id } });

      if (!bank) {
        throw new HttpException(
          { status: 404, message: 'Refund bank not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return bank;
    } catch (e) {
      this.logger.error(`Error fetching refund bank with id ${id}`, e);
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { status: 500, message: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, payload: UpdateRefundBankDto): Promise<RefundBank> {
    try {
      const existing = await this.repositoryRefundBank.findOne({
        where: { id },
      });

      if (!existing) {
        throw new HttpException(
          { status: 404, message: 'Refund bank not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      // Only allow updating of bankStatus and deletedAt, all other fields are managed by sync
      if (typeof payload.bankStatus !== 'undefined') {
        existing.bankStatus = payload.bankStatus;
      }

      if (typeof payload.deletedAt !== 'undefined') {
        // If deletedAt is provided as a valid ISO string, convert to Date.
        // If you want to support explicit undelete, you can send an empty string and we treat it as null.
        if (payload.deletedAt === '' || payload.deletedAt === null) {
          existing.deletedAt = null;
        } else {
          existing.deletedAt = new Date(payload.deletedAt);
        }
      }

      const saved = await this.repositoryRefundBank.save(existing);
      return saved;
    } catch (e) {
      this.logger.error(`Error updating refund bank with id ${id}`, e);
      if (e instanceof HttpException) {
        throw e;
      }
      throw new HttpException(
        { status: 500, message: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async bankSync() {
    try {
      await this.xenditSync();
      await this.ilumaSync();
      const result = {
        status: 200,
        message: 'Success',
      };
      return result;
    } catch (e) {
      throw new HttpException(
        { status: 500, message: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * This function will synchronize bank data from Xendit to local database
   * @returns void
   */
  private async xenditSync() {
    try {
      const credential = await this.helper.getXenditCredential(
        this.coreService,
        this.logger,
        this.env,
      );
      const xenditPayoutClient = new PayoutClient({
        secretKey: credential.secretKey,
      });
      const payoutChannels: Channel[] =
        await xenditPayoutClient.getPayoutChannels({
          currency: 'IDR',
          channelCategory: [ChannelCategory.Bank],
        });

      // upsert into refund_banks table
      for (const channel of payoutChannels) {
        const where = {
          where: {
            xenditCode: channel.channelCode.trim(),
          },
        };
        const payload = {
          bankName: channel.channelName,
          xenditCode: channel.channelCode.trim(),
          xenditData: channel,
          bankStatus: 'disable',
        };
        await this.bankUpsert(where, payload);
      }
    } catch (e) {
      this.logger.error(`xenditSync error: ${e.message}`);
      throw e;
    }
  }

  private async ilumaSync() {
    try {
      // Get bank data from Iluma
      const payload = {
        provider: 'iluma',
        func: 'bank-list',
        credential: this.configService.get('iluma.token'),
      };
      const iluma = await this.yggdrasilService.refund(payload);

      // Store Iluma call log to database
      const payloadLog = {
        url: 'https://api.iluma.ai/bank/available_bank_codes',
        payload: null,
        method: 'get',
        func: 'yggdrasilService.refund',
        response: iluma,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString(),
      };
      const payloadLogSave = this.repositoryCallLog.create(payloadLog);
      await this.repositoryCallLog.save(payloadLogSave);

      // Update refund_banks table with Iluma bank code and data
      if (iluma.status != 200) {
        throw new Error(iluma.msg);
      } else {
        for (const ilumaData of iluma.data) {
          const check = await this.repositoryRefundBank.findOne({
            where: { bankName: ilumaData.name.trim() },
          });
          if (check) {
            const data = {
              ilumaCode: ilumaData.code.trim(),
              ilumaData,
            };
            await this.repositoryRefundBank.update(check.id, data);
          } else {
            this.logger.warn(
              `Iluma bank ${ilumaData.name} not found in refund_banks table`,
            );
          }
        }
        // Optional: log result if needed
      }
    } catch (e) {
      throw new HttpException(
        { status: 500, message: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async bankUpsert(where: object, payload: object) {
    try {
      const check = await this.repositoryRefundBank.findOne(where);
      if (check) {
        payload['updatedAt'] = moment().toISOString();
        await this.repositoryRefundBank.update(check.id, payload);
      } else {
        payload['createdAt'] = moment().toISOString();
        payload['updatedAt'] = moment().toISOString();
        const payloadSave = this.repositoryRefundBank.create(payload);
        await this.repositoryRefundBank.save(payloadSave);
      }
      return {
        status: 200,
        msg: 'Success',
      };
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }
}
