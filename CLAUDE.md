# @heyatom/client — consumer SDK per FileHarbor, Articuno, Beacon

Package npm unico con subpath export per servizio. Sostituisce i moduli client copiati a mano in
dbdbuilds-api, shelfie-api, website4 (e sgweb). Gemello di `../bastion-client`
(`@heyatom/bastion-client`): stessa struttura, stesso build, stessa filosofia. Leggerlo per primo.

## Decisioni già prese (non riaprire)

- **Un package, subpath per servizio.** Non un package per servizio.
  ```
  @heyatom/client/fileharbor        core: FileHarborClient + tipi
  @heyatom/client/fileharbor/nest   FileHarborModule.forRoot / forRootAsync
  @heyatom/client/articuno          core: ArticunoClient + tipi
  @heyatom/client/articuno/nest
  @heyatom/client/beacon            (fase 2, non ora)
  ```
  Nessun export root che trascina tutto. Nest è peer dep opzionale, usata solo dai subpath `/nest`.
- **Core su `fetch` nativo.** Niente axios, `@nestjs/axios`, `form-data`. Multipart con `FormData`/`Blob` nativi
  (Node 18+). I consumer Nuxt/Nitro (website4) devono importare il core senza dipendenze Nest.
- **Auth pluggabile, non hardcoded.** Ogni client riceve `auth: () => Promise<Record<string,string>> | Record<string,string>`.
  Modi già in uso dai consumer, tutti da supportare con helper pronti:
  - FileHarbor: `X-API-Key` + `X-User-Id` (vedi `../docs/FILEHARBOR_INTEGRATION.md`)
  - Articuno: `X-API-Key` tenant **oppure** `Authorization: Bearer <service-client JWT>` mintato via
    `ServiceTokenProvider` di `@heyatom/bastion-client` (vedi `../dbdbuilds/projects/dbdbuilds-api/src/modules/articuno/articuno-client.service.ts`)
  `@heyatom/bastion-client` è peer dep opzionale, importata solo dall'helper bastion.
- Admin routes (`/admin/*`, `/me/*`) are Meridian-only and stay out of the package.
- **Tipi generati da OpenAPI, mai scritti a mano.** Tutti i servizi espongono Swagger su `/docs`
  (`/docs-json`). Pipeline: `openapi/<service>.json` committato → `openapi-typescript` → `src/<service>/types.gen.ts`
  committato. Script `pnpm gen:types`. Preferire uno script di dump nel servizio (boot Nest senza `listen`,
  `SwaggerModule.createDocument`, scrivi file) al fetch da istanza in esecuzione; se serve toccare il
  servizio, aggiungere solo lo script `openapi:dump` in `package.json` + un file `scripts/`.
- **Nel package va solo ciò che è identico in tutti i consumer:** endpoint, auth header, tipi, mapping
  errori (`HeyAtomHttpError` con status + body, come `BastionHttpError`). Policy applicativa (allowlist MIME,
  limiti dimensione, cleanup, retention) resta nei consumer. Confronta
  `../shelfie/shelfie-api/src/modules/fileharbor` (73 righe, wrapper puro = perimetro giusto) con
  `../dbdbuilds/projects/dbdbuilds-api/src/modules/fileharbor` (424 righe, piena di policy = NON copiare).

## Fase 1 (questo lavoro)

1. Scaffold: `package.json` (name `@heyatom/client`, exports map con subpath, ESM+CJS dual build come bastion-client),
   `tsconfig*.json`, `vitest.config.ts`, `.github/workflows/{test,publish}.yml` copiati e adattati da `../bastion-client`.
2. `openapi/fileharbor.json`, `openapi/articuno.json` + `types.gen.ts` generati.
3. `src/fileharbor/`: client core (images, avatars, albums, videos, tags: copri le route che i consumer usano
   oggi, elenco da dbdbuilds-api + shelfie-api) + `nest/` module.
4. `src/articuno/`: client core (articles, categories, tags, comments, bookmarks, interactions, reports,
   translations, users: perimetro = `../dbdbuilds/projects/dbdbuilds-api/src/modules/articuno/services/`) + `nest/` module.
   Regola critica: ogni chiamata porta il `tenantId`/tenant scope; non passarlo = leak cross-tenant.
5. Test vitest per client core con `fetch` mockato (pattern in `../bastion-client/test/`), smoke DI per i moduli Nest
   (`../bastion-client/scripts/di-smoke.cjs`).
6. `README.md`: install, uso core (Nuxt) e Nest, migrazione da modulo copiato.

Non in fase 1: Beacon, Herald, Gatherly, migrazione dei consumer (arriva dopo, repo per repo).

## Convenzioni

- pnpm, TypeScript strict, ESM-first con `.js` negli import relativi (come bastion-client).
- Nessun `console.log`; logger iniettabile come `nest-logger.ts` di bastion-client.
- Commit su `main`, Conventional Commits.
