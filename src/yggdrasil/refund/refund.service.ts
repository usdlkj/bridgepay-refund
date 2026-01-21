import { Injectable, Logger } from '@nestjs/common';
import { XenditService } from './xendit/xendit.service';

import { getEnv } from 'src/utils/env.utils';
import { ConfigService } from '@nestjs/config';
import { IlumaService } from './iluma/iluma.service';
import { sanitizeErrorMessage } from 'src/utils/error-sanitizer';

@Injectable()
export class RefundService {
  private env: string;
  private readonly logger = new Logger(RefundService.name);

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
      // Log full error for debugging
      this.logger.error('Yggdrasil refund handler error', {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        provider: payload?.provider,
      });

      // Return sanitized message to client
      const sanitizedMessage = sanitizeErrorMessage(
        e,
        'Failed to process refund request',
        500,
      );

      return {
        status: 500,
        msg: sanitizedMessage,
      };
    }
  }
}
