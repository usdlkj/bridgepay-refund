import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { IlumaService } from './iluma.service';
import { RefundDeliveryService } from '../broker/refund-delivery.service';

/**
 * IlumaWorkerController
 *
 * Listens to asynchronous polling jobs fired by the synchronous `checkAccount()`
 * method. This controller runs inside the microservice context and delegates polling
 * to IlumaService.pollIlumaResult().
 */
@Controller()
export class IlumaWorkerController {
  constructor(
    private readonly ilumaService: IlumaService,
    private readonly delivery: RefundDeliveryService,
  ) {}

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
  @EventPattern('refund.iluma.poll')
  async handleRefundIlumaPoll(
    @Payload() data: { requestId: string; bankDataId: string },
    @Ctx() context: RmqContext,
  ) {
    return this.delivery.handle(context, () => this.ilumaService.pollIlumaResult(data), true);
  }
}
