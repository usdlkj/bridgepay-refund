import { Injectable } from '@nestjs/common';
import { IlumaService as IlumaGatewayService } from 'src/3rd-party/iluma/iluma.service';

@Injectable()
export class IlumaService {
  constructor(private ilumaGatewayService: IlumaGatewayService) {}

  async handler(payload) {
    const func = payload.func;

    if (func == 'bank-list') {
      return await this.ilumaGatewayService.bankList(payload);
    } else if (func == 'bank-validator') {
      return await this.ilumaGatewayService.bankValidator(payload);
    } else if (func == 'get-webhook') {
      return await this.ilumaGatewayService.getWebhook(payload);
    } else if ((func == 'set-webhook')) {
      return await this.ilumaGatewayService.setWebhook(payload);
    } else if ((func == 'update-webhook')) {
      return await this.ilumaGatewayService.updateWebhook(payload);
    } else if (func == 'get-result') {
      return await this.ilumaGatewayService.getResult(payload);
    } else {
      throw new Error('invalid function');
    }
  }
}
