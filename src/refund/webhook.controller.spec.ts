import { WebhookController } from './webhook.controller';

describe('WebhookController token handling', () => {
  const xendit = jest.fn().mockResolvedValue({ message: 'OK' });
  const delivery = { handle: jest.fn((_ctx, work) => work()) };
  const controller = new WebhookController({ xendit } as any, delivery as any);
  beforeEach(() => xendit.mockClear());

  it('broker path trusts Gateway and does not require a token', async () => {
    await controller.webhookXenditRpc({ payload: { data: {} }, headers: undefined, req: {} } as any, {} as any);
    expect(xendit).toHaveBeenCalledWith({ data: {} }, undefined, {}, true);
  });

  it('direct HTTP route still passes the header for verification', async () => {
    await controller.webhookXendit({ data: {} } as any, { 'x-callback-token': 't' });
    expect(xendit).toHaveBeenCalledWith({ data: {} }, 't', { data: {} });
  });
});
