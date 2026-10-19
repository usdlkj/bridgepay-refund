import { RefundDeliveryService } from './refund-delivery.service';

describe('RefundDeliveryService', () => {
  const message = (retries = 0) => ({
    content: Buffer.from('synthetic-message'),
    properties: {
      headers: { 'x-refund-retries': retries },
      correlationId: 'synthetic-correlation',
      replyTo: 'synthetic-reply',
    },
  });

  const setup = (retries = 0) => {
    const delivery = new RefundDeliveryService({ get: () => 'bridgepay-refund' } as any);
    const received = message(retries);
    const channel = {
      ack: jest.fn(),
      nack: jest.fn(),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn((_queue, _content, _options, confirm) => confirm(null)),
    };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => received,
      getPattern: () => 'refund.webhook.xendit.disbursement',
    } as any;
    return { delivery, received, channel, context };
  };

  it('acknowledges only after successful processing', async () => {
    const { delivery, received, channel, context } = setup();
    const work = jest.fn(async () => {
      expect(channel.ack).not.toHaveBeenCalled();
      return 'done';
    });
    await expect(delivery.handle(context, work)).resolves.toBe('done');
    expect(channel.ack).toHaveBeenCalledWith(received);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('does not process a delivery when its retention queues are unavailable', async () => {
    const { delivery, channel, context } = setup();
    channel.assertQueue.mockRejectedValue(new Error('queue unavailable'));
    const work = jest.fn(async () => 'done');
    await expect(delivery.handle(context, work)).rejects.toThrow('queue unavailable');
    expect(work).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('confirms a persistent delayed retry before acknowledging a failed delivery', async () => {
    const { delivery, received, channel, context } = setup();
    channel.sendToQueue.mockImplementation((_queue, _content, _options, confirm) => {
      expect(channel.ack).not.toHaveBeenCalled();
      confirm(null);
    });
    await expect(delivery.handle(context, async () => { throw new Error('failed'); }, true))
      .rejects.toThrow('failed');
    expect(channel.assertQueue).toHaveBeenCalledWith('bridgepay-refund.retry', {
      durable: true,
      messageTtl: 60000,
      deadLetterExchange: '',
      deadLetterRoutingKey: 'bridgepay-refund',
    });
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'bridgepay-refund.retry',
      received.content,
      expect.objectContaining({
        persistent: true,
        headers: { 'x-refund-retries': 1 },
      }),
      expect.any(Function),
    );
    expect(channel.ack).toHaveBeenCalledWith(received);
  });

  it('retains an exhausted delivery in the failed queue', async () => {
    const { delivery, channel, context } = setup(3);
    await expect(delivery.handle(context, async () => { throw new Error('failed'); }, true))
      .rejects.toThrow('failed');
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'bridgepay-refund.failed',
      expect.any(Buffer),
      expect.objectContaining({ headers: { 'x-refund-retries': 4 } }),
      expect.any(Function),
    );
  });

  it('leaves the original unacknowledged when replacement publication is not confirmed', async () => {
    const { delivery, channel, context } = setup();
    channel.sendToQueue.mockImplementation((_queue, _content, _options, confirm) =>
      confirm(new Error('broker publish failed')),
    );
    await expect(delivery.handle(context, async () => { throw new Error('failed'); }))
      .rejects.toThrow('broker publish failed');
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('retains a payout RPC failure without automatically retrying the payout', async () => {
    const { delivery, channel, context } = setup();
    await expect(delivery.handle(context, async () => { throw new Error('ambiguous payout'); }))
      .rejects.toThrow('ambiguous payout');
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'bridgepay-refund.failed',
      expect.any(Buffer),
      expect.anything(),
      expect.any(Function),
    );
  });
});
