# Consumer di `@heyatom/client`

**Aggiornato**: 2026-11-02 (1.3.0)

Chi installa il package, cosa importa e con quale range. Da aggiornare a ogni rilascio, insieme al
bump nei consumer. Interno: non va su npm (vedi [`CLAUDE.md`](../CLAUDE.md), Documentazione).

| Consumer | Path (da `~/Developer`) | Stack | Entry point usati | Range |
|---|---|---|---|---|
| element-api | `element/element-api` | Node (JS) | `fileharbor` | `^1.3.0` |
| articuno | `heyatom/articuno` | NestJS | `fileharbor` | `^1.3.0` |
| almanac | `heyatom/almanac` | NestJS | `fileharbor/nest` | `^1.3.0` |
| beacon | `heyatom/beacon` | NestJS | `fileharbor` | `^1.3.0` |
| shelfie-api | `heyatom/shelfie/shelfie-api` | NestJS | `fileharbor/nest` | `^1.3.0` |
| dbdbuilds-api | `heyatom/dbdbuilds/projects/dbdbuilds-api` | NestJS | `fileharbor`, `fileharbor/nest`, `articuno`, `articuno/nest`, `beacon`, `beacon/nest`, `webhooks` | `^1.3.0` |
| sgweb | `heyatom/sgweb` | Nuxt 4 | `gatherly`, `nuxt` | `^1.3.0` |
| dbdbuilds-web | `heyatom/dbdbuilds/projects/dbdbuilds-web` | Nuxt 4 | `nuxt` | `^1.3.0` |
| beacon-gui | `heyatom/beacon-gui` | Nuxt 4 | `nuxt` | `^1.3.0` |
| puma-arts | `heyatom/puma-arts` | Nuxt 4 | `nuxt` | `^1.3.0` |
| heyatom-portfolio | `heyatom/heyatom-portfolio` | Nuxt 4 | `nuxt` | `^1.3.0` |
| spicypotions | `heyatom/spicypotions` | Nuxt 4 | `nuxt` | `^1.3.0` |
| wood19aw | `heyatom/wood19aw` | Nuxt 4 | `nuxt` | `^1.3.0` |
| nestjs-prisma-template | `heyatom/nestjs-prisma-template` | NestJS (scaffold) | `articuno/nest` | `^1.3.0` |

Non sono consumer: Meridian (chiama i servizi dal suo BFF, senza SDK) e i servizi che il package
copre (FileHarbor, Gatherly) quando non lo importano.

## Rifare il censimento

```bash
cd ~/Developer
find element heyatom medas personal -name package.json -maxdepth 5 \
  -not -path '*/node_modules/*' -not -path '*/.claude/*' -not -path '*/.nuxt/*' -not -path '*/.output/*' \
  | xargs grep -l '"@heyatom/client"' \
  | while read f; do d=$(dirname "$f"); echo "$d $(grep -o '"@heyatom/client": *"[^"]*"' "$f")"; \
    grep -rhoE "@heyatom/client(/[a-z-]+)*" "$d" --include='*.ts' --include='*.js' --include='*.mjs' --include='*.vue' \
      --exclude-dir=node_modules --exclude-dir=.nuxt --exclude-dir=.output --exclude-dir=dist | sort -u | tr '\n' ' '; echo; done
```

Legge il branch attivo di ogni repo: se un repo è su un feature branch vecchio il range può essere
falso (il template risultava `^0.3.0` da `chore/slim-prod-image`, mentre `main` era già a `^1.0.0`).
In caso di dubbio controllare il branch di integrazione: `git -C <repo> show <branch>:package.json`.

## Bump dopo un rilascio

In ogni consumer: `pnpm up "@heyatom/client@^X.Y.Z"` (aggiorna range e lockfile), poi typecheck
(`pnpm exec tsc --noEmit` sui Nest) o `pnpm build` (Nuxt), commit `chore(deps): @heyatom/client X.Y.Z`
con solo `package.json` e `pnpm-lock.yaml`. `pnpm up` può ri-risolvere anche dipendenze transitive
se il lockfile era indietro: controllare il diff del lockfile prima del commit.
