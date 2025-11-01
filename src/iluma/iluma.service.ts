import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, MoreThan } from 'typeorm';
import { IlumaCallLog } from './entities/iluma-call-log.entity';
import { IlumaCallback } from './entities/iluma-callback.entity';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import { ConfigurationService } from 'src/configuration/configuration.service';
import * as moment from 'moment-timezone';
import { BankData } from './entities/bank-data.entity';

@Injectable()
export class IlumaService {
  private env: string;

  constructor(
    private helper: Helper,
    @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,

    @InjectRepository(RefundBank)
    private repositoryRefundBank: Repository<RefundBank>,

    @InjectRepository(IlumaCallLog)
    private repositoryCallLog: Repository<IlumaCallLog>,

    @InjectRepository(IlumaCallback)
    private repositoryCallback: Repository<IlumaCallback>,

    @InjectRepository(BankData)
    private repositoryBankData: Repository<BankData>,

    private readonly configService: ConfigService,

    private readonly yggdrasilService: YggdrasilService,

    private configurationService: ConfigurationService,
  ) {
    this.env = getEnv(this.configService);
  }

  async checkAccount(payload) {
    try {
      let accountName = null;
      let result;
      let status;
      const ilumaCode = await this.repositoryRefundBank.findOne({
        where: {
          xenditCode: payload.reqData.account.bankId,
        },
      });
      if (!ilumaCode) {
        result = {
          retCode: -1,
          retMsg: 'Bank code not found',
        };
        return result;
      }

      const bankData = {
        bank_account_number: payload.reqData.account.accountNo,
        bank_code: 'ID_' + ilumaCode.ilumaCode,
      };

      const datePastString = moment()
        .subtract(await this.configService.get('backdateAccountLastCheck'), 'd')
        .toISOString();
      const datePast = new Date(datePastString);

      const checkAccount = await this.repositoryBankData.findOne({
        where: {
          accountNumber: payload.reqData.account.accountNo,
          lastCheckAt: MoreThan(datePast),
        },
        order: {
          createdAt: 'DESC',
        },
      });
      let bankDataRecord;
      if (checkAccount) {
        const accountData = checkAccount;
        const status = checkAccount.accountResult;
        if (accountData.accountStatus.toLowerCase() == 'completed') {
          const sign = await this.helper.sign(JSON.stringify({ status }));
          result = {
            retCode: 0,
            message: 'Success',
            retData: {
              status,
            },
            signMsg: sign,
          };
          return result;
        } else {
          throw new Error(accountData.accountNumber + ' has been checking');
        }
      } else {
        const bankDataPayload = {
          accountNumber: payload.reqData.account.accountNo,
          accountStatus: 'pending',
          lastCheckAt: moment().toISOString(),
          createdAt: moment().toISOString(),
          updatedAt: moment().toISOString(),
        };
        const savePayload =
          await this.repositoryBankData.create(bankDataPayload);
        bankDataRecord = await this.repositoryBankData.save(savePayload);
      }

      const payloadValidator = {
        provider: 'iluma',
        func: 'bank-validator',
        data: bankData,
        credential: this.configService.get('ilumaToken'),
      };
      const checkIluma = await this.yggdrasilService.refund(payloadValidator);
      if (checkIluma.status != 200) {
        result = {
          retCode: -1,
          retMsg: checkIluma.msg,
        };
        return result;
      }
      const payloadLog = {
        url: 'https://api.iluma.ai/v1.2/identity/bank_account_validation_details',
        payload: bankData,
        method: 'post',
        response: checkIluma.data,
      };
      const payloadLogSave = await this.repositoryCallLog.create(payloadLog);
      await this.repositoryCallLog.save(payloadLogSave);

      if (checkIluma.data.status.toLowerCase() == 'pending') {
        const ilumaPayload = {
          callbackType: 'BANK_NAME_VALIDATOR_DETAILS',
          requestNumber: checkIluma.data.id,
          payload: checkIluma,
          createdAt: moment().toISOString(),
          updatedAt: moment().toISOString(),
        };
        const ilumaPayloadSave =
          await this.repositoryCallback.create(ilumaPayload);
        const ilumaReq = await this.repositoryCallback.save(ilumaPayloadSave);
        if (!ilumaReq) {
          result = {
            retCode: -1,
            retMsg: 'Fail save iluma Callback Data',
          };
          return result;
          ``;
        }
        status = 'pending';
        let flag = 0;

        //get limit & sleep timer
        const getLimit = await this.configurationService.findByConfigName(
          'CHECK_ACCOUNT_RETRY_COUNT',
        );
        let limit = 6;
        if (getLimit) {
          limit = parseInt(getLimit.configValue);
        }
        if (limit < 1) {
          limit = 6;
        }
        let sleepTimer = 5000;

        const _whereTimer = {
          configName: 'CHECK_ACCOUNT_SLEEP_PERIOD',
        };
        const getTimer = await this.configurationService.findByConfigName(
          'CHECK_ACCOUNT_SLEEP_PERIOD',
        );
        if (getTimer) {
          sleepTimer = parseInt(getTimer.configValue);
        }
        if (sleepTimer < 1000) {
          sleepTimer = 5000;
        }
        //end get limit & sleep timer

        while (flag < limit) {
          const sleep = await this.helper.sleep(sleepTimer);
          const payloadGetResult = {
            provider: 'iluma',
            func: 'get-result',
            requestId: checkIluma.data.id,
            credential: await this.configService.get('ilumaToken'),
          };
          const check = await this.yggdrasilService.refund(payloadGetResult);
          const payloadLog = {
            url:
              'https://api.iluma.ai/v1.2/identity/bank_account_validation_details/' +
              checkIluma.data.id +
              '',
            payload: checkIluma.data.id,
            method: 'post',
            response: check,
          };
          const payloadLogSave =
            await this.repositoryCallLog.create(payloadLog);
          await this.repositoryCallLog.save(payloadLogSave);
          if (
            check.data.status.toLowerCase() == 'completed' &&
            check.data.result.is_found == true &&
            check.data.result.is_virtual_account == false
          ) {
            status = 'success';
            accountName = check.data.result.account_holder_name;
            flag = limit;
            await this.repositoryBankData.update(bankDataRecord.id, {
              accountResult: 'success',
              ilumaData: check,
              updatedAt: moment().toISOString(),
              accountStatus: 'completed',
            });
          } else if (check.data.status.toLowerCase() == 'pending') {
            flag++;
          } else {
            await this.repositoryBankData.update(bankDataRecord.id, {
              accountResult: 'failed',
              ilumaData: check,
              updatedAt: moment().toISOString(),
              accountStatus: 'completed',
            });
            status = 'failed';
            flag = limit;
          }
        }
        // console.log(status)
      } else if (
        checkIluma.data.status.toLowerCase() == 'completed' &&
        checkIluma.data.result.is_found == true &&
        checkIluma.data.result.is_virtual_account == false
      ) {
        status = 'success';
        accountName = checkIluma.data.result.account_holder_name;
        if (!bankDataRecord) {
          const checkData = await this.repositoryBankData.findOne({
            where: {
              id: payload.reqData.account.accountNo,
              accountStatus: 'pending',
            },
          });
          if (checkData) {
            await this.repositoryBankData.update(checkData.id, {
              accountResult: 'success',
              ilumaData: checkIluma,
              updatedAt: moment().toISOString(),
              accountStatus: 'completed',
            });
          }
        } else {
          await this.repositoryBankData.update(bankDataRecord.id, {
            accountResult: 'success',
            ilumaData: checkIluma,
            updatedAt: moment().toISOString(),
            accountStatus: 'completed',
          });
        }
      } else {
        ((status = 'failed'), (accountName = null));
        if (!bankDataRecord) {
          const checkData = await this.repositoryBankData.findOne({
            where: {
              id: payload.reqData.account.accountNo,
              accountStatus: 'pending',
            },
          });
          if (checkData) {
            await this.repositoryBankData.update(checkData.id, {
              accountResult: 'failed',
              ilumaData: checkIluma,
              updatedAt: moment().toISOString(),
              accountStatus: 'completed',
            });
          }
        } else {
          await this.repositoryBankData.update(bankDataRecord.id, {
            accountResult: 'failed',
            ilumaData: checkIluma,
            updatedAt: moment().toISOString(),
            accountStatus: 'completed',
          });
        }
      }
      const sign = await this.helper.sign(JSON.stringify({ status }));
      result = {
        retCode: 0,
        message: 'Success',
        retData: {
          status,
        },
        signMsg: sign,
      };
      return result;
    } catch (e) {
      const result = {
        retCode: -1,
        retMsg: e.message,
      };
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async ilumaBankValidator(data) {
    try {
      const _where = {
        where: {
          requestNumber: data.id,
        },
      };
      const check = await this.repositoryCallback.findOne(_where);
      if (check) {
        const payload = {
          response: data,
          responseAt: moment().format('YYYY-MM-DD HH:mm:ss'),
          updatedAt: moment().toISOString(),
        };
        const responseLog = await this.repositoryCallback.update(
          check.id,
          payload,
        );
        // if(data.result.is_found==true){
        //     let payAccount={
        //         refundId:check.refundId,
        //         refundBankData:ctx.params
        //     }
        //     var updatePayAccount = await ctx.call("ilumaCallback-model.update",payload);
        // }
      } else {
        throw new Error('Request Number not found');
      }
      return { message: 'OK' };
    } catch (e) {
      throw new HttpException(
        { status: 500, message: 'failed handle webhook' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
