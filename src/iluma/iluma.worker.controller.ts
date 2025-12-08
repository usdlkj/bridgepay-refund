import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { IlumaService } from './iluma.service';

/**
 * IlumaWorkerController
 *
 * Listens to asynchronous polling jobs fired by the synchronous `checkAccount()`
 * method. This controller runs inside the microservice context and delegates polling
 * to IlumaService.pollIlumaResult().
 */
@Controller()
export class IlumaWorkerController {
  constructor(private readonly ilumaService: IlumaService) {}

  /**
   * Handle fallback polling jobs.
   *
   * Emits payload shape:
   *   {
   *     requestId: string;
   *     bankDataId: string;
   *   }
   *
   * This will NOT return anything to the caller; it is fire-and-forget.
   */
  @MessagePattern('refund.iluma.poll')
  async handleRefundIlumaPoll(
    @Payload() data: { requestId: string; bankDataId: string },
  ) {
    await this.ilumaService.pollIlumaResult(data);
    return;
  }
}
