import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
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
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
const listType = ['string', 'string', 'fixed'];
const field = ['bank_name', 'xendit_code', 'bank_status'];

@Injectable()
export class BankService {
  private env: string;

  constructor(
    private helper: Helper,

    @InjectRepository(RefundBank)
    private repositoryRefundBank: Repository<RefundBank>,
    private searchBankStatus: SearchBankStatus,

    @InjectRepository(IlumaCallLog)
    private repositoryCallLog: Repository<IlumaCallLog>,

    private readonly configService: ConfigService,

    private readonly yggdrasilService: YggdrasilService,
    private readonly paymentGatewayService: PaymentGatewayService,
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
      this.#bankProviderSync();
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

  async #bankProviderSync() {
    await this.#xenditSync();
    await this.#ilumaSync();
  }

  async #xenditSync() {
    try {
      const credential = await this.#getXenditToken();
      const payload = {
        provider: 'xendit',
        func: 'bank-list',
        token: credential.secretKey,
      };
      const xendit = await this.yggdrasilService.refund(payload);
      if (xendit.status != 200) {
        throw new Error(xendit.data);
      } else {
        const result = [];
        // xendit.data.map(async function(value,index){

        // })
        for (const value of xendit.data) {
          const temp = {
            bankName: value.name,
            xenditCode: value.code.trim(),
            xenditData: value,
          };
          const _where = {
            where: {
              xenditCode: value.code.trim(),
            },
          };
          const upsert = await this.#bankUpsert(_where, temp);
          if (upsert.status == 500) {
            result.push(`xenditCode ${value.code} : ${upsert.msg}`);
          }
        }
        // if(result.length >0){
        //     log.cronlog(JSON.stringify(result))
        // }else{
        //     log.cronlog("Xendit bank data synced")
        // }
        return 'OK';
      }
    } catch (e) {
      throw new HttpException(
        { status: 500, message: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async #ilumaSync() {
    try {
      const payload = {
        provider: 'iluma',
        func: 'bank-list',
        credential: this.configService.get('ilumaToken'),
      };
      const iluma = await this.yggdrasilService.refund(payload);
      const payloadLog = {
        url: 'https://api.iluma.ai/bank/available_bank_codes',
        payload: null,
        method: 'get',
        response: iluma,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString(),
      };
      const payloadLogSave = await this.repositoryCallLog.create(payloadLog);
      await this.repositoryCallLog.save(payloadLogSave);
      if (iluma.status != 200) {
        throw new Error(iluma.msg);
      } else {
        const result = [];
        for (const value of iluma.data) {
          const _where = {
            where: {
              xenditCode: value.code.trim(),
            },
          };
          const check = await this.repositoryRefundBank.findOne(_where);
          if (check) {
            const data = {
              ilumaCode: value.code.trim(),
              ilumaData: value,
            };
            await this.repositoryRefundBank.update(check.id, data);
          } else {
            result.push(
              `iluma ${value.code} : cant mapping to xendit bank data`,
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

  async #bankUpsert(where: object, payload: object) {
    try {
      const check = await this.repositoryRefundBank.findOne(where);
      // console.log(check);
      if (check) {
        payload['updatedAt'] = moment().toISOString();
        await this.repositoryRefundBank.update(check.id, payload);
      } else {
        payload['createdAt'] = moment().toISOString();
        payload['updatedAt'] = moment().toISOString();
        const payloadSave = await this.repositoryRefundBank.create(payload);
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

  async #getXenditToken() {
    const pgData = await this.paymentGatewayService.findOneLikeName({
      pgName: 'xendit',
    });
    const credentialData = JSON.parse(pgData.credential);
    const credential = credentialData[await this.configService.get('nodeEnv')];
    return credential;
  }
}
