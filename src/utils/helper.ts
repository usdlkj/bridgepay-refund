import Hashids from 'hashids';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as refundConfig from 'src/config/refund.config';

const refundEnv = refundConfig.default();
export class Helper {
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
    console.log(refundEnv);
    const filename = refundEnv.refund.keyFilePrivate || 'pgmid';
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

    if (refundEnv.refund.keyFilePrivatePass != '') {
      signFormat['passphrase'] = refundEnv.refund.keyFilePrivatePass;
    }

    const sign = crypto.createSign('SHA256');
    sign.update(msg);
    sign.end();
    const signature = sign.sign(signFormat, 'base64');
    return signature;
  }

  async signTicketing(msg) {
    const filename = refundEnv.refund.keyFilePrivate || 'pgmid';
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

    if (refundEnv.refund.keyFilePrivatePass != '') {
      signFormat['passphrase'] = refundEnv.refund.keyFilePrivatePass;
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
}
