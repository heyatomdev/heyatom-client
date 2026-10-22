// Checks that the operations the clients call are unchanged in the services as
// they are now: dumps each service's OpenAPI from the sibling repo and compares,
// for every operationId named in src/<service>/client.ts, its path, method,
// definition and every schema it reaches through $ref against the committed
// spec. Exits 1 on any change. Ops the clients don't use are only counted.
// `info.version` is printed but not trusted: services change routes without bumping it.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const SERVICES = ['fileharbor', 'articuno', 'beacon', 'gatherly'];
const root = resolve(import.meta.dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'check-api-'));
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function operations(spec) {
  const ops = new Map();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (op?.operationId) ops.set(op.operationId, { path, method, op });
    }
  }
  return ops;
}

// The op itself plus every component it reaches, keyed by $ref.
function closure(node, spec, seen = new Map()) {
  if (Array.isArray(node)) node.forEach((n) => closure(n, spec, seen));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && !seen.has(value)) {
        const target = value.slice(2).split('/').reduce((o, k) => o?.[k], spec);
        seen.set(value, target);
        closure(target, spec, seen);
      } else closure(value, spec, seen);
    }
  }
  return seen;
}

let failed = false;
try {
  for (const service of SERVICES) {
    const fresh = join(tmp, `${service}.json`);
    execFileSync('pnpm', ['--dir', join(root, '..', service), 'openapi:dump', fresh], { stdio: 'ignore' });
    const before = readJson(join(root, 'openapi', `${service}.json`));
    const after = readJson(fresh);
    const used = new Set(readFileSync(join(root, 'src', service, 'client.ts'), 'utf8').match(/\b\w+Controller_\w+\b/g));
    const [oldOps, newOps] = [operations(before), operations(after)];

    console.log(`\n${service} ${before.info.version} -> ${after.info.version}`);
    for (const id of [...used].sort()) {
      const a = oldOps.get(id);
      const b = newOps.get(id);
      const status = !b ? 'MISSING' : !a ? 'NEW?' : isDeepStrictEqual(
        { ...a, refs: closure(a.op, before) },
        { ...b, refs: closure(b.op, after) },
      ) ? 'ok' : 'CHANGED';
      if (status !== 'ok') failed = true;
      console.log(`  ${status.padEnd(7)} ${id}`);
    }
    const added = [...newOps.keys()].filter((id) => !oldOps.has(id)).length;
    const removed = [...oldOps.keys()].filter((id) => !newOps.has(id)).length;
    console.log(`  unused by the client: ${added} added, ${removed} removed`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failed) {
  console.error('\nClient operations changed: run `pnpm openapi:dump && pnpm gen:types`, then fix the clients.');
  process.exit(1);
}
