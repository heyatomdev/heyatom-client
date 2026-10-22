// openapi/<service>.json → src/<service>/types.gen.ts, without the console routes.
// The committed specs stay complete (check:api reads them); what ships on npm drops
// the routes under CONSOLE_PREFIXES and every schema only they reach, so the
// published types describe the public surface only. Run after `pnpm openapi:dump`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SERVICES = ['fileharbor', 'articuno', 'beacon', 'gatherly'];
// Meridian's console (/admin), signed-in self-service (/me) and Beacon's Twitch extension.
const CONSOLE_PREFIXES = ['admin', 'me', 'extension'];
const root = resolve(import.meta.dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'gen-types-'));

// Components reached from `node` through $ref, transitively.
function reachable(node, spec, seen = new Set()) {
  if (Array.isArray(node)) node.forEach((n) => reachable(n, spec, seen));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && !seen.has(value)) {
        seen.add(value);
        reachable(value.slice(2).split('/').reduce((o, k) => o?.[k], spec), spec, seen);
      } else reachable(value, spec, seen);
    }
  }
  return seen;
}

try {
  for (const service of SERVICES) {
    const spec = JSON.parse(readFileSync(join(root, 'openapi', `${service}.json`), 'utf8'));
    const before = Object.keys(spec.paths).length;
    spec.paths = Object.fromEntries(
      Object.entries(spec.paths).filter(([path]) => !CONSOLE_PREFIXES.includes(path.split('/')[1])),
    );
    const refs = reachable(spec.paths, spec);
    const schemas = spec.components?.schemas ?? {};
    const kept = Object.keys(schemas).filter((name) => refs.has(`#/components/schemas/${name}`));
    spec.components.schemas = Object.fromEntries(kept.map((name) => [name, schemas[name]]));

    const filtered = join(tmp, `${service}.json`);
    writeFileSync(filtered, JSON.stringify(spec));
    execFileSync(
      join(root, 'node_modules', '.bin', 'openapi-typescript'),
      [filtered, '-o', join(root, 'src', service, 'types.gen.ts'), '--root-types', '--root-types-no-schema-prefix', '--empty-objects-unknown'],
      { stdio: 'ignore' },
    );
    console.log(`${service}: ${Object.keys(spec.paths).length}/${before} paths, ${kept.length}/${Object.keys(schemas).length} schemas`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
