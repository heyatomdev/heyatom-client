<p align="center">
  <img src="https://raw.githubusercontent.com/heyatomdev/heyatom-client/main/docs/brand/banner.png" width="500" alt="HeyAtom @heyatom/client" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@heyatom/client"><img src="https://img.shields.io/npm/v/@heyatom/client" alt="npm version" /></a>
  <a href="https://github.com/heyatomdev/heyatom-client/actions/workflows/test.yml"><img src="https://github.com/heyatomdev/heyatom-client/actions/workflows/test.yml/badge.svg?branch=main" alt="Test" /></a>
  <img src="https://img.shields.io/node/v/@heyatom/client" alt="Node version" />
  <img src="https://img.shields.io/npm/l/@heyatom/client" alt="License" />
</p>

# @heyatom/client

Client SDK for the HeyAtom platform services: FileHarbor (media), Articuno (content), Beacon
(streams) and Gatherly (events). Typed clients on native `fetch`, optional NestJS modules,
Standard Webhooks verification, and a Nuxt module for self-hosted Umami analytics. Twin of [`@heyatom/bastion-client`](https://www.npmjs.com/package/@heyatom/bastion-client).

```bash
pnpm add @heyatom/client
```

- Node ≥ 20.19. CJS and ESM builds. The core subpaths have no dependencies and run in any
  runtime, Nuxt/Nitro included.
- `/nest` subpaths: peer `@nestjs/common` 11.
- `/nuxt`: Nuxt 4 module, ESM only; peer `@nuxt/kit` (comes with `nuxt`).
- `@heyatom/bastion-client` is an optional peer, only to pass its `ServiceTokenProvider` to
  `serviceTokenAuth`.

| Import | What |
|---|---|
| `@heyatom/client/fileharbor` | `FileHarborClient`, auth helpers, generated types |
| `@heyatom/client/articuno` | `ArticunoClient`, auth helpers, generated types |
| `@heyatom/client/beacon` | `BeaconClient`, `anonymousAuth`, generated types |
| `@heyatom/client/gatherly` | `GatherlyClient`, `serviceTokenAuth`, generated types |
| `@heyatom/client/<service>/nest` | the above plus `HeyAtom<Service>Module.forRoot / forRootAsync` |
| `@heyatom/client/webhooks` | `verifyStandardWebhook` |
| `@heyatom/client/nuxt` | Nuxt module: Umami tracker behind a same-origin proxy, `useUmami()` |

There is no root export: import a subpath. The clients cover transport only (endpoints, auth
headers, types, errors); validation, size limits and cleanup policies stay in your app.

## Auth

Each client takes `auth`, a function returning the credential headers, called before every request:

```ts
apiKeyAuth(key)                        // X-API-Key: FileHarbor client key or Articuno tenant key
serviceTokenAuth(provider, 'articuno') // Bearer service-client token ('gatherly' for Gatherly)
anonymousAuth()                        // no credential: BeaconClient only
```

A request never leaves the process without a credential: if `auth` yields neither a non-empty
`X-API-Key` nor a `Bearer` token, the call throws before `fetch` runs. On Articuno the credential
is the tenant scope. `anonymousAuth()` is accepted only by `BeaconClient`; any other client throws
at construction when given it. Credential headers override `opts.headers`.

Per-call options: `{ userId?, requestId?, headers?, timeoutMs?, signal? }`. `userId` is sent as
`X-User-Id`, `requestId` as `X-Request-Id`.

## Core (Nuxt / Nitro, any runtime)

```ts
// server/utils/articuno.ts
import { ArticunoClient, apiKeyAuth } from '@heyatom/client/articuno';

const config = useRuntimeConfig();
export const articuno = new ArticunoClient({
  baseUrl: config.articunoUrl,
  auth: apiKeyAuth(config.articunoTenantApiKey), // server-only runtimeConfig, never public
});

// server/api/articles/[slug].get.ts
export default defineEventHandler((event) =>
  articuno.getArticle(getRouterParam(event, 'slug')!, { languageCode: getQuery(event).lang as string }),
);
```

## NestJS

```ts
import { HeyAtomFileHarborModule, apiKeyAuth } from '@heyatom/client/fileharbor/nest';
import { HeyAtomGatherlyModule, serviceTokenAuth } from '@heyatom/client/gatherly/nest';
import { BastionHttp, ServiceTokenProvider } from '@heyatom/bastion-client';

@Module({
  imports: [
    HeyAtomFileHarborModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.getOrThrow('FILEHARBOR_URL'),
        auth: apiKeyAuth(config.getOrThrow('FILEHARBOR_API_KEY')),
      }),
    }),
    HeyAtomGatherlyModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // one provider per process: it caches the token and renews it ahead of expiry
        const tokens = new ServiceTokenProvider(new BastionHttp({ baseUrl: config.getOrThrow('BASTION_URL') }), {
          apiKey: config.getOrThrow('BASTION_CLIENT_API_KEY'),
          serviceSlug: 'gatherly',
        });
        return { baseUrl: config.getOrThrow('GATHERLY_URL'), auth: serviceTokenAuth(tokens, 'gatherly') };
      },
    }),
  ],
})
export class AppModule {}

@Injectable()
export class ImagesService {
  constructor(private readonly fileharbor: FileHarborClient) {}

  upload(file: Express.Multer.File, userId: string) {
    // MIME allowlist and size checks are yours, before this call
    return this.fileharbor.uploadImage(
      { data: file.buffer, filename: file.originalname, contentType: file.mimetype },
      { description: 'Cover' },
      { userId },
    );
  }
}
```

The modules are global: import each once in `AppModule`. They log failed calls through Nest's
`Logger` (method, path and status, never headers or bodies). The core clients take a `logger`
option and are silent by default.

## Errors

A non-2xx answer throws `HeyAtomHttpError { service, status, body, message, code, requestId }`.
`message` is the validation detail when the service sent one, else its own message. An
unreachable service or a timeout gives status `503` and `body: undefined`. Timeouts default to
10 s, 60 s for uploads.

The errors are not `HttpException`s. Handle the statuses that mean something in your domain, then
pass the rest to `toHttpException` (from the `/nest` subpaths): 404 → 404 `NOT_FOUND`, 503/504 →
503 `UNAVAILABLE`, anything else → 502 `UPSTREAM`, without the upstream body. An upstream 401 from
a wrong API key must not reach your users as a 401.

```ts
import { HeyAtomHttpError, toHttpException } from '@heyatom/client/fileharbor/nest';

try {
  await this.fileharbor.deleteAvatar(userId);
} catch (err) {
  if (err instanceof HeyAtomHttpError && err.status === 404) return;
  throw toHttpException(err);
}
```

## Clients

Every client returns the response body as the service sends it: `{ data }` for a single
resource, `{ data, meta }` for a page (`page`, `limit` in the query). Unwrap `.data` yourself.

**`FileHarborClient`** (API key): `uploadImage`, `getImageInfo`, `updateImage`, `deleteImage`,
`uploadAvatar`, `deleteAvatar`, `getClientStats`.

**`ArticunoClient`** (tenant key or service-client token):
- Articles: `listArticles`, `getArticle(slug)`, `listTranslations`, `getTranslation`
- Categories and tags: `listCategories`, `getCategory(slug)`, `listTags`, `getTag(slug)`
- Comments: `createComment`, `listComments`, `getComment`, `updateComment`, `deleteComment`
- Interactions: `toggleLike`, `getInteractionStatus`, `toggleBookmark`, `listMyBookmarks` (all
  take the `userId`); `recordView(articleId)` counts one view and does not dedupe
- Reports: `createReport`, `listReports`, `updateReportStatus`
- Users: `syncUser`, `deleteUser`

**`BeaconClient`** (`anonymousAuth()`): `getCreator(name)`, `getTeam(slug)`, `getOrg(slug)`.

**`GatherlyClient`** (service-client token): `listEvents`, `getEvent`, `getEventStats`,
`addParticipant(eventId, body, { idempotencyKey })`. `idempotencyKey` is sent as `Idempotency-Key`: a retry gets the
original answer.

`baseUrl` includes any prefix a reverse proxy adds in front of the service.

## Types

Types are generated from each service's OpenAPI document (public routes only), never written by
hand. Every subpath
re-exports `paths`, `components`, `operations` and one alias per schema (`ImageResponseDto`,
`EventDetailResponseDto`, …), plus type helpers such as `ResponseOf` (the response of an
operation). Method inputs and outputs derive from them.

## Webhooks

Articuno and Gatherly sign deliveries with [Standard Webhooks](https://www.standardwebhooks.com/).
Verify them on the raw body, before parsing:

```ts
import { verifyStandardWebhook } from '@heyatom/client/webhooks';

const verified = verifyStandardWebhook({
  rawBody: req.rawBody,  // Buffer as received: NestFactory.create(AppModule, { rawBody: true })
  headers: req.headers,  // any case
  secrets: [secret, previousSecret].filter(Boolean), // both accepted during a rotation
  // toleranceSeconds: 300,
});
if (!verified) throw new UnauthorizedException();
// dedupe on verified.id (webhook-id, stable across retries)
```

HMAC-SHA256 over `<webhook-id>.<webhook-timestamp>.<raw body>`, secret used as a UTF-8 string,
any secret against any `v1` entry, constant-time comparison. Returns `null` on a missing header,
a timestamp outside `toleranceSeconds` (default 300) or no match. Bastion webhooks use their own
format: verify them with `@heyatom/bastion-client/webhooks`.

## Nuxt: Umami analytics

A Nuxt 4 module for a self-hosted [Umami](https://umami.is) (3.x). The tracker and the collect
endpoint are proxied through your app's own server, so visitors only ever talk to your domain and
the Umami dashboard stays unreachable from it.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@heyatom/client/nuxt'],
  umami: {
    websiteId: 'b59e9c65-…',
    domains: ['example.com', 'www.example.com'], // localhost and previews don't track
    // ignore: ['/auth/callback', '/admin/*'],
  },
});
```

| Option | Default | |
|---|---|---|
| `websiteId` | — | Required. Without it nothing is injected (warning at build). |
| `upstream` | `http://umami:3000` | Umami as your Nitro server reaches it. Server-only. |
| `path` | `/_u` | Same-origin prefix of the proxy. Build time only, not in runtime config. |
| `domains` | `[]` | `data-domains`: only these hostnames track. Empty = all. |
| `excludeHash` | `true` | Strip `#hash` from tracked URLs. |
| `excludeSearch` | `false` | Strip `?search`. Off, so `utm_*` / `ref` attribution works. |
| `ignore` | `[]` | Paths whose page views are not sent. Exact, trailing slash optional, `*` = anything. Custom events still go out. |
| `enabled` | production builds | Inject the tracker and serve the proxy. |

Everything except `path` can be overridden at runtime: `NUXT_PUBLIC_UMAMI_WEBSITE_ID`,
`NUXT_PUBLIC_UMAMI_ENABLED`, `NUXT_PUBLIC_UMAMI_DOMAINS` (comma list or JSON array),
`NUXT_PUBLIC_UMAMI_IGNORE`, `NUXT_PUBLIC_UMAMI_EXCLUDE_HASH`, `NUXT_PUBLIC_UMAMI_EXCLUDE_SEARCH`,
and `NUXT_UMAMI_UPSTREAM` (private runtime config, never sent to the browser).

**Events.** `data-umami-event` attributes work as usual. From code, the auto-imported composable:

```ts
const { track } = useUmami();
track('signup', { plan: 'pro' }); // no-op on the server, when disabled, or when the tracker is blocked
```

**Proxy.** Two server routes, everything else under `path` answers 404:

- `GET {path}/s.js` → `{upstream}/script.js` (the name every Umami image serves)
- `POST {path}/api/send` → `{upstream}/api/send` (body ≤ 64 KB, else 413)

The query string is never forwarded. Upstream gets only the body, `Content-Type`, `User-Agent`,
`Accept-Language`, `X-Umami-Cache`, and the visitor IP as `X-Client-IP`; the browser gets back
only the status, the body, `Content-Type` and `Cache-Control`. Cookies and `Authorization` never
leave the app. An unreachable upstream answers 502.

**Visitor IP.** Set `CLIENT_IP_HEADER=x-client-ip` on Umami. The module reads `X-Real-IP`, then
the socket address. `X-Real-IP` must be set by the reverse proxy in front of the app (for example
nginx `proxy_set_header X-Real-IP $remote_addr;`, after resolving the real client address) and
never passed through from the client, or visitors can forge their IP. `CF-Connecting-IP` is
deliberately not read: anyone reaching the origin directly can send it.

**`ignore`** is applied with Umami's `data-before-send` hook, through a small inline `<script>`
(`data-auto-track="false"` would also switch off `data-umami-event` click tracking). Under a
strict Content Security Policy that inline script needs `'unsafe-inline'`, a nonce or its hash in
`script-src`; without `ignore` there is no inline script.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
