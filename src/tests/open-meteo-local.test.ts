import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {redact, readLocalKey, weightOf, reserve, usageTotals, readUsage, localOpenMeteoFetch, LIMITS, USER_AGENT} from '../../scripts/lib/open-meteo-local.mjs';

const KEY = 'abcDEF123456secretKEY', tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'omlocal-')), 'usage.json');

test('redact removes apikey values and the key itself from URLs and error text', () => {
  const u = `https://customer-marine-api.open-meteo.com/v1/marine?latitude=1&apikey=${encodeURIComponent(KEY)}&hourly=x`;
  assert.equal(redact(u), 'https://customer-marine-api.open-meteo.com/v1/marine?latitude=1&apikey=REDACTED&hourly=x');
  const e = redact(`fetch failed for ${u} (token ${KEY})`, KEY);
  assert.ok(!e.includes(KEY) && !e.includes('abcDEF') && e.includes('apikey=REDACTED'));
});
test('the key comes from env, else the keychain command; none means free tier', () => {
  assert.equal(readLocalKey({OPEN_METEO_KEY: 'k1'}, (() => { throw new Error('no'); }) as never), 'k1');
  assert.equal(readLocalKey({}, (() => ' k2\n') as never), 'k2');
  assert.equal(readLocalKey({}, (() => { throw new Error('missing'); }) as never), null);
  assert.equal(readLocalKey({}, (() => '\n') as never), null);
});
test('weights count one call per coordinate', () => {
  assert.equal(weightOf('https://marine-api.open-meteo.com/v1/marine?latitude=1,2,3&longitude=4,5,6'), 3);
  assert.equal(weightOf('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2'), 1);
});
test('the counter holds counts and dates only and stops at the day and month caps before sending', () => {
  const file = tmp(), day = new Date('2026-11-13T10:00:00Z'), limits = {perDay: 50, perMonth: 80, minGapMs: 0};
  reserve(30, {file, now: day, limits}); reserve(20, {file, now: day, limits});
  assert.deepEqual(readUsage(file), {days: {'2026-11-13': {calls: 50, requests: 2}}});
  assert.throws(() => reserve(1, {file, now: day, limits}), /cap reached: 50 of 50 calls used today/);
  const next = new Date('2026-11-14T00:00:00Z'); reserve(30, {file, now: next, limits});
  assert.throws(() => reserve(1, {file, now: next, limits}), /80 of 80 calls used this month/);
  assert.equal(usageTotals(readUsage(file), next).thisMonth, 80);
  assert.ok(!/key|secret/i.test(fs.readFileSync(file, 'utf8')));
  assert.equal(LIMITS.perDay, 20000); assert.equal(LIMITS.perMonth, 150000);
});
test('with a key: customer endpoint, user agent, counted; errors never carry the key; without a key the free URL is untouched and nothing is counted', async () => {
  const file = tmp(), seen: {url: string; ua: string | null}[] = [];
  const base = (async (u: string, init?: RequestInit) => { seen.push({url: u, ua: new Headers(init?.headers).get('User-Agent')}); return new Response('{}', {status: 200}); }) as unknown as typeof fetch;
  const f = localOpenMeteoFetch({key: KEY, base, file, limits: {perDay: 100, perMonth: 100, minGapMs: 0}});
  await f('https://marine-api.open-meteo.com/v1/marine?latitude=1,2&longitude=3,4');
  assert.ok(seen[0].url.startsWith('https://customer-marine-api.open-meteo.com/') && seen[0].url.includes('apikey=')); assert.equal(seen[0].ua, USER_AGENT);
  assert.equal(readUsage(file).days[Object.keys(readUsage(file).days)[0]].calls, 2);
  const bad = localOpenMeteoFetch({key: KEY, base: (async (u: string) => { throw new Error(`boom ${u}`); }) as unknown as typeof fetch, file, limits: {perDay: 100, perMonth: 100, minGapMs: 0}});
  await assert.rejects(() => bad('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2'), (e: Error) => !e.message.includes(KEY) && /apikey=REDACTED/.test(e.message));
  const file2 = tmp(), seen2: string[] = [];
  const free = localOpenMeteoFetch({key: null, base: (async (u: string) => { seen2.push(u); return new Response('{}'); }) as unknown as typeof fetch, file: file2});
  await free('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2'); assert.deepEqual(seen2, ['https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2']); assert.equal(fs.existsSync(file2), false); assert.equal(free.paid, false);
});
