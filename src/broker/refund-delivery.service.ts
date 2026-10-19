import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqContext } from '@nestjs/microservices';

@Injectable()
export class RefundDeliveryService {
  private readonly logger = new Logger(RefundDeliveryService.name);
  private readonly queue: string;
  private readonly declarations = new WeakMap<object, Promise<void>>();

  constructor(config: ConfigService) {
    this.queue = config.get<string>('rabbitmq.refundQueue') ?? 'bridgepay-refund';
  }

  async handle<T>(
    context: RmqContext,
    work: () => Promise<T>,
    retry = false,
  ): Promise<T> {
    const channel = context.getChannelRef();
    const message = context.getMessage();
    // Do not process financial work until its failure queues are available.
    await this.declareQueues(channel);
    let result: T;
    try {
      result = await work();
    } catch (error) {
      try {
        await this.retainFailure(channel, message, retry);
        channel.ack(message);
      } catch (retentionError) {
        // Leave the original unacknowledged; a connection loss returns it to the queue.
        this.logger.error(`Could not retain failed Refund delivery: ${context.getPattern()}`);
        throw retentionError;
      }
      throw error;
    }
    channel.ack(message);
    return result;
  }

  private async retainFailure(
    channel: any,
    message: any,
    allowRetry: boolean,
  ): Promise<void> {
    const previous = Number(message.properties.headers?.['x-refund-retries'] ?? 0);
    const retries = Number.isSafeInteger(previous) && previous >= 0 ? previous : 0;
    const retry = allowRetry && retries < 3;
    const target = `${this.queue}.${retry ? 'retry' : 'failed'}`;
    await new Promise<void>((resolve, reject) => {
      channel.sendToQueue(
        target,
        message.content,
        {
          persistent: true,
          contentType: message.properties.contentType,
          correlationId: message.properties.correlationId,
          replyTo: message.properties.replyTo,
          messageId: message.properties.messageId,
          headers: {
            ...message.properties.headers,
            'x-refund-retries': retries + 1,
          },
        },
        (error: Error | null) => (error ? reject(error) : resolve()),
      );
    });
    this.logger.warn(`Refund delivery retained in ${target}`);
  }

  private declareQueues(channel: any): Promise<void> {
    let declaration = this.declarations.get(channel);
    if (!declaration) {
      declaration = (async () => {
        await channel.assertQueue(`${this.queue}.retry`, {
          durable: true,
          messageTtl: 60000,
          deadLetterExchange: '',
          deadLetterRoutingKey: this.queue,
        });
        await channel.assertQueue(`${this.queue}.failed`, { durable: true });
      })().catch((error) => {
        this.declarations.delete(channel);
        throw error;
      });
      this.declarations.set(channel, declaration);
    }
    return declaration;
  }
}
