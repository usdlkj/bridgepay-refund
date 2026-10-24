/**
 * Request logging rules for the Gateway (audit T43).
 *
 * pino-http logs every request header, the query string and the remote address by default. The
 * Gateway receives credentials in headers (the CloudFront origin secret, the Xendit callback
 * token, DOKU signature headers, cookies), so the default wrote secrets to CloudWatch. Here a
 * request is logged from an ALLOW-LIST: anything not named below is dropped, including headers
 * added later. To log another header, add it to ALLOWED_REQUEST_HEADERS and justify it in review.
 */
import type { IncomingMessage, ServerResponse } from 'http';

// Safe for logs: they identify the client program and the AWS hops, never a credential.
export const ALLOWED_REQUEST_HEADERS = [
  'user-agent',
  'content-type',
  'content-length',
  'x-amz-cf-id', // CloudFront request id, to match CloudFront logs
  'x-amzn-trace-id', // ALB trace id, to match ALB access logs
  'x-forwarded-for',
] as const;

// Paths that only health probes call; logging them is noise (and the ALB uses `/`).
const PROBE_PATHS = ['/', '/health', '/api/health', '/metrics'];
const PROBE_PREFIXES = ['/health/', '/api/health/'];

function splitUrl(url: string): { path: string; query: string } {
  const q = url.indexOf('?');
  return q === -1
    ? { path: url, query: '' }
    : { path: url.slice(0, q), query: url.slice(q + 1) };
}

// pino-http hands the serializer the standard serialized request (id, method, url, headers, ...).
export function reqSerializer(req: any) {
  const headers: Record<string, unknown> = req?.headers ?? {};
  const { path, query } = splitUrl(typeof req?.url === 'string' ? req.url : '');
  const safe: Record<string, unknown> = {};
  for (const name of ALLOWED_REQUEST_HEADERS) {
    if (headers[name] !== undefined) safe[name] = headers[name];
  }
  return {
    id: req?.id,
    method: req?.method,
    url: path, // the path only: query values can carry identifiers or tokens
    queryKeys: query ? Array.from(new URLSearchParams(query).keys()) : [],
    headers: safe,
  };
}

// Status code only: response headers (set-cookie, tokens) are never logged.
export function resSerializer(res: Pick<ServerResponse, 'statusCode'>) {
  return { statusCode: res?.statusCode };
}

export function isProbePath(url: string | undefined): boolean {
  const { path } = splitUrl(url ?? '');
  return PROBE_PATHS.includes(path) || PROBE_PREFIXES.some((p) => path.startsWith(p));
}

export function customLogLevel(
  req: Pick<IncomingMessage, 'url'>,
  res: Pick<ServerResponse, 'statusCode'>,
  err?: Error,
): 'silent' | 'info' | 'error' {
  if (isProbePath(req.url)) return 'silent';
  return err || res.statusCode >= 500 ? 'error' : 'info';
}

export function httpLogOptions() {
  return {
    serializers: { req: reqSerializer, res: resSerializer },
    customLogLevel,
  };
}
