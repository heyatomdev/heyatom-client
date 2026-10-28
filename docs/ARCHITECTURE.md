# Architettura di `@heyatom/client`

**Aggiornato**: 2026-10-28 (1.1.0)

Documento interno: come è fatto il package, perché, e come si mantiene. L'uso dall'esterno sta
nel [README](../README.md) (pubblico, su npm). Le regole HTTP comuni sono in
[`docs/standards/api.md`](../../docs/standards/api.md); le decisioni di perimetro in
[`CLAUDE.md`](../CLAUDE.md). Gemello di `../bastion-client` (stessa build, stessa filosofia).

## Entry point

| Import | Sorgente | Dipendenze |
|---|---|---|
| `@heyatom/client/<service>` | `src/<service>/` + `src/core/` | solo Node (≥ 20.19): `fetch`, `FormData`, `Blob` nativi |
| `@heyatom/client/<service>/nest` | `src/<service>/nest/` + `src/nest/` (riesporta il core) | peer `@nestjs/common` |
| `@heyatom/client/webhooks` | `src/webhooks/` | solo `node:crypto` |
| `@heyatom/client/nuxt` | `src/nuxt/` (solo ESM) | peer `@nuxt/kit` ^4 |

`<service>`: `fileharbor`, `articuno`, `beacon`, `gatherly`. Nessun export root: un consumer
Nuxt/Nitro importa il core senza trascinarsi Nest. `@heyatom/bastion-client` è peer opzionale,
serve solo a chi passa il suo `ServiceTokenProvider` a `serviceTokenAuth`.

Build doppia con `tsc` (`tsconfig.cjs.json`, `tsconfig.esm.json`), `dist/esm/package.json` con
`"type": "module"`, come bastion-client. `scripts/di-smoke.cjs` (`pnpm test:di`) avvia i quattro
moduli Nest da `dist/cjs` e verifica che l'auth arrivi a `fetch`.

## Perimetro

- **Solo le route che i consumer chiamano.** Le route di console (`/admin/*`, `/me/*`) sono di
  Meridian e restano fuori (`cec8c92` ha tolto i client admin), anche dai tipi pubblicati (sotto).
- **Solo trasporto**: endpoint, header di auth, tipi, mapping errori. La policy (allowlist MIME,
  limiti di dimensione, replace-and-cleanup, "404 su delete = già cancellato") resta nell'app.
  Riferimento: shelfie-api `modules/fileharbor` (wrapper puro) contro dbdbuilds-api
  `modules/fileharbor` (piena di policy, da non copiare).
- **Un metodo si aggiunge quando un consumer lo usa.** Gatherly copre oggi quello che usa sgweb;
  dbdbuilds-api lo userà dopo e si aggiunge allora.

## Core

### `HeyAtomHttp` (`src/core/http.ts`)

Trasporto condiviso, non esportato: ogni client è la faccia pubblica.

- **Mai una richiesta senza credenziale.** Prima di `fetch`, `send()` chiama `auth()` e rifiuta se
  non c'è né `X-API-Key` non vuoto né `Bearer <token>`. Su Articuno la credenziale **è** il tenant
  (la chiave del tenant o il `tenantId` del token): una chiamata senza è un leak cross-tenant, e
  questo controllo lo rende impossibile per costruzione.
- **`anonymousAuth()`** è l'unica eccezione, esplicita su due lati: il consumer la passa, e solo un
  client costruito con `new HeyAtomHttp(name, options, { allowAnonymous: true })` la accetta (oggi
  solo `BeaconClient`, per `/public`). Gli altri lanciano in costruzione. Il riconoscimento è per
  identità (`isAnonymousAuth`), non per forma: un `auth` che rende `{}` resta rifiutato anche su
  Beacon. Non allentare il controllo nel core per un nuovo servizio anonimo: usare l'opt-in.
- Header di credenziale applicati per ultimi: vincono su `opts.headers`.
- `fetch` legato in ritardo (`options.fetch ?? (...a) => fetch(...a)`): consumer e test possono
  sostituire il `fetch` globale dopo la costruzione.
- Errori: non-2xx → `HeyAtomHttpError { service, status, body, code, requestId }`, `message` dal
  primo di `errors[]` (validazione) poi `message`; irraggiungibile o timeout → 503 con
  `body: undefined`. Timeout 10 s, 60 s per gli upload.
- `requestId` → `X-Request-Id` (api.md §7), `userId` → `X-User-Id`.

