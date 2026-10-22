# @heyatom/client

Client SDK for the HeyAtom platform services: FileHarbor (media), Articuno (content), Beacon
(streams) and Gatherly (events). Typed clients on native `fetch`, optional NestJS modules, and
Standard Webhooks verification. Twin of [`@heyatom/bastion-client`](https://www.npmjs.com/package/@heyatom/bastion-client).

```bash
pnpm add @heyatom/client
```

- Node ≥ 20.19. CJS and ESM builds. The core subpaths have no dependencies and run in any
  runtime, Nuxt/Nitro included.
- `/nest` subpaths: peer `@nestjs/common` 11.
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

**`FileHarborClient`** (API key): `uploadImage`, `updateImage`, `deleteImage`, `uploadAvatar`,
`deleteAvatar`, `getClientStats`.

**`ArticunoClient`** (tenant key or service-client token):
- Articles: `listArticles`, `getArticle(slug)`, `listTranslations`, `getTranslation`
- Categories and tags: `listCategories`, `getCategory(slug)`, `listTags`, `getTag(slug)`
- Comments: `createComment`, `listComments`, `getComment`, `updateComment`, `deleteComment`
- Interactions: `toggleLike`, `getInteractionStatus`, `toggleBookmark`, `listMyBookmarks` (all
  take the `userId`); `recordView(articleId)` counts one view and does not dedupe
- Reports: `createReport`, `listReports`, `updateReportStatus`
- Users: `syncUser`, `deleteUser`

**`BeaconClient`** (`anonymousAuth()`): `getCreator(name)`, `getTeam(slug)`, `getOrg(slug)`.
Answers keep the `{ data }` envelope.

**`GatherlyClient`** (service-client token): `listEvents`, `getEvent`, `getEventStats`,
`addParticipant(eventId, body, { idempotencyKey })`. Answers keep the `{ data }` envelope
(`{ data, meta }` for lists). `idempotencyKey` is sent as `Idempotency-Key`: a retry gets the
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

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT
