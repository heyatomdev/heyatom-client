import { describe, expect, it } from 'vitest';
import { anonymousAuth, BeaconClient } from '../src/beacon/index.js';
import { ArticunoClient } from '../src/articuno/index.js';
import { FileHarborClient } from '../src/fileharbor/index.js';
import { GatherlyClient } from '../src/gatherly/index.js';
import { fakeFetch, json } from './helpers.js';

describe('BeaconClient', () => {
  it('reads /public anonymously, under the baseUrl prefix, with the envelope kept', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { data: { slug: 'x' } }));
    const beacon = new BeaconClient({ baseUrl: 'http://beacon/api/', auth: anonymousAuth(), fetch: fetchImpl });

    await expect(beacon.getTeam('dbd builds')).resolves.toEqual({ data: { slug: 'x' } });
    await beacon.getOrg('heyatom');
    await beacon.getCreator('a/b');

    expect(calls.map((c) => c.url)).toEqual([
      'http://beacon/api/public/teams/dbd%20builds',
      'http://beacon/api/public/orgs/heyatom',
      'http://beacon/api/public/creators/a%2Fb',
    ]);
    for (const c of calls) expect(c.headers).toEqual({});
  });

  it('anonymousAuth is refused by every client that needs a credential', () => {
    const opts = { baseUrl: 'http://x', auth: anonymousAuth() };
    expect(() => new ArticunoClient(opts)).toThrow(/anonymousAuth is not accepted/);
    expect(() => new FileHarborClient(opts)).toThrow(/anonymousAuth is not accepted/);
    expect(() => new GatherlyClient(opts)).toThrow(/anonymousAuth is not accepted/);
  });

  it('an empty auth that is not anonymousAuth still never leaves the process', async () => {
    const { fetchImpl, calls } = fakeFetch();
    const beacon = new BeaconClient({ baseUrl: 'http://beacon', auth: () => ({}), fetch: fetchImpl });
    await expect(beacon.getTeam('t')).rejects.toThrow(/no X-API-Key or Bearer/);
    expect(calls).toHaveLength(0);
  });
});
