import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { getEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import {
  RefundBank,
  SearchBankStatus,
} from 'src/refund/entities/refund-bank.entity';
import { IlumaCallLog } from 'src/iluma/entities/iluma-call-log.entity';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { Payout as PayoutClient } from 'xendit-node';
import { Channel, ChannelCategory } from 'xendit-node/payout/models';
const listType = ['string', 'string', 'fixed'];
const field = ['bank_name', 'xendit_code', 'bank_status'];

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

  async list(columns) {
    try {
      const qb =
        await this.repositoryRefundBank.createQueryBuilder('refundBank');
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
              const statusSearch = await this.searchBankStatus.get(
                search.toLowerCase(),
              );
              qb.andWhere(`"${field[index]}" = '${statusSearch}'`);
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
    return await this.repositoryRefundBank.findOne({
      where: {
        id: id,
      },
    });
  }

  async update(id, payload) {
    return this.repositoryRefundBank.update(id, payload);
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
