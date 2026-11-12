import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
// 2026-11-12: an unclosed @media in trust.css swallowed the rest of the bundled stylesheet into a phone-only block, so wide screens rendered unstyled in production.
const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.css') ? [p] : []; });
test('every stylesheet closes every block it opens', () => {
  for (const f of files(new URL('../', import.meta.url).pathname)) {
    const s = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    let d = 0; for (const c of s) { if (c === '{') d++; else if (c === '}') { d--; assert.ok(d >= 0, `${f}: extra }`); } }
    assert.equal(d, 0, `${f}: ${d} unclosed block(s)`);
  }
});
