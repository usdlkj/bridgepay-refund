import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController health', () => {
  const build = (query: jest.Mock) =>
    new AppController({ getHello: () => 'x' } as never, { query } as never);

  it('liveness is static and never touches the database', () => {
    const query = jest.fn();
    expect(build(query).liveness()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('readiness is ok when the database answers', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    await expect(build(query).readiness()).resolves.toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('readiness returns 503 when the database fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('down'));
    await expect(build(query).readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
