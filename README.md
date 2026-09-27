# @heyatom/client

Consumer SDK for the HeyAtom platform services. It replaces the `src/modules/fileharbor/` and `src/modules/articuno/` clients each app used to copy by hand. Twin of [`@heyatom/bastion-client`](https://github.com/heyatomdev/bastion-client).

| Import | What |
|---|---|
| `@heyatom/client/fileharbor` | `FileHarborClient` (API-key surface), `FileHarborAdminClient` (console `/admin` + `/me`), auth helpers, generated types |
| `@heyatom/client/fileharbor/nest` | the above plus `FileHarborModule.forRoot / forRootAsync` |
| `@heyatom/client/articuno` | `ArticunoClient` (public, tenant-scoped surface), `ArticunoAdminClient` (console `/admin`), auth helpers, generated types |
| `@heyatom/client/articuno/nest` | the above plus `ArticunoModule.forRoot / forRootAsync` |

There is no root export, so import a subpath. The core subpaths depend on nothing: they use native `fetch`, `FormData` and `Blob`, need Node ≥ 20.19, and run the same in Nuxt/Nitro. `@nestjs/common` is an optional peer, used only by `/nest`. `@heyatom/bastion-client` is an optional peer, needed only if you pass its `ServiceTokenProvider` to `serviceTokenAuth`. Ships CJS and ESM.

The package holds transport only: endpoints, auth headers, types and error mapping. Application policy stays in the app. That covers MIME allowlists, size limits, replacing an image and cleaning up the old one, and whether a 404 on delete counts as "already gone".

## Auth

Each client takes `auth`, a function that returns the credential headers and runs before every request:

```ts
apiKeyAuth(key)                        // X-API-Key: FileHarbor client key, or Articuno tenant key
bearerAuth(token | () => token)        // Authorization: Bearer — e.g. the Bastion user JWT a BFF forwards
serviceTokenAuth(provider, 'articuno') // Bearer service-client JWT from bastion-client's ServiceTokenProvider
```

A request never leaves the process without a credential. If `auth` yields neither a non-empty `X-API-Key` nor a `Bearer` token, the call throws before `fetch` runs. On Articuno the credential **is** the tenant scope: the tenant key, or the `tenantId` in the token. So an unscoped Articuno call is impossible by construction. Credential headers always override `opts.headers`.

The per-call options are `{ userId?, headers?, timeoutMs?, signal? }`. `userId` is sent as `X-User-Id`.

## Core (Nuxt / Nitro, any runtime)

```ts
// server/utils/fileharbor.ts — Meridian-style BFF forwarding the user's Bastion JWT
import { FileHarborAdminClient, bearerAuth } from '@heyatom/client/fileharbor';

export async function fileharborAdmin(event: H3Event) {
  const token = await requireBastionToken(event);
  return new FileHarborAdminClient({ baseUrl: useRuntimeConfig().fileharborUrl, auth: bearerAuth(token) });
}

// server/api/[tenant]/fileharbor/images/index.get.ts
export default defineEventHandler(async (event) => (await fileharborAdmin(event)).listImages(getQuery(event)));

// A binary route: stream the upstream Response straight through, Range included
export default defineEventHandler(async (event) => {
  const range = getRequestHeader(event, 'range');
  const res = await (await fileharborAdmin(event)).streamVideo(getRouterParam(event, 'id')!, { headers: range ? { Range: range } : {} });
  setResponseStatus(event, res.status);
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = res.headers.get(h);
    if (v) setResponseHeader(event, h, v);
  }
  return sendStream(event, res.body!);
});
```

A client is a plain object with no connections of its own, so building one per request for a per-user token is fine.

## NestJS

```ts
import { FileHarborModule, apiKeyAuth } from '@heyatom/client/fileharbor/nest';
import { ArticunoModule, serviceTokenAuth } from '@heyatom/client/articuno/nest';

@Module({
  imports: [
    FileHarborModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.getOrThrow('FILEHARBOR_URL'),
        auth: apiKeyAuth(config.getOrThrow('FILEHARBOR_API_KEY')),
      }),
    }),
    ArticunoModule.forRootAsync({
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

A non-2xx answer throws `HeyAtomHttpError { service, status, body, message }`. `message` is the service's own `message`, with arrays joined. When the service is unreachable or the call times out, the error has status `503` and `body: undefined`. The Nest modules do **not** turn these errors into `HttpException`s. An upstream 401 caused by a wrong API key must not reach your users as a 401. Map the errors you care about yourself:

```ts
try {
  await this.fileharbor.deleteAvatar(userId);
} catch (err) {
  if (!(err instanceof HeyAtomHttpError && err.status === 404)) throw err;
}
```

Timeouts default to 10 s per request and 60 s for uploads. Raw responses (`streamVideo`, `videoThumb`, `downloadImage`) have no timeout unless you pass one, because a timeout would cut a long stream mid-body.

## Endpoints

**`FileHarborClient`** (API key; `baseUrl` includes any proxy prefix, e.g. `/v2`): `uploadImage`, `deleteImage`, `uploadAvatar`, `deleteAvatar`, `getClientStats`.

**`FileHarborAdminClient`** (user JWT; `baseUrl` is the service root):
- Clients: `listClients`, `getClient`, `createClient`, `updateClient`
- Stats and tags: `getStats`, `listTags`
- Images: `listImages`, `getImage`, `uploadImages`, `updateImage`, `deleteImage`, `downloadImage` (raw), `tinifyCompressImage`
- Videos: `listVideos`, `getVideo`, `updateVideo`, `deleteVideo`, `streamVideo` (raw), `videoThumb` (raw)
- Avatars: `listAvatars`, `getAvatar`, `deleteAvatar`
- Albums: `listAlbums`, `getAlbum`, `createAlbum`, `updateAlbum`, `deleteAlbum`, `listAlbumItems`, `addAlbumItems`, `removeAlbumItems`
- Creators: `listCreators`, `getCreator`, `createCreator`, `updateCreator`
- Bookmarks: `listImageBookmarks`, `bookmarkImage`, `removeImageBookmark`, `listVideoBookmarks`, `bookmarkVideo`, `removeVideoBookmark`, `bookmarkCreator`, `removeCreatorBookmark`
- Self-service: `getMyAvatar`, `uploadMyAvatar`, `deleteMyAvatar`

**`ArticunoClient`** (tenant key or service-client JWT):
- Articles and translations: `listArticles`, `getArticle(slug)`, `listTranslations`, `getTranslation`
- Categories and tags: `listCategories`, `getCategory(slug)`, `listTags`, `getTag(slug)`
- Comments: `createComment`, `listComments`, `getComment`, `updateComment`, `deleteComment`
- Interactions and bookmarks: `toggleLike`, `getInteractionStatus`, `toggleBookmark`, `listMyBookmarks`. `userId` is a required argument on all four.
- Reports: `createReport`, `listReports`, `updateReportStatus`
- Users: `syncUser`, `deleteUser`

**`ArticunoAdminClient`** (user JWT):
- Articles: `listArticles`, `getArticle`, `createArticle(data, coverImage?)`, `updateArticle(id, data, coverImage?)`, `deleteArticle`
- Translations: `listTranslations`, `getTranslation`, `createTranslation`, `updateTranslation`, `deleteTranslation`
- Categories and tags: `list/get/create/update/delete` for each (`listCategories`, `createTag`, and so on)
- Banned words: `listBannedWords`, `createBannedWord`, `deleteBannedWord`
- Comments: `listComments`, `getComment`, `updateComment`, `deleteComment`
- Reports: `listReports`, `getReport`, `createReport`, `updateReportStatus`
- Users: `listUsers`, `getUser`, `updateUserStatus`, `deleteUser`
- Audits, notifications and stats: `listAudits`, `getAudit`, `listNotifications`, `getNotification`, `getDashboardStats`
- Webhooks: `listWebhooks`, `getWebhook`, `resendWebhook`, `resendAllFailedWebhooks`

## Types

Types are generated, never written by hand. Each service's OpenAPI document is committed as `openapi/<service>.json`, and `openapi-typescript` turns it into `src/<service>/types.gen.ts`. Every subpath re-exports the result: `paths`, `components`, `operations`, and one alias per schema (`ImageResponseDto`, `CreateArticleDto`, and so on). Method inputs and outputs derive from `operations`. Every client method has a typed JSON response and body, except the raw methods (`streamVideo`, `videoThumb`, `downloadImage`), which return a `Response`. If a service route ever ships without a response schema, its method returns `unknown`. The fix belongs in the service (`@ApiOkResponse({ type })`), followed by a regeneration. It does not belong here.

```bash
pnpm openapi:dump   # runs `pnpm openapi:dump` in ../fileharbor and ../articuno-root/articuno
pnpm gen:types      # openapi/*.json → src/*/types.gen.ts
```

Each service's `openapi:dump` (`scripts/openapi-dump.ts`) boots the Nest app without `listen()` and without `init()`, so `onModuleInit` never runs and Prisma never connects. Dummy values fill the required env vars. It then writes `SwaggerModule.createDocument` to a file. It needs no database and no running instance, and the output is deterministic.

## Migrating from a copied module

**shelfie-api `modules/fileharbor`**: drop the module and import `FileHarborModule.forRootAsync` with `baseUrl: \`${FILEHARBOR_URL}/v2\``. Then change the calls:
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

**meridian `server/utils/{fileharbor,articuno}-proxy.ts`**: build a `FileHarborAdminClient` or `ArticunoAdminClient` per request with `bearerAuth(await requireBastionToken(event))`.
- Each `[tenant]/fileharbor/*` and `[tenant]/articuno/*` route becomes one method call.
- `fileharborAdminRaw` routes use the raw methods (see the Nuxt example). Keep the header allowlist and the `cache-control: private` in Meridian.
- `fileharborSelf` becomes `getMyAvatar`, `uploadMyAvatar` and `deleteMyAvatar`.
- Map `HeyAtomHttpError` to `createError({ statusCode: err.status, message: err.message })` in one place.
- Article multipart: pass the parsed `data` and the cover part to `createArticle(data, { data: part.data, filename: part.filename, contentType: part.type })`.

Beacon, Herald and Gatherly clients are out of scope for this release.
