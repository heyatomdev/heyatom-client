import {
  defineEventHandler,
  getRequestHeader,
  getRequestIP,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
  useRuntimeConfig,
} from '#imports';
import { pickClientIp, UMAMI_MAX_BODY, upstreamPath, type UmamiPublicOptions } from '../utils.js';

// Cookie and Authorization never leave the app: only these go upstream.
const FORWARDED = ['content-type', 'user-agent', 'accept-language', 'x-umami-cache'];

/**
 * Same-origin proxy: `GET {path}/s.js` and `POST {path}/api/send` only, everything else 404.
 * `path` is baked in at build time (generated template): the route is mounted on it.
 */
export default function createUmamiProxy(path: string) {
  return defineEventHandler(async (event) => {
    const config = useRuntimeConfig(event);
    const pub = config.public.umami as UmamiPublicOptions;
    const target = pub.enabled ? upstreamPath(event.method, event.path, path) : null;
    // Plain 404, not createError: that would render the app's error page.
    const fail = (status: number) => {
      setResponseStatus(event, status);
      return '';
    };
    if (!target) return fail(404);

    const headers: Record<string, string> = {};
    for (const name of FORWARDED) {
      const v = getRequestHeader(event, name);
      if (v) headers[name] = v;
    }
    const ip = pickClientIp((n) => getRequestHeader(event, n), getRequestIP(event));
    if (ip) headers['x-client-ip'] = ip;

    let body: string | undefined;
    if (target === '/api/send') {
      if (Number(getRequestHeader(event, 'content-length')) > UMAMI_MAX_BODY) return fail(413);
      const raw = (await readRawBody(event, false)) ?? Buffer.alloc(0);
      if (raw.byteLength > UMAMI_MAX_BODY) return fail(413);
      body = raw.toString('utf8'); // tracker payloads are JSON text
    }

    let res: Response;
    try {
      res = await fetch((config.umami as { upstream: string }).upstream + target, {
        method: event.method,
        headers,
        body,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return fail(502);
    }
    setResponseStatus(event, res.status);
    for (const name of ['content-type', 'cache-control']) {
      const v = res.headers.get(name);
      if (v) setResponseHeader(event, name, v);
    }
    return res.text();
  });
}
