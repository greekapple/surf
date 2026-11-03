import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMopIssue, getMopIssue, clearMopIssues, subscribeMopIssue} from '../ocean/mopIssue.ts';
import {mopDasURL} from '../ocean/mop.ts';

const DAS = 'Attributes {\n NC_GLOBAL {\n String date_issued "2026-11-02T18:00:00Z";\n String time_coverage_start "2026-11-02T00:00:00Z";\n String time_coverage_end "2026-11-12T00:00:00Z";\n String history "x -s 202611021800";\n String time_coverage_resolution "PT3H";\n }\n}';
test('T-097: the MOP issue time loads on demand, once, with the freshness flag; failure is retryable; nothing is loaded until asked', async () => {
  clearMopIssues(); assert.equal(getMopIssue('SF023'), null, 'not loaded at startup');
  let calls = 0, events = 0; const off = subscribeMopIssue(() => events++);
  const fetchOk = async (url: string) => { calls++; assert.equal(url, mopDasURL('SF023')); return DAS; };
  await Promise.all([loadMopIssue('SF023', fetchOk, () => ({cache: 'stale', retrievedAt: '2026-11-02T17:00:00Z'})), loadMopIssue('SF023', fetchOk)]);
  assert.equal(calls, 1, 'one request for concurrent callers'); const i = getMopIssue('SF023')!;
  assert.equal(i.state, 'ok'); assert.equal(i.issue?.issuedAt, '2026-11-02T18:00:00.000Z'); assert.equal(i.delivery, 'saved'); assert.equal(i.retrievedAt, '2026-11-02T17:00:00Z');
  await loadMopIssue('SF023', fetchOk); assert.equal(calls, 1, 'cached once loaded');
  await loadMopIssue('SF024', async () => ({text: DAS}), () => ({cache: 'fresh', retrievedAt: '2026-11-02T18:05:00Z'})); assert.equal(getMopIssue('SF024')!.delivery, undefined); assert.ok(getMopIssue('SF024')!.issue);
  let n = 0; const flaky = async () => { if (n++ === 0) throw new Error('503'); return DAS; };
  await loadMopIssue('SF025', flaky); assert.equal(getMopIssue('SF025')!.state, 'error'); assert.equal(getMopIssue('SF025')!.issue, null, 'a failure shows nothing, never a stale time');
  await loadMopIssue('SF025', flaky); assert.equal(getMopIssue('SF025')!.state, 'ok');
  assert.ok(events > 0); off();
});

test('T-100: a refreshed forecast bundle invalidates cached issue metadata and reloads it', async () => {
  const {syncMopIssueEpoch} = await import('../ocean/mopIssue.ts');
  clearMopIssues(); syncMopIssueEpoch('2026-11-03T10:00:00Z');
  let calls = 0; const f = async () => { calls++; return DAS; };
  await loadMopIssue('SF030', f, () => ({cache: 'stale', retrievedAt: 'x'})); assert.equal(getMopIssue('SF030')!.delivery, 'saved');
  syncMopIssueEpoch('2026-11-03T10:00:00Z'); assert.ok(getMopIssue('SF030'), 'same bundle: kept');
  syncMopIssueEpoch('2026-11-03T10:12:00Z'); assert.equal(getMopIssue('SF030'), null, 'new bundle: the old issue time and saved flag are not shown');
  await loadMopIssue('SF030', f, () => ({cache: 'fresh'})); assert.equal(calls, 2); assert.equal(getMopIssue('SF030')!.delivery, undefined, 'the reload carries the new flag');
  clearMopIssues();
});
