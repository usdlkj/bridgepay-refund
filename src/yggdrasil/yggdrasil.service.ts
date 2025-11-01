import { Injectable } from '@nestjs/common';

import { RefundService } from './refund/refund.service';

@Injectable()
export class YggdrasilService {
  constructor(private refundService: RefundService) {}

  async refund(payload) {
    return await this.refundService.handler(payload);
  }
}
