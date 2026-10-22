import { HeyAtomHttp, seg, type HeyAtomClientOptions, type RequestOptions } from '../core/http.js';
import type { ResponseOf } from '../core/openapi.js';
import type { operations } from './types.gen.js';

type Res<K extends keyof operations> = ResponseOf<operations[K]>;

/**
 * Beacon's anonymous `/public` surface (read-only): build it with `auth: anonymousAuth()`.
 * `baseUrl` carries any prefix in front of `/public` (e.g. `https://beacon.example/api`).
 * Answers keep Beacon's `{ data }` envelope. Teams, orgs and games go by slug, creators by name.
 */
export class BeaconClient {
  protected readonly http: HeyAtomHttp;

  constructor(options: HeyAtomClientOptions) {
    this.http = new HeyAtomHttp('Beacon', options, { allowAnonymous: true });
  }

  private get<K extends keyof operations>(path: string, opts?: RequestOptions) {
    return this.http.json<Res<K>>('GET', `/public${path}`, {}, opts);
  }

  /** `GET /public/creators/:name` */
  getCreator(name: string, opts?: RequestOptions) {
    return this.get<'PublicController_getCreator'>(`/creators/${seg(name)}`, opts);
  }

  /** `GET /public/teams/:slug` */
  getTeam(slug: string, opts?: RequestOptions) {
    return this.get<'PublicController_getTeam'>(`/teams/${seg(slug)}`, opts);
  }

  /** `GET /public/orgs/:slug` */
  getOrg(slug: string, opts?: RequestOptions) {
    return this.get<'PublicController_getOrg'>(`/orgs/${seg(slug)}`, opts);
  }
}
