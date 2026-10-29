import { Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { RefundDeliveryService } from '../broker/refund-delivery.service';
import { RefundNotificationService } from './refund-notification.service';

// RPCs consumed by the P04 refund notification worker.
@Controller()
export class RefundNotificationController {
  constructor(
    private readonly service: RefundNotificationService,
    private readonly delivery: RefundDeliveryService,
  ) {}

  @MessagePattern({ cmd: 'claim-refund-notification' })
  claim(@Ctx() context: RmqContext) {
    return this.delivery.handle(context, () => this.service.claim());
  }

  @MessagePattern({ cmd: 'finish-refund-notification' })
  finish(@Payload() data, @Ctx() context: RmqContext) {
    return this.delivery.handle(context, () => this.service.finish(data));
  }

  @MessagePattern({ cmd: 'refund-notification-alert-delivered' })
  delivered(@Payload() data, @Ctx() context: RmqContext) {
    return this.delivery.handle(context, () =>
      this.service.markAlertDelivered(data.id),
    );
  }

  @MessagePattern({ cmd: 'refund-notification-health' })
  health(@Ctx() context: RmqContext) {
    return this.delivery.handle(context, () => this.service.health());
  }

  @MessagePattern({ cmd: 'refund-notification-alerts' })
  alerts(@Ctx() context: RmqContext) {
    return this.delivery.handle(context, () => this.service.monitor());
  }
}
