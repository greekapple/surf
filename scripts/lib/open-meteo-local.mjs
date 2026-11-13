// Local Open-Meteo jobs on the paid Standard plan (user-approved 2026-11-13; the 1M calls/month are shared with production).
// The key is read at runtime only: env OPEN_METEO_KEY, else the macOS Keychain (service swello-open-meteo-key, account swello). It is never written to a file, log, commit or printed URL:
// every URL or error text that leaves this module goes through redact(). No key -> the free tier exactly as before (no counter, no pacing change).
// Counter file (counts and dates only): /data/open-meteo-local-usage.json (git-ignored). Counting unit = Open-Meteo's own weighted call (one coordinate = one call, so a 25-coordinate request counts 25).
// Hard stops: 20,000 calls/day and 150,000 calls/month from this machine; the cap throws a clear error and nothing is sent. Pacing: at least 120 ms between requests (<= 500/min, under the 600/min limit).
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {openMeteoFetcher} from '../../services/open-meteo-key.mjs';

export const LIMITS = {perDay: 20000, perMonth: 150000, minGapMs: 120};
export const USER_AGENT = 'SWELLO surf forecast prototype';
const USAGE_FILE = new URL('../../data/open-meteo-local-usage.json', import.meta.url).pathname;

/** Replaces the apikey query value (and the key itself, if given) in any text. */
export function redact(text, key) {
  let s = String(text ?? '').replace(/apikey=[^&\s"'<>]*/gi, 'apikey=REDACTED');
  if (key) for (const k of new Set([key, encodeURIComponent(key)])) s = s.split(k).join('REDACTED');
  return s;
}
/** The key from env or the Keychain; null when there is none (then the free tier is used). */
export function readLocalKey(env = process.env, run = execFileSync) {
  if (env.OPEN_METEO_KEY) return env.OPEN_METEO_KEY;
  try { const k = String(run('security', ['find-generic-password', '-s', 'swello-open-meteo-key', '-w'], {stdio: ['ignore', 'pipe', 'ignore']})).trim(); return k || null; } catch { return null; }
}
/** Open-Meteo weighted calls of one request URL: one per coordinate (the latitude list length), at least 1. */
export const weightOf = (url) => Math.max(1, (/[?&]latitude=([^&]*)/.exec(String(url))?.[1] ?? '').split(/,|%2C/i).filter(Boolean).length);
export function readUsage(file = USAGE_FILE) { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j?.days && typeof j.days === 'object' ? j : {days: {}}; } catch { return {days: {}}; } }
export function usageTotals(usage, now = new Date()) {
  const day = now.toISOString().slice(0, 10), month = day.slice(0, 7); let m = 0;
  for (const [d, v] of Object.entries(usage.days)) if (d.startsWith(month)) m += v.calls;
  return {day, month, today: usage.days[day]?.calls ?? 0, thisMonth: m};
}
/** Checks the caps for `weight` more calls and records them; throws (before anything is sent) when a cap would be exceeded. */
export function reserve(weight, {file = USAGE_FILE, now = new Date(), limits = LIMITS} = {}) {
  const usage = readUsage(file), t = usageTotals(usage, now);
  if (t.today + weight > limits.perDay) throw new Error(`Open-Meteo local cap reached: ${t.today} of ${limits.perDay} calls used today (UTC ${t.day}); stopping before sending ${weight} more. Resumes tomorrow.`);
  if (t.thisMonth + weight > limits.perMonth) throw new Error(`Open-Meteo local cap reached: ${t.thisMonth} of ${limits.perMonth} calls used this month (${t.month}); stopping before sending ${weight} more.`);
  const d = usage.days[t.day] ?? (usage.days[t.day] = {calls: 0, requests: 0}); d.calls += weight; d.requests += 1;
  fs.mkdirSync(new URL('.', 'file://' + file).pathname, {recursive: true}); fs.writeFileSync(file, JSON.stringify(usage) + '\n');
  return usageTotals(usage, now);
}
/** A fetch for local Open-Meteo jobs: paid endpoints when a key exists (same rewrite as production), counted, capped and paced; the plain free fetch otherwise. */
export function localOpenMeteoFetch({key = readLocalKey(), base = fetch, file = USAGE_FILE, now = () => new Date(), limits = LIMITS, sleep = (ms) => new Promise((r) => setTimeout(r, ms))} = {}) {
  const f = (input, init = {}) => { const headers = new Headers(init.headers); if (!headers.has('User-Agent')) headers.set('User-Agent', USER_AGENT); return base(input, {...init, headers}); };
  if (!key) return Object.assign(f, {paid: false});
  const paidFetch = openMeteoFetcher(() => key, f); let last = 0;
  const out = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    reserve(weightOf(url), {file, now: now(), limits});
    const wait = last + limits.minGapMs - Date.now(); if (wait > 0) await sleep(wait); last = Date.now();
    try { return await paidFetch(input, init); } catch (e) { throw new Error(redact(e?.message ?? e, key)); }
  };
  return Object.assign(out, {paid: true});
}
