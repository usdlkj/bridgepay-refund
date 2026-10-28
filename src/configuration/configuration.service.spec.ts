import { of, throwError, NEVER } from 'rxjs';
import { ConfigurationService } from './configuration.service';

describe('ConfigurationService (settings are read from Core, which owns them)', () => {
  const send = jest.fn();
  const service = () => new ConfigurationService({ send } as never);

  beforeEach(() => send.mockReset());

  it('asks Core for the setting by name and returns the row', async () => {
    send.mockReturnValue(
      of({ configName: 'REFUND_TRY_COUNT', configValue: '3' }),
    );

    await expect(
      service().findByConfigName('REFUND_TRY_COUNT'),
    ).resolves.toEqual({
      configName: 'REFUND_TRY_COUNT',
      configValue: '3',
    });
    expect(send).toHaveBeenCalledWith(
      { cmd: 'get-config-data' },
      { configName: 'REFUND_TRY_COUNT' },
    );
  });

  it('returns null when Core has no such setting, so callers use their defaults', async () => {
    send.mockReturnValue(of(null));
    await expect(service().findByConfigName('NOPE')).resolves.toBeNull();
  });

  it('returns null when Core fails, so a broker problem never stops a refund callback', async () => {
    send.mockReturnValue(throwError(() => new Error('broker down')));
    await expect(
      service().findByConfigName('REFUND_TRY_COUNT'),
    ).resolves.toBeNull();
  });

  it('gives up after the timeout when Core does not answer', async () => {
    jest.useFakeTimers();
    send.mockReturnValue(NEVER);
    const result = service().findByConfigName('REFUND_TRY_COUNT');
    await jest.advanceTimersByTimeAsync(5001);
    await expect(result).resolves.toBeNull();
    jest.useRealTimers();
  });
});
