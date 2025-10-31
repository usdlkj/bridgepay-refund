import { Injectable } from '@nestjs/common';
import { XenditService } from './xendit/xendit.service';

import { getEnv } from 'src/utils/env.utils';
import { ConfigService } from '@nestjs/config';
import { IlumaService } from './iluma/iluma.service';

@Injectable()
export class RefundService {
  private env: string;
  constructor(
    private xenditService: XenditService,
    private ilumaService: IlumaService,
    private readonly configService: ConfigService,
  ) {
    this.env = getEnv(this.configService);
  }

  async handler(payload) {
    try {
      const provider = payload.provider;
      if (provider == 'iluma') {
        return await this.ilumaService.handler(payload);
      } else if (provider == 'xendit') {
        return await this.xenditService.handler(payload);
      } else {
        throw new Error('invalid 3rd-party provicer');
      }
    } catch (e) {
      return {
        status: 500,
        msg: e.message,
      };
    }
  }
}