### Nest (`src/nest/`)

Moduli globali `HeyAtom<Service>Module.forRoot / forRootAsync` (prefisso `HeyAtom` per non
scontrarsi con i moduli locali che ogni consumer ha già, `5c13491`). Logger Nest iniettato: metodo,
path e status, mai header o body. `toHttpException` mappa un `HeyAtomHttpError` a
404 `NOT_FOUND`, 503/504 `UNAVAILABLE`, resto 502 `UPSTREAM`, senza il body upstream (api.md §14).

### Webhook (`src/webhooks/`)

`verifyStandardWebhook`: lato ricevente di `signStandardWebhook` di `@heyatom/nest-common/webhooks`
(Articuno, Gatherly). Test sul vettore fisso di `nest-common/docs/usage.md`. Bastion usa un suo
formato: `@heyatom/bastion-client/webhooks`.

### Nuxt / Umami (`src/nuxt/`)

Sostituisce `simple-analytics-vue` nei siti Nuxt (heyatom-portfolio, dbdbuilds-web, sgweb).
Umami self-hosted su `stats.heyatom.dev`, container `umami:3000` sulla `internal_network` del
server Docker, dove girano anche le app: da qui il default di `upstream`. Spicy Potions (Cloudflare
Pages, Function sua) è fuori.

- `module.ts` (build, `@nuxt/kit`): fonde opzioni modulo + `runtimeConfig` già in nuxt.config,
  scrive `runtimeConfig.umami.upstream` (privato) e `runtimeConfig.public.umami` (senza `path`),
  auto-import `useUmami` e un solo handler Nitro `{path}/**`. `path` resta fuori dalla runtime
  config (la route è fissata in build): plugin e proxy sono factory (`createUmamiPlugin(path)`,
  `createUmamiProxy(path)`) e due template di una riga (`addPluginTemplate`, `addServerTemplate`)
  ci cuociono dentro il valore.
- `runtime/utils.ts`: tutto il puro (risoluzione opzioni, tag `<script>`, regex di `ignore`,
  allow-list del proxy, scelta IP). Nessun import: gira in Node, Nitro e browser. Test in
  `test/nuxt.test.ts`; il proxy in `test/nuxt-proxy.test.ts` (h3 `toWebHandler`, `fetch` stub,
  `#imports` → `test/nuxt-imports.ts` via alias in `vitest.config.ts`).
- `GET {path}/s.js` va a upstream `/script.js`: l'immagine ghcr di Umami 3.4.1 serve `/s.js` solo se
  buildata con `TRACKER_SCRIPT_NAME` (sul server lo riscrive nginx, ma il modulo parla diretto con
  `umami:3000`).
- IP: `X-Real-IP` poi socket. Niente `CF-Connecting-IP`: nginx lo inoltra così com'è dal client
  (`proxy-headers.conf`), mentre `X-Real-IP` è `$remote_addr` dopo `real_ip` sui range Cloudflare.
- `runtime/plugin.ts` (`#app`), `runtime/server/proxy.ts` (`#imports` di Nitro), `composable.ts`
  (solo `window`). tsc li compila lasciando `#app` / `#imports` intatti: li risolve Nuxt nell'app.
  Per il type-check `tsconfig.json` mappa `#app` sui tipi di `nuxt` e `#imports` su
  `runtime/server/imports.d.ts` (h3 + `nitropack/runtime`); `nuxt`, `h3`, `nitropack` sono solo dev.
- Solo ESM: `@nuxt/kit` è ESM-only, quindi `tsconfig.cjs.json` esclude `src/nuxt` e l'export
  `./nuxt` ha solo la condizione `import`.
- `ignore` via `data-before-send` e non via `data-auto-track="false"` + `router.afterEach`: nel
  tracker 3.x `auto-track=false` spegne anche i click `data-umami-event` (`handleClicks` sta in
  `init`). Lo script inline definisce la callback prima del tracker `defer`. `data-host-url`
  relativo funziona: l'endpoint è `${hostUrl}/api/send` passato a `fetch`.
- `path` è di build (ci si monta la route); il resto si sovrascrive a runtime con le env Nuxt.

Verifica fatta il 2026-10-28 su un'app Nuxt 4.6.3 con il tarball: build, proxy contro un upstream
finto con il tracker vero di Umami, pageview, click `data-umami-event`, `useUmami().track`,
navigazione SPA tracciata e `/auth/callback` scartata, 404 su `/_u/`, `/_u/login`, `/_u/api/*`.

