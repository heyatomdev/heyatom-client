import { describe, expect, it } from 'vitest';
import { GatherlyClient, serviceTokenAuth } from '../src/gatherly/index.js';
import { fakeFetch, json } from './helpers.js';

const auth = serviceTokenAuth({ getToken: async (slug) => `jwt-for-${slug}` }, 'gatherly');

describe('GatherlyClient', () => {
  it('sends the service-client token on reads, with the list query', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { data: [] }));
    const gatherly = new GatherlyClient({ baseUrl: 'http://gatherly', auth, fetch: fetchImpl });

    await gatherly.listEvents({ status: 'PUBLISHED', limit: 100 });
    await gatherly.getEvent('e/1');
    await gatherly.getEventStats('e1');

    expect(calls.map((c) => c.url)).toEqual([
      'http://gatherly/events?status=PUBLISHED&limit=100',
      'http://gatherly/events/e%2F1',
      'http://gatherly/events/e1/stats',
    ]);
    for (const c of calls) expect(c.headers.Authorization).toBe('Bearer jwt-for-gatherly');
  });

  it('addParticipant posts the body and sends idempotencyKey as Idempotency-Key', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(201, { data: { status: 'REGISTERED' } }));
    const gatherly = new GatherlyClient({ baseUrl: 'http://gatherly', auth, fetch: fetchImpl });

    const res = await gatherly.addParticipant(
      'e1',
      { type: 'INLINE', role: 'ATTENDEE', userName: 'Ada', email: 'ada@example.com' },
      { idempotencyKey: 'k-1', headers: { 'X-Trace': 't' } },
    );

    expect(res.data.status).toBe('REGISTERED');
    expect(calls[0]).toMatchObject({ url: 'http://gatherly/events/e1/participants', init: { method: 'POST' } });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ type: 'INLINE', role: 'ATTENDEE', userName: 'Ada', email: 'ada@example.com' });
    expect(calls[0].headers).toMatchObject({ 'Idempotency-Key': 'k-1', 'X-Trace': 't', Authorization: 'Bearer jwt-for-gatherly' });
  });
});
