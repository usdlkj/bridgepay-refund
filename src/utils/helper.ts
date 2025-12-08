import Hashids from 'hashids';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { lastValueFrom } from 'rxjs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class Helper {
  constructor(private readonly configService: ConfigService) {}

  async dtoToJson(data) {
    const stringify = JSON.stringify(data);
    const result = JSON.parse(stringify);
    return result;
  }

  async generateHashId(data) {
    const hashids = new Hashids();
    const buffer = Buffer.from(data, 'utf8');
    return hashids.encodeHex(buffer.toString('hex'));
  }

  async calculateTotalAmount(amount, feeData, extraFee = 0) {
    const feeDetail = JSON.parse(feeData);
    let percentFee = 0;
    if (feeDetail.percentage != 0) {
      percentFee = (amount * feeDetail.percentage) / 100;
    }
    const result = {
      baseAmount: amount,
      percentFee: percentFee,
      fixedFee: feeDetail.fixed,
      extraFee: extraFee,
      totalFee: percentFee * 1 + feeDetail.fixed * 1,
      type: null,
      totalAmount: 0,
    };
    if (feeDetail['type']) {
      result.type = feeDetail.type.toLowerCase();
      if (feeDetail.type.toLowerCase() == 'inclusive') {
        result.totalAmount = amount * 1;
      } else {
        result.totalAmount = amount * 1 + percentFee * 1 + feeDetail.fixed * 1;
      }
    } else {
      result.type = 'inclusive';
      result.totalAmount = amount * 1;
    }
    //adding extra Fee
    result.totalAmount = result.totalAmount * 1 + extraFee;
    //end adding extra Fee
    return result;
  }
  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async sign(msg) {
    const filename =
      this.configService.get<string>('refund.keyFilePrivate') || 'pgmid';

    const pkey = fs.readFileSync(
      path.join(__dirname, '../../key/' + filename),
      {
        encoding: 'utf8',
        flag: 'r',
      },
    );

    const signFormat = {
      key: pkey,
    };

    const pass = this.configService.get<string>('refund.keyFilePrivatePass');
    if (pass) {
      signFormat['passphrase'] = pass;
    }

    const sign = crypto.createSign('SHA256');
    sign.update(msg);
    sign.end();
    const signature = sign.sign(signFormat, 'base64');
    return signature;
  }

  async signTicketing(msg) {
    const filename =
      this.configService.get<string>('refund.keyFilePrivate') || 'pgmid';
    const pkey = fs.readFileSync(
      path.join(__dirname, '../../key/' + filename),
      {
        encoding: 'utf8',
        flag: 'r',
      },
    );
    const signFormat = {
      key: pkey,
    };

    const pass = this.configService.get<string>('refund.keyFilePrivatePass');
    if (pass) {
      signFormat['passphrase'] = pass;
    }

    const sign = crypto.createSign('SHA256');
    sign.update(msg);
    sign.end();
    const signature = sign.sign(signFormat, 'base64');
    return signature;
  }

  async totalAmountDisbursement(amount: any) {
    const amountAndFee =
      parseInt(amount) + parseInt(process.env.DISBURSEMENT_FEE_FIX);
    const ppn =
      (parseInt(process.env.DISBURSEMENT_FEE_FIX) *
        parseInt(process.env.PPN_VALUE)) /
      100;
    const totalAmount = amountAndFee + Math.ceil(ppn);
    const result = {
      amount: parseInt(amount),
      fee: parseInt(process.env.DISBURSEMENT_FEE_FIX),
      AmountAfterFee: amountAndFee,
      tax: Math.ceil(ppn),
      totalAmount: totalAmount,
    };
    return result;
  }

  async statusWording(key) {
    const refundStatus = {
      rbdApproval: 'RBD approval',
      financeApproval: 'Finance approval',
      pendingDisbursement: 'PG process',
      success: 'success',
      reject: 'reject',
      fail: 'fail',
      done: 'done',
      onHold: 'onHold',
      cancel: 'cancel',
      retry: 'retry',
      pendingChecking: 'pending Checking to Ticketing',
    };
    return refundStatus[key];
  }

  maskString(value: string, visibleDigits = 4) {
    if (!value) {
      return value;
    }
    const unmaskedLength = Math.min(visibleDigits, value.length);
    const maskedSection = '*'.repeat(value.length - unmaskedLength);
    const visibleSection = value.slice(-unmaskedLength);
    return maskedSection + visibleSection;
  }

  async getXenditCredential(
    coreService: ClientProxy,
    logger: Logger,
    nodeEnv: string,
  ) {
    const credentialStr = await this.sendCore(
      coreService,
      logger,
      'get-credential-by-pg-code',
      { pgCode: 'xendit' },
      'get xendit credential',
    );
    const credentialObj = JSON.parse(credentialStr);
    return nodeEnv == 'production'
      ? credentialObj.production
      : credentialObj.development;
  }

  private async sendCore(
    coreService: ClientProxy,
    logger: Logger,
    pattern: any,
    data?: any,
    label?: string,
  ) {
    if (typeof pattern === 'string') {
      pattern = { cmd: pattern }; // 🔥 auto-fix for legacy calls
    }

    try {
      return await lastValueFrom(coreService.send(pattern, data));
    } catch (err) {
      logger.error({ err, pattern, label }, '[PublicAPI] core call failed');
      throw err;
    }
  }
}