## Tipi

Generati, mai scritti a mano.

```
servizio: pnpm openapi:dump  →  openapi/<service>.json (committato qui)
qui:      pnpm gen:types     →  src/<service>/types.gen.ts (committato, senza route di console)
```

```bash
pnpm openapi:dump   # pnpm openapi:dump in ../fileharbor, ../articuno, ../beacon, ../gatherly
pnpm gen:types      # openapi/*.json → src/*/types.gen.ts, filtrati da scripts/gen-types.mjs
pnpm check:api      # dopo un rilascio di un servizio
```

- L'`openapi:dump` di ogni servizio (`scripts/openapi-dump.ts`) avvia Nest senza `listen()` né
  `init()`: niente `onModuleInit`, Prisma non si connette, valori finti per le env obbligatorie.
  Nessun DB, nessuna istanza, output deterministico. Herald fa eccezione: sorgenti nodenext con
  import `.js` che ts-node non risolve, quindi `nest build` + `scripts/openapi-dump.cjs` su `dist/`.
- **Filtro dei tipi** (`scripts/gen-types.mjs`): `openapi/*.json` resta completo (lo legge
  `check:api`, e non è pubblicato: `files` = `dist`, README, CHANGELOG). Prima di
  `openapi-typescript` si tolgono i path con primo segmento in `admin`, `me`, `extension` (console di
  Meridian, self-service dell'utente, estensione Twitch di Beacon) e gli schema raggiunti solo da
  loro. Le route pubbliche restano anche se nessun metodo le usa: un sito può tipizzare una chiamata
  propria senza aspettare un rilascio. Restano descrizioni che nominano `/admin` dentro DTO
  condivisi: testo della spec, si correggono nel servizio se serve.
- **`check:api`** (`scripts/check-api.mjs`): per ogni servizio fa il dump dal repo accanto e
  confronta, per ogni `operationId` citato in `src/<service>/client.ts`, path, metodo, definizione
  e ogni schema raggiunto via `$ref` con la spec committata. Esce 1 su qualsiasi cambio. Le route
  non usate sono solo contate. `info.version` non è un segnale: i servizi aggiungono route senza
  alzarla.
- **Envelope.** I servizi con `TransformInterceptor` (Beacon, Gatherly; FileHarbor e Articuno dal
  client 1.0.0; Bastion dalla fase 3 del piano 01) rispondono `{ data }` e devono documentarlo con
  `ApiOkData` / `ApiCreatedData` di `@heyatom/nest-common` ≥ 0.4.0, non con
  `@ApiOkResponse({ type })`. Altrimenti la spec mente e i tipi generati seguono. Fix nel servizio,
  mai tipi a mano qui. Il client non toglie l'envelope: lo unwrap tocca ai consumer.
  Eccezione FileHarbor: le route file (`GET /images/:id`, avatar, video) sono `@NoTransform()`;
  con `?info=true` rispondono `{ data }` a mano, e la spec lo documenta senza `required`
  (`getImageInfo` → `{ data?: ImageResponseDto }`).
- Una route senza schema di risposta dà `unknown`: anche qui il fix è nel servizio.

## Migrazione dei consumer

**shelfie-api `modules/fileharbor`**: togliere il modulo, `HeyAtomFileHarborModule.forRootAsync`
con `baseUrl: \`${FILEHARBOR_URL}/v2\``.
- `uploadImage(file, userId)` → `fileharbor.uploadImage({ data: file.buffer, filename: file.originalname, contentType: file.mimetype }, {}, { userId })`.
- Controlli MIME e dimensione restano nell'app.
- `deleteImage` ora lancia: tenere il `.catch(warn)` al punto di chiamata se serve.
- Da 1.0.0 `uploadImage` rende `{ data: ImageResponseDto }`: leggere `.data`.

**articuno `modules/fileharbor`** (1.0.0): stessa policy tenuta in `FileHarborService`
(`validateImageFile`, `isUnderEndpoint`, estrazione id, 404 = già cancellata), solo l'HTTP passa al
client. La config è per tenant (`endpoint`, `apiKey`): un `FileHarborClient` per tenant, non il
modulo Nest globale.
- `HttpService.post('/images', form)` → `uploadImage(file, { description }, { userId: externalId })`
  (`creatorId` come sopra) → `.data.fullPath`.
- `HttpService.delete('/images/:id')` → `deleteImage(id)`; `error.response?.status === 404` →
  `err instanceof HeyAtomHttpError && err.status === 404`.

**beacon `modules/fileharbor`** (1.0.0): `baseUrl: \`${FILEHARBOR_URL}/v2\``, `apiKeyAuth`.
- `call('POST', '/images', form)` → `uploadImage(file, { tags: ['beacon', owner, kind] })` → `.data.fullPath`.
- `call('GET', '/images/:id?info=true')` → `getImageInfo(id)` → `.data?.tags`.
- `call('DELETE', '/images/:id')` → `deleteImage(id)`. Il timeout di 15 s → `timeoutMs: 15_000`.

**dbdbuilds-api `modules/fileharbor`**: `FileHarborService` tiene la sua policy
(`validateImageFile`, `deleteImageSafely`, `uploadImageIfProvided`, estrazione id dall'URL,
`uploadAvatarFromUrl`); solo le chiamate HTTP passano al client.
- `HttpService.post('/images', form)` → `uploadImage(file, { description }, { userId: externalId })`.
  Il campo form `creatorId` e `X-User-Id` sono equivalenti per FileHarbor, ma il campo manca dalla
  spec: il percorso tipizzato è `userId`.
- `/avatars` → `uploadAvatar(userId, file)` / `deleteAvatar(userId)`; `/client/stats` → `getClientStats()`.
- `error.response?.status` → `err.status` con `err instanceof HeyAtomHttpError`.
- Spariscono `@nestjs/axios`, `form-data`, `firstValueFrom`. Env: `FILE_HARBOR_URL`, `FILE_HARBOR_API_KEY`.

**dbdbuilds-api `modules/articuno`**: `ArticunoClient` + i nove `services/*` diventano un solo
`ArticunoClient` iniettato; `ARTICUNO_AUTH_MODE` sceglie tra `apiKeyAuth` e `serviceTokenAuth`.
- `findAll` → `listArticles`, `findBySlug` → `getArticle`, `toggle` → `toggleBookmark`,
  `findMine` → `listMyBookmarks`, `sync` → `syncUser`, e così via.
- `ArticunoTagsService.findBySlug` chiamava `/tags/slug/:slug`, che Articuno non serve (sempre 404);
  `findOne(id)` chiamava `/tags/:slug` con un id. Entrambi → `getTag(slug)`. Stesso problema per
  `ArticunoCategoriesService.findOne(id)` → `getCategory(slug)`.

**dbdbuilds-api `modules/beacon`**: togliere `BeaconClientService`, `HeyAtomBeaconModule` con
`auth: anonymousAuth()` e `baseUrl: BEACON_URL`. `beacon.get('/teams/x')` → `getTeam('x')`, idem
`getOrg`, `getCreator`. Il vecchio service toglieva `{ data }`, il client lo tiene: leggere `.data`.
`beacon.types.ts` sparisce a favore dei tipi generati.

**sgweb `server/utils/gatherly.ts`**: tenere il `ServiceTokenProvider` di modulo e costruire
`new GatherlyClient({ baseUrl: gatherlyUrl, auth: serviceTokenAuth(tokens, 'gatherly') })`.
`gatherlyFetch` → `listEvents`, `getEvent`, `getEventStats`, `addParticipant(id, body, { idempotencyKey })`.
Cache e sanificazione degli errori per il browser restano nell'app; `gatherly.types.ts` sparisce.

**Siti Nuxt con `simple-analytics-vue`** (heyatom-portfolio, dbdbuilds-web, sgweb): togliere il
plugin client e la dipendenza, `modules: ['@heyatom/client/nuxt']`, `umami: { websiteId, domains }`.
dbdbuilds-web: `ignorePages` → `ignore: ['/auth/callback']`; gli eventi custom di `AppHeader.vue`
(`saEvent(...)`) → `useUmami().track(...)` o `data-umami-event`.

## Rilascio

Alzare `version`, aggiornare `CHANGELOG.md`, commit, tag `vX.Y.Z`, push del tag. Il workflow
(`.github/workflows/publish.yml`) esegue lint/test/build/DI smoke e pubblica con npm trusted
publishing (OIDC, nessun token, provenance). Prima del rilascio: `pnpm check:api` pulito.

## Banner del README

`docs/brand/banner.html` → `banner.png` con `docs/brand/render.sh` (stessa pipeline di
`heyatom-portfolio/og`; mano ed esagoni copiati da lì). `docs/` è fuori da `files`: il README lo carica da
`raw.githubusercontent.com` (URL assoluto, così npm lo mostra).
