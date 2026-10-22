import { HeyAtomHttp, seg, type HeyAtomClientOptions, type RequestOptions } from '../core/http.js';
import type { BodyOf, QueryOf, ResponseOf } from '../core/openapi.js';
import type { operations } from './types.gen.js';

type Res<K extends keyof operations> = ResponseOf<operations[K]>;
type Q<K extends keyof operations> = QueryOf<operations[K]>;
type B<K extends keyof operations> = BodyOf<operations[K]>;

/**
 * Gatherly's machine surface, authenticated by a Bastion service-client token
 * (`serviceTokenAuth(provider, 'gatherly')`); the token's tenant selects the Gatherly client.
 *
 * Gatherly's OpenAPI documents no response bodies yet, so every answer is `unknown`
 * unless you pass your own type (`listEvents<Paginated<Event>>()`). The default turns
 * into the generated type on its own once Gatherly documents it.
 */
export class GatherlyClient {
  protected readonly http: HeyAtomHttp;

  constructor(options: HeyAtomClientOptions) {
    this.http = new HeyAtomHttp('Gatherly', options);
  }

  /** `GET /events` */
  listEvents<T = Res<'EventController_getEvents'>>(query?: Q<'EventController_getEvents'>, opts?: RequestOptions) {
    return this.http.json<T>('GET', '/events', { query: query as never }, opts);
  }

  /** `GET /events/:eventId` */
  getEvent<T = Res<'EventController_getEvent'>>(eventId: string, opts?: RequestOptions) {
    return this.http.json<T>('GET', `/events/${seg(eventId)}`, {}, opts);
  }

  /** `GET /events/:eventId/stats` */
  getEventStats<T = Res<'EventController_getEventStats'>>(eventId: string, opts?: RequestOptions) {
    return this.http.json<T>('GET', `/events/${seg(eventId)}/stats`, {}, opts);
  }

  /**
   * `POST /events/:eventId/participants` — INLINE (name, email) or EXTERNAL (externalId + externalSource).
   * Pass `idempotencyKey` (a UUID) to make retries safe: Gatherly answers a repeat with the cached response.
   */
  addParticipant<T = Res<'EventController_addParticipant'>>(
    eventId: string,
    body: B<'EventController_addParticipant'>,
    opts: RequestOptions & { idempotencyKey?: string } = {},
  ) {
    const { idempotencyKey, ...rest } = opts;
    const headers = idempotencyKey ? { ...rest.headers, 'Idempotency-Key': idempotencyKey } : rest.headers;
    return this.http.json<T>('POST', `/events/${seg(eventId)}/participants`, { body }, { ...rest, headers });
  }
}
