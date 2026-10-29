// Alert rules: stored on this device, evaluated against the forecast that is already loaded. No push, no server.
import type {Forecast, SurfSpot} from '../../models/index.ts';
import {windRelationship} from '../../recommendation/sqi.ts';

export const ALERTS_KEY = 'swello-alerts';
export const WINDOW_DAYS = 7;

export interface AlertRule {
  id: string;
  spotId: string;
  /** Offshore (swell) height bounds in feet; null = no bound. */
  minFt: number | null;
  maxFt: number | null;
  /** Wind speed ceiling in mph; null = no limit. */
  maxWindMph: number | null;
  offshoreOnly: boolean;
  enabled: boolean;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

export function parseRules(raw: string | null): AlertRule[] {
  try {
    const list = JSON.parse(raw ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.flatMap((r): AlertRule[] => typeof r?.id === 'string' && typeof r?.spotId === 'string'
      ? [{id: r.id, spotId: r.spotId, minFt: num(r.minFt), maxFt: num(r.maxFt), maxWindMph: num(r.maxWindMph), offshoreOnly: !!r.offshoreOnly, enabled: r.enabled !== false}]
      : []);
  } catch { return []; }
}

export function loadRules(): AlertRule[] {
  try { return parseRules(localStorage.getItem(ALERTS_KEY)); } catch { return []; }
}
export function saveRules(rules: AlertRule[]): boolean {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(rules)); return true; } catch { return false; }
}

export type RuleResult =
  | {kind: 'match'; at: string}
  | {kind: 'none'}
  | {kind: 'nodata'};

/** Does one forecast hour satisfy the rule? Missing values never count as a match. */
export function hourMatches(rule: AlertRule, spot: SurfSpot, f: Forecast): boolean {
  const h = f.offshore;
  if (rule.minFt !== null || rule.maxFt !== null) {
    if (!Number.isFinite(h)) return false;
    if (rule.minFt !== null && h < rule.minFt) return false;
    if (rule.maxFt !== null && h > rule.maxFt) return false;
  }
  if (rule.maxWindMph !== null) {
    if (f.availability?.wind === false || !Number.isFinite(f.wind?.speed) || f.wind.speed > rule.maxWindMph) return false;
  }
  if (rule.offshoreOnly && windRelationship(spot, f) !== 'Offshore') return false;
  return true;
}

/** First matching hour in the next 7 days, "none" when hours were checked but none fit, "nodata" when no hours are loaded. */
export function evaluateRule(rule: AlertRule, spot: SurfSpot | undefined, records: Forecast[], now: number): RuleResult {
  if (!spot) return {kind: 'nodata'};
  const from = now - 3600000, to = now + WINDOW_DAYS * 86400000;
  const hours = records
    .filter((f) => f.spotId === rule.spotId && Date.parse(f.timestamp) >= from && Date.parse(f.timestamp) <= to)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (!hours.length) return {kind: 'nodata'};
  const hit = hours.find((f) => hourMatches(rule, spot, f));
  return hit ? {kind: 'match', at: hit.timestamp} : {kind: 'none'};
}

const trim = (n: number) => `${+n.toFixed(1)}`;

/** "4+ ft and offshore wind", "2–6 ft and wind up to 12 mph". Heights are given in the user's unit via `fmt`. */
export function describeRule(rule: AlertRule, fmt: (ft: number) => string, unit: string, windFmt: (mph: number) => string): string {
  const parts: string[] = [];
  const lo = rule.minFt, hi = rule.maxFt;
  if (lo !== null && hi !== null) parts.push(`${fmt(lo)}–${fmt(hi)} ${unit}`);
  else if (lo !== null) parts.push(`${fmt(lo)}+ ${unit}`);
  else if (hi !== null) parts.push(`up to ${fmt(hi)} ${unit}`);
  if (rule.offshoreOnly) parts.push('offshore wind');
  if (rule.maxWindMph !== null) parts.push(`wind up to ${windFmt(rule.maxWindMph)}`);
  return parts.length ? parts.join(' and ') : 'any conditions';
}
export {trim as trimNumber};
