import * as http from 'http';
import { AddressInfo } from 'net';
import { Writable } from 'stream';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pinoHttp = require('pino-http');
import {
  ALLOWED_REQUEST_HEADERS,
  customLogLevel,
  httpLogOptions,
  reqSerializer,
  resSerializer,
} from './http-log';

// Values that must never reach a log line. They are fake, but shaped like the real ones.
const SECRETS = {
  'x-origin-verify': 'origin-secret-value-123',
  'x-callback-token': 'xendit-callback-token-456',
  signature: 'doku-signature-789',
  'client-id': 'doku-client-id-abc',
  'request-id': 'doku-request-id-def',
  'request-timestamp': '2026-10-24T01:02:03Z',
  cookie: 'session=cookie-secret-ghi',
  authorization: 'Bearer bearer-secret-jkl',
  'x-api-key': 'api-key-secret-mno',
  'proxy-authorization': 'proxy-secret-pqr',
};

const SAFE_HEADERS = {
  'user-agent': 'Xendit/1.0',
  'content-type': 'application/json',
  'content-length': '12',
  'x-amz-cf-id': 'cf-request-id-1',
  'x-amzn-trace-id': 'Root=1-abc-def',
  'x-forwarded-for': '203.0.113.9',
};

describe('http log serializers', () => {
  const req = {
    id: 7,
    method: 'POST',
    url: '/webhook/v1/xendit?param=sensitive-query-value&page=2',
    headers: { ...SECRETS, ...SAFE_HEADERS, host: 'midware.kcic.co.id' },
    remoteAddress: '10.0.4.20',
  };

  it('keeps only allow-listed headers', () => {
    const out = reqSerializer(req) as any;
    expect(Object.keys(out.headers).sort()).toEqual(
      Object.keys(SAFE_HEADERS).sort(),
    );
    for (const name of Object.keys(SECRETS)) {
      expect(out.headers).not.toHaveProperty(name);
    }
  });

  it('never lets a credential value into the serialized request', () => {
    const text = JSON.stringify(reqSerializer(req));
    for (const value of Object.values(SECRETS)) {
      expect(text).not.toContain(value);
    }
  });

  it('keeps the path and drops the query string, keeping only parameter names', () => {
    const out = reqSerializer(req) as any;
    expect(out.url).toBe('/webhook/v1/xendit');
    expect(out.queryKeys).toEqual(['param', 'page']);
    expect(JSON.stringify(out)).not.toContain('sensitive-query-value');
  });

  it('keeps the method and the request id', () => {
    const out = reqSerializer(req) as any;
    expect(out.method).toBe('POST');
    expect(out.id).toBe(7);
  });

  it('handles a request without headers or url', () => {
    expect(() => reqSerializer({})).not.toThrow();
    expect(() => reqSerializer(undefined as any)).not.toThrow();
  });

  it('serializes the response as the status code only', () => {
    const out = resSerializer({
      statusCode: 401,
      getHeaders: () => ({ 'set-cookie': 'a=b' }),
    } as any);
    expect(out).toEqual({ statusCode: 401 });
  });

  it('exposes the allow-list so reviewers can see it', () => {
    expect([...ALLOWED_REQUEST_HEADERS].sort()).toEqual(
      Object.keys(SAFE_HEADERS).sort(),
    );
  });
});

describe('customLogLevel', () => {
  const res200 = { statusCode: 200 } as any;

  it.each([
    '/',
    '/health',
    '/metrics',
    '/health/liveness',
    '/api/health',
    '/api/health/liveness',
    '/api/health/readiness',
    '/api/health/liveness?x=1',
  ])('is silent for the probe path %s', (url) => {
    expect(customLogLevel({ url } as any, res200, undefined as any)).toBe(
      'silent',
    );
  });

  it('logs real requests at info and failures at error', () => {
    expect(
      customLogLevel({ url: '/api/v1/check-billing' } as any, res200, undefined as any),
    ).toBe('info');
    expect(
      customLogLevel({ url: '/api/v1/check-billing' } as any, { statusCode: 401 } as any, undefined as any),
    ).toBe('info');
    expect(
      customLogLevel({ url: '/api/v1/check-billing' } as any, { statusCode: 500 } as any, undefined as any),
    ).toBe('error');
    expect(
      customLogLevel({ url: '/api/v1/check-billing' } as any, res200, new Error('boom')),
    ).toBe('error');
  });
});

describe('real pino-http logger (end to end)', () => {
  let server: http.Server;
  let lines: string[];

  beforeAll(async () => {
    lines = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const logger = pinoHttp({ ...httpLogOptions(), stream });
    server = http.createServer((req, res) => {
      logger(req, res);
      res.statusCode = req.url?.startsWith('/webhook') ? 200 : 204;
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const port = () => (server.address() as AddressInfo).port;

  it('writes the status, duration and route but none of the secrets', async () => {
    lines.length = 0;
    const res = await fetch(
      `http://127.0.0.1:${port()}/webhook/v1/xendit?param=sensitive-query-value`,
      // the body is exactly 12 bytes so it matches the content-length header below
      { method: 'POST', body: '{"a":"1234"}', headers: { ...SECRETS, ...SAFE_HEADERS } },
    );
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    const text = lines.join('');
    expect(text).toContain('"statusCode":200');
    expect(text).toContain('"responseTime"');
    expect(text).toContain('/webhook/v1/xendit');
    for (const value of Object.values(SECRETS)) {
      expect(text).not.toContain(value);
    }
    expect(text).not.toContain('sensitive-query-value');
  });

  it('writes nothing for the real probe paths', async () => {
    lines.length = 0;
    await fetch(`http://127.0.0.1:${port()}/api/health/liveness`);
    await fetch(`http://127.0.0.1:${port()}/api/health/readiness`);
    await new Promise((r) => setTimeout(r, 50));
    expect(lines.join('')).toBe('');
  });
});
