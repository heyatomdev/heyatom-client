import { createApp, toWebHandler } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import createUmamiProxy from '../src/nuxt/runtime/server/proxy.js';
import { setRuntimeConfig } from './nuxt-imports.js';

const handle = toWebHandler(createApp().use(createUmamiProxy('/_u')));
const call = (path: string, init?: RequestInit) => handle(new Request(`http://app.test${path}`, init));

let upstream: ReturnType<typeof vi.fn>;
const configure = (enabled = true) =>
  setRuntimeConfig({ umami: { upstream: 'http://umami:3000' }, public: { umami: { enabled, websiteId: 'w' } } });

beforeEach(() => {
  configure();
  upstream = vi.fn(
    async () =>
      new Response('{"cache":"c"}', {
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'umami=1',
          'access-control-allow-origin': '*',
        },
      }),
  );
  vi.stubGlobal('fetch', upstream);
});
afterEach(() => vi.unstubAllGlobals());

describe('umami proxy', () => {
  it('serves the tracker from upstream /script.js, without the query', async () => {
    const res = await call('/_u/s.js?v=1');
    expect(res.status).toBe(200);
    expect(upstream.mock.calls[0][0]).toBe('http://umami:3000/script.js');
  });

  it('forwards the allow-listed headers and X-Real-IP as X-Client-IP, nothing else either way', async () => {
    const res = await call('/_u/api/send?x=1', {
      method: 'POST',
      body: '{"type":"event"}',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'UA',
        'accept-language': 'it',
        'x-umami-cache': 'c0',
        cookie: 'session=secret',
        authorization: 'Bearer secret',
        'cf-connecting-ip': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
      },
    });
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('http://umami:3000/api/send');
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'user-agent': 'UA',
      'accept-language': 'it',
      'x-umami-cache': 'c0',
      'x-client-ip': '2.2.2.2',
    });
    expect(init.body).toBe('{"type":"event"}');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"cache":"c"}');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('413 on an oversized body, before upstream', async () => {
    const big = 'x'.repeat(64 * 1024 + 1);
    expect((await call('/_u/api/send', { method: 'POST', body: big })).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('502 when upstream is unreachable', async () => {
    upstream.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect((await call('/_u/s.js')).status).toBe(502);
  });

  it('404 outside the allow-list and when disabled, without calling upstream', async () => {
    expect((await call('/_u/login')).status).toBe(404);
    expect((await call('/_u/api/websites')).status).toBe(404);
    expect((await call('/_u/s.js', { method: 'POST' })).status).toBe(404);
    configure(false);
    expect((await call('/_u/s.js')).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});
