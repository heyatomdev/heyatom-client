import { describe, expect, it } from 'vitest';
import { apiKeyAuth, bearerAuth, FileHarborClient, HeyAtomHttpError } from '../src/fileharbor/index.js';
import { fakeFetch, json } from './helpers.js';

describe('shared transport', () => {
  it('sends the credential, X-User-Id and a JSON body; auth wins over per-call headers', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { ok: true }));
    const fh = new FileHarborClient({ baseUrl: 'http://fh/v2/', auth: apiKeyAuth('k1'), fetch: fetchImpl });

    await fh.deleteImage('a/b?c', { userId: 'u-1', headers: { 'X-API-Key': 'spoofed', 'X-Trace': 't' } });

    expect(calls[0].url).toBe('http://fh/v2/images/a%2Fb%3Fc');
    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].headers).toEqual({ 'X-API-Key': 'k1', 'X-User-Id': 'u-1', 'X-Trace': 't' });
  });

  it('maps a non-2xx answer to HeyAtomHttpError with status, body and the joined message', async () => {
    const body = { statusCode: 400, message: ['a is required', 'b is required'] };
    const { fetchImpl } = fakeFetch(() => json(400, body));
    const fh = new FileHarborClient({ baseUrl: 'http://fh', auth: apiKeyAuth('k'), fetch: fetchImpl });

    const err = await fh.getClientStats().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HeyAtomHttpError);
    expect(err).toMatchObject({ service: 'FileHarbor', status: 400, body, message: 'a is required, b is required' });
  });

  it('maps unreachable to a 503 and a 204 to undefined', async () => {
    const down = new FileHarborClient({ baseUrl: 'http://fh', auth: apiKeyAuth('k'), fetch: (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch });
    await expect(down.getClientStats()).rejects.toMatchObject({ status: 503, body: undefined });

    const { fetchImpl } = fakeFetch(() => new Response(null, { status: 204 }));
    const fh = new FileHarborClient({ baseUrl: 'http://fh', auth: apiKeyAuth('k'), fetch: fetchImpl });
    await expect(fh.deleteAvatar('u')).resolves.toBeUndefined();
  });

  it('never sends a request without a credential', async () => {
    const { fetchImpl, calls } = fakeFetch();
    const fh = new FileHarborClient({ baseUrl: 'http://fh', auth: () => ({ 'X-User-Id': 'u' }), fetch: fetchImpl });
    await expect(fh.getClientStats()).rejects.toThrow(/no X-API-Key or Bearer/);
    expect(calls).toHaveLength(0);
    expect(() => apiKeyAuth('')).toThrow();
    await expect(bearerAuth(() => '')()).rejects.toThrow(/empty/);
  });
});
