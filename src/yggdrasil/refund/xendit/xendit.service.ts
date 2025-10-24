import { Injectable } from '@nestjs/common';
import { XenditService as XenditGatewayService } from 'src/3rd-party/xendit/xendit.service';

@Injectable()
export class XenditService {
  constructor(private xenditGatewayService: XenditGatewayService) {}
  async handler(payload) {
    const func = payload.func;
    if (func == 'bank-list') {
      return await this.xenditGatewayService.refundBankList(payload);
    } else if (func == 'disbursement') {
      return await this.xenditGatewayService.disbursement(payload);
    } else if (func == 'get-balance') {
      return await this.xenditGatewayService.getBalance(payload);
    } else {
      throw new Error('invalid function');
    }
  }
}
