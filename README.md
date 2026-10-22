# @heyatom/client

Consumer SDK for the HeyAtom platform services. It replaces the `src/modules/fileharbor/` and `src/modules/articuno/` clients each app used to copy by hand. Twin of [`@heyatom/bastion-client`](https://github.com/heyatomdev/bastion-client).

| Import | What |
|---|---|
| `@heyatom/client/fileharbor` | `FileHarborClient` (API-key surface), auth helpers, generated types |
| `@heyatom/client/fileharbor/nest` | the above plus `HeyAtomFileHarborModule.forRoot / forRootAsync` |
| `@heyatom/client/articuno` | `ArticunoClient` (public, tenant-scoped surface), auth helpers, generated types |
| `@heyatom/client/articuno/nest` | the above plus `HeyAtomArticunoModule.forRoot / forRootAsync` |
| `@heyatom/client/webhooks` | `verifyStandardWebhook`: receiving side of the platform's Standard Webhooks (Articuno, Gatherly) |

There is no root export, so import a subpath. The core subpaths depend on nothing: they use native `fetch`, `FormData` and `Blob`, need Node ≥ 20.19, and run the same in Nuxt/Nitro. `@nestjs/common` is an optional peer, used only by `/nest`. `@heyatom/bastion-client` is an optional peer, needed only if you pass its `ServiceTokenProvider` to `serviceTokenAuth`. Ships CJS and ESM.

The package covers the routes consumer apps call. The console routes (`/admin/*`, `/me/*`) are Meridian-only and stay out of it. The package holds transport only: endpoints, auth headers, types and error mapping. Application policy stays in the app. That covers MIME allowlists, size limits, replacing an image and cleaning up the old one, and whether a 404 on delete counts as "already gone".

## Auth

Each client takes `auth`, a function that returns the credential headers and runs before every request:

```ts
apiKeyAuth(key)                        // X-API-Key: FileHarbor client key, or Articuno tenant key
serviceTokenAuth(provider, 'articuno') // Bearer service-client JWT from bastion-client's ServiceTokenProvider
```

A request never leaves the process without a credential. If `auth` yields neither a non-empty `X-API-Key` nor a `Bearer` token, the call throws before `fetch` runs. On Articuno the credential **is** the tenant scope: the tenant key, or the `tenantId` in the token. So an unscoped Articuno call is impossible by construction. Credential headers always override `opts.headers`.

The per-call options are `{ userId?, requestId?, headers?, timeoutMs?, signal? }`. `userId` is sent as `X-User-Id`, `requestId` as `X-Request-Id` (pass your own request id, api standard §7).

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
import { HeyAtomArticunoModule, serviceTokenAuth } from '@heyatom/client/articuno/nest';

@Module({
  imports: [
    HeyAtomFileHarborModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.getOrThrow('FILEHARBOR_URL'),
        auth: apiKeyAuth(config.getOrThrow('FILEHARBOR_API_KEY')),
      }),
    }),
    HeyAtomArticunoModule.forRootAsync({
      inject: [ConfigService, BastionService],
      useFactory: (config: ConfigService, bastion: BastionService) => ({
        baseUrl: config.getOrThrow('ARTICUNO_BASE_URL'),
        auth:
          config.get('ARTICUNO_AUTH_MODE') === 'bastion'
            ? serviceTokenAuth({ getToken: (slug) => bastion.serviceToken(slug) }, 'articuno')
            : apiKeyAuth(config.getOrThrow('ARTICUNO_TENANT_API_KEY')),
        timeoutMs: config.get('ARTICUNO_TIMEOUT_MS'),
      }),
    }),
  ],
})
export class AppModule {}

@Injectable()
export class BuildImagesService {
  constructor(private readonly fileharbor: FileHarborClient) {}

  upload(file: Express.Multer.File, userId: string) {
    // allowlist + size checks are yours, before this call
    return this.fileharbor.uploadImage(
      { data: file.buffer, filename: file.originalname, contentType: file.mimetype },
      { description: 'Build image' },
      { userId },
    );
  }
}
```

Both modules are global, so import each once in `AppModule`. They log failed calls through Nest's `Logger`: method, path and status only, never headers or bodies. The core clients take a `logger` option and stay silent by default.

## Errors

A non-2xx answer throws `HeyAtomHttpError { service, status, body, message, code, requestId }`. `message` is the validation detail (`errors[]` joined) when the service sent one, else its own `message`. `code` and `requestId` come from the error body. When the service is unreachable or the call times out, the error has status `503` and `body: undefined`.

The errors are not `HttpException`s: unmapped, Nest answers 500. An upstream 401 caused by a wrong API key must not reach your users as a 401 either. Handle the statuses that mean something in your domain, then hand the rest to `toHttpException` (from the `/nest` subpaths), which maps 404 to 404 `NOT_FOUND`, 503/504 to 503 `UNAVAILABLE` and everything else to 502 `UPSTREAM`, without the upstream body:

```ts
import { HeyAtomHttpError, toHttpException } from '@heyatom/client/fileharbor/nest';

try {
  await this.fileharbor.deleteAvatar(userId);
} catch (err) {
  if (err instanceof HeyAtomHttpError && err.status === 404) return;
  throw toHttpException(err);
}
```

Timeouts default to 10 s per request and 60 s for uploads.

## Webhooks

Articuno and Gatherly sign deliveries with [Standard Webhooks](https://www.standardwebhooks.com/) (`signStandardWebhook` of `@heyatom/nest-common/webhooks`). Verify them on the raw body, before parsing:

```ts
import { verifyStandardWebhook } from '@heyatom/client/webhooks';

