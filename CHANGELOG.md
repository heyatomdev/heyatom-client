# Changelog

## 1.0.0

First stable release. FileHarbor, Articuno and Gatherly move to the common response contract:
every JSON answer is wrapped in `{ data }`, pages are `{ data, meta }` with `page` / `limit` in
the query. The clients return the body as the service sends it and never unwrap it: read `.data`.

### Breaking

- **FileHarbor** (types from FileHarbor 3.6.1):
  - `uploadImage`, `updateImage`, `deleteImage`, `uploadAvatar`, `deleteAvatar` and
    `getClientStats` return `{ data: X }` instead of `X`.
  - Lists take `limit` instead of `perPage` and answer `{ data, meta }` instead of
    `{ data, pagination }`.
  - Exported types removed: `ListImagesResponseDto`, `ListAlbumsResponseDto`,
    `ListVideosResponseDto`, `AlbumItemListResponseDto`, `PaginationMetaDto`,
    `AlbumItemPaginationDto`, `VideoPaginationMetaDto`. Use `PageMetaDto` for `meta`.
- **Articuno**:
  - `getArticle`, `getTranslation`, `getCategory`, `getTag`, `createComment`, `getComment`,
    `updateComment`, `toggleLike`, `getInteractionStatus`, `toggleBookmark`, `createReport`,
    `updateReportStatus` and `syncUser` return `{ data: X }` instead of `X`.
  - `listTranslations` returns `{ data: X[] }` instead of a bare array.
  - Lists already answered `{ data, meta }`: unchanged.
- **Gatherly**:
  - `GET /tags/:tagId/events` is paginated (`page`, `limit`) and answers `{ data: EventWithCountResponseDto[], meta }`;
    `TagEventResponseDto` and `TaggedEventDto` are removed from the exported types. No client
    method calls this route.
  - The methods of `GatherlyClient` already returned `{ data }`: unchanged.

### Added

- `FileHarborClient.getImageInfo(imageId)`: `GET /images/:imageId?info=true`, the image's
  metadata (`{ data?: ImageResponseDto }`).

### Changed

- FileHarbor types regenerated: `ImageResponseDto` gains an optional `srcset` (absolute URLs,
  public images only), ready for `<img srcset>`.

## 0.3.0

### Added

- `@heyatom/client/beacon` (+ `/nest`): `BeaconClient` for Beacon's anonymous `/public` routes:
  `getCreator`, `getTeam`, `getOrg`.
- `@heyatom/client/gatherly` (+ `/nest`): `GatherlyClient` over a service-client token:
  `listEvents`, `getEvent`, `getEventStats`, `addParticipant` (with `idempotencyKey`).
- `anonymousAuth()`: no credential. Only `BeaconClient` accepts it; every other client throws at
  construction when given it, and an `auth` returning `{}` is still refused everywhere.

### Changed

- The generated types cover the public routes only: console routes (`/admin`, `/me`, `/extension`)
  and the schemas only they use are no longer exported. No client method used them.
- FileHarbor and Articuno types regenerated (FileHarbor 3.5.0, Articuno 1.4.0). Additive: the
  only change on a route the clients call is an optional `article` on `CommentListItemDto`.

## 0.2.2

### Added

- `FileHarborClient.updateImage`.
- `ArticunoClient.recordView`.

### Changed

- FileHarbor and Articuno types regenerated.

## 0.2.1

### Fixed

- `verifyStandardWebhook` ignores whitespace-only secrets instead of keying the HMAC with them.

## 0.2.0

### Added

- `@heyatom/client/webhooks`: `verifyStandardWebhook`, the receiving side of Standard Webhooks.
- `RequestOptions.requestId`, sent as `X-Request-Id`.
- `HeyAtomHttpError` exposes the error body's `code` and `requestId`; `message` prefers the
  validation detail in `errors[]`.
- `toHttpException` from the `/nest` subpaths: 404 → `NOT_FOUND`, 503/504 → `UNAVAILABLE`,
  anything else → 502 `UPSTREAM`, never the upstream body.

## 0.1.0

First release: `FileHarborClient` and `ArticunoClient` on native `fetch`, generated types, NestJS
modules `HeyAtomFileHarborModule` / `HeyAtomArticunoModule`, auth helpers `apiKeyAuth` and
`serviceTokenAuth`.