const verified = verifyStandardWebhook({
  rawBody: req.rawBody,                          // Buffer as received: NestFactory.create(AppModule, { rawBody: true })
  headers: req.headers,                          // any case
  secrets: [config.webhookSecret, config.previousWebhookSecret].filter(Boolean), // rotation
  // toleranceSeconds: 300,
});
if (!verified) throw new UnauthorizedException();
// dedupe on verified.id (`webhook-id`, stable across retries and resends)
```

The signed content is `<webhook-id>.<webhook-timestamp>.<raw body>`, HMAC-SHA256 keyed with the secret as a UTF-8 string (not a `whsec_` base64 key), sent as a space-separated list of `v1,<base64>`. Any secret matching any entry accepts. It returns `null` on a missing header, a non-numeric timestamp or one more than `toleranceSeconds` (default 300) from now, or no match. Comparison is constant-time. Depends only on `node:crypto`. The test uses the fixed vector of `nest-common/docs/usage.md`. Bastion deliveries use their own format: verify them with `@heyatom/bastion-client/webhooks`.

## Endpoints

**`FileHarborClient`** (API key; `baseUrl` includes any proxy prefix, e.g. `/v2`): `uploadImage`, `updateImage`, `deleteImage`, `uploadAvatar`, `deleteAvatar`, `getClientStats`.

**`ArticunoClient`** (tenant key or service-client JWT):
- Articles and translations: `listArticles`, `getArticle(slug)`, `listTranslations`, `getTranslation`
- Categories and tags: `listCategories`, `getCategory(slug)`, `listTags`, `getTag(slug)`
- Comments: `createComment`, `listComments`, `getComment`, `updateComment`, `deleteComment`
- Interactions and bookmarks: `toggleLike`, `getInteractionStatus`, `toggleBookmark`, `listMyBookmarks`. `userId` is a required argument on all four. `recordView(articleId)` counts one view of a PUBLISHED article (204, 404 otherwise), without `userId`; Articuno does not dedupe, so filter bots and repeats in the app.
- Reports: `createReport`, `listReports`, `updateReportStatus`
- Users: `syncUser`, `deleteUser`

## Types

Types are generated, never written by hand, from the services' full specs (console routes included, though no client method calls them). Each service's OpenAPI document is committed as `openapi/<service>.json`, and `openapi-typescript` turns it into `src/<service>/types.gen.ts`. Every subpath re-exports the result: `paths`, `components`, `operations`, and one alias per schema (`ImageResponseDto`, `PublicCreateArticleDto`, and so on). Method inputs and outputs derive from `operations`. Every client method has a typed JSON response and body. If a service route ever ships without a response schema, its method returns `unknown`. The fix belongs in the service (`@ApiOkResponse({ type })`), followed by a regeneration. It does not belong here.

```bash
pnpm openapi:dump   # runs `pnpm openapi:dump` in ../fileharbor and ../articuno
pnpm gen:types      # openapi/*.json → src/*/types.gen.ts
```

Each service's `openapi:dump` (`scripts/openapi-dump.ts`) boots the Nest app without `listen()` and without `init()`, so `onModuleInit` never runs and Prisma never connects. Dummy values fill the required env vars. It then writes `SwaggerModule.createDocument` to a file. It needs no database and no running instance, and the output is deterministic.

## Migrating from a copied module

**shelfie-api `modules/fileharbor`**: drop the module and import `HeyAtomFileHarborModule.forRootAsync` with `baseUrl: \`${FILEHARBOR_URL}/v2\``. Then change the calls:
- `uploadImage(file, userId)` becomes `fileharbor.uploadImage({ data: file.buffer, filename: file.originalname, contentType: file.mimetype }, {}, { userId })`
- Keep the MIME and size checks in the app.
- `deleteImage` now throws on failure. Keep the old `.catch(warn)` at the call site if you want the swallow.

**dbdbuilds-api `modules/fileharbor`**: `FileHarborService` keeps its policy: `validateImageFile`, `deleteImageSafely`, `uploadImageIfProvided`, URL-to-id extraction and `uploadAvatarFromUrl`. Only its HTTP calls move to the client:
- `HttpService.post('/images', form)` becomes `uploadImage(file, { description }, { userId: externalId })`. The `creatorId` form field and `X-User-Id` are equivalent to FileHarbor, but the field is missing from the OpenAPI spec, so the typed path is `userId`.
- `/avatars` calls become `uploadAvatar(userId, file)` and `deleteAvatar(userId)`.
- `/client/stats` becomes `getClientStats()`.
- `error.response?.status` becomes `err.status`, with `err instanceof HeyAtomHttpError`.
- `@nestjs/axios`, `form-data` and `rxjs` `firstValueFrom` go away. Env: `FILE_HARBOR_URL`, `FILE_HARBOR_API_KEY`.

**dbdbuilds-api `modules/articuno`**: `ArticunoClient` plus the nine `services/*` collapse into one injected `ArticunoClient`. Pass `ARTICUNO_AUTH_MODE` through as in the Nest example above. The method names map one-to-one:
- `findAll` becomes `listArticles`, `findBySlug` becomes `getArticle`, `toggle` becomes `toggleBookmark`, `findMine` becomes `listMyBookmarks`, `sync` becomes `syncUser`, and so on.
- `ArticunoTagsService.findBySlug` called `/tags/slug/:slug`, which Articuno does not serve (always 404). `findOne(id)` hit `/tags/:slug` with an id. Both become `getTag(slug)`. `ArticunoCategoriesService.findOne(id)` has the same problem and becomes `getCategory(slug)`.

Beacon, Herald and Gatherly clients are out of scope for this release.
